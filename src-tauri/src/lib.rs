mod catalog;
mod preview_generation;
mod tooling;

use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::{Arc, Mutex},
    thread,
};

use catalog::{
    Catalog, CatalogPerformer, CatalogTag, CatalogVideo, FailedPreviewStrip,
    FfmpegPreviewStripGenerator, FfprobeVideoFileProbe, MetadataSuggestionGroup,
    PreviewStripRetryReason, ScanRoot, ScanRootInferenceRules, ScanRootRefreshProgress,
    ScanRootRefreshStatus, UnprocessableVideoCandidate, VideoExtensionAllowlist,
};
use preview_generation::{
    generate_preview_strip_request, store_preview_strip_completion, PreviewGenerationRuntime,
    PreviewGenerationStart, PreviewGenerationStatus,
};
use serde::Deserialize;
use tauri::{Emitter, Manager, WindowEvent};
use tooling::{FfmpegConfiguration, FfmpegToolsStatus};

const LOCAL_DESKTOP_APP_STATUS: &str = "Rust command online";
const CATALOG_DATABASE_FILENAME: &str = "catalog.sqlite3";
const PREVIEW_STRIP_CACHE_FOLDER_NAME: &str = "preview-strips";

struct CatalogState {
    catalog: Arc<Mutex<Catalog>>,
}

struct ScanRootRefreshRuntime {
    active_job: Mutex<Option<ScanRootRefreshJob>>,
}

struct ScanRootRefreshJob {
    scan_root_path: String,
    cancellation_requested: Arc<std::sync::atomic::AtomicBool>,
}

impl ScanRootRefreshRuntime {
    fn idle() -> Self {
        Self {
            active_job: Mutex::new(None),
        }
    }

    fn start(&self, scan_root_path: &str) -> Result<Arc<std::sync::atomic::AtomicBool>, String> {
        let mut active_job = self.active_job.lock().map_err(|error| error.to_string())?;

        if active_job.is_some() {
            return Err("A Scan Root refresh is already running".to_string());
        }

        let cancellation_requested = Arc::new(std::sync::atomic::AtomicBool::new(false));
        *active_job = Some(ScanRootRefreshJob {
            scan_root_path: scan_root_path.to_string(),
            cancellation_requested: Arc::clone(&cancellation_requested),
        });

        Ok(cancellation_requested)
    }

    fn request_cancel(&self, scan_root_path: &str) -> Result<(), String> {
        let active_job = self.active_job.lock().map_err(|error| error.to_string())?;
        let Some(active_job) = active_job.as_ref() else {
            return Err("No Scan Root refresh is running".to_string());
        };

        if active_job.scan_root_path != scan_root_path {
            return Err("A different Scan Root refresh is running".to_string());
        }

        active_job
            .cancellation_requested
            .store(true, std::sync::atomic::Ordering::SeqCst);
        Ok(())
    }

    fn finish(&self, scan_root_path: &str) {
        let Ok(mut active_job) = self.active_job.lock() else {
            return;
        };

        if active_job
            .as_ref()
            .is_some_and(|job| job.scan_root_path == scan_root_path)
        {
            *active_job = None;
        }
    }
}

fn local_desktop_app_status() -> &'static str {
    LOCAL_DESKTOP_APP_STATUS
}

fn catalog_path(app: &tauri::App) -> Result<PathBuf, String> {
    let app_data_folder = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&app_data_folder).map_err(|error| error.to_string())?;

    Ok(app_data_folder.join(CATALOG_DATABASE_FILENAME))
}

fn initialize_catalog(app: &tauri::App) -> Result<(), String> {
    let catalog_path = catalog_path(app)?;
    let catalog = Catalog::open(&catalog_path)?;
    let catalog_state = CatalogState {
        catalog: Arc::new(Mutex::new(catalog)),
    };

    app.manage(catalog_state);
    app.manage(PreviewGenerationRuntime::paused());
    app.manage(ScanRootRefreshRuntime::idle());

    Ok(())
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
enum ScanRootRemovalPolicy {
    PreserveMissingVideos,
    ForgetFromCatalog,
}

#[tauri::command]
fn get_local_desktop_app_status() -> &'static str {
    local_desktop_app_status()
}

#[tauri::command]
fn list_catalog_videos(
    catalog_state: tauri::State<'_, CatalogState>,
) -> Result<Vec<CatalogVideo>, String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.listed_videos()
}

#[tauri::command]
fn list_scan_roots(catalog_state: tauri::State<'_, CatalogState>) -> Result<Vec<ScanRoot>, String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.list_scan_roots()
}

#[tauri::command]
fn add_scan_root(
    catalog_state: tauri::State<'_, CatalogState>,
    path: String,
) -> Result<ScanRoot, String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.add_scan_root(Path::new(&path))
}

#[tauri::command]
fn update_scan_root_inference_rules(
    catalog_state: tauri::State<'_, CatalogState>,
    path: String,
    inference_rules: ScanRootInferenceRules,
) -> Result<ScanRoot, String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.update_scan_root_inference_rules(&path, inference_rules)
}

#[tauri::command]
fn remove_scan_root(
    catalog_state: tauri::State<'_, CatalogState>,
    path: String,
    removal_policy: ScanRootRemovalPolicy,
) -> Result<(), String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    match removal_policy {
        ScanRootRemovalPolicy::PreserveMissingVideos => {
            catalog.remove_scan_root_preserving_missing_videos(&path)
        }
        ScanRootRemovalPolicy::ForgetFromCatalog => {
            catalog.remove_scan_root_forgetting_catalog_videos(&path)
        }
    }
}

#[tauri::command]
fn forget_catalog_video(
    catalog_state: tauri::State<'_, CatalogState>,
    video_id: i64,
) -> Result<(), String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.forget_catalog_video(video_id)
}

#[tauri::command]
fn list_tags(catalog_state: tauri::State<'_, CatalogState>) -> Result<Vec<CatalogTag>, String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.list_tags()
}

#[tauri::command]
fn create_tag(
    catalog_state: tauri::State<'_, CatalogState>,
    name: String,
) -> Result<CatalogTag, String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.create_tag(&name)
}

#[tauri::command]
fn update_tag(
    catalog_state: tauri::State<'_, CatalogState>,
    tag_id: i64,
    name: String,
) -> Result<CatalogTag, String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.update_tag(tag_id, &name)
}

#[tauri::command]
fn delete_tag(catalog_state: tauri::State<'_, CatalogState>, tag_id: i64) -> Result<(), String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.delete_tag(tag_id)
}

#[tauri::command]
fn list_performers(
    catalog_state: tauri::State<'_, CatalogState>,
) -> Result<Vec<CatalogPerformer>, String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.list_performers()
}

#[tauri::command]
fn create_performer(
    catalog_state: tauri::State<'_, CatalogState>,
    name: String,
) -> Result<CatalogPerformer, String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.create_performer(&name)
}

#[tauri::command]
fn update_performer(
    catalog_state: tauri::State<'_, CatalogState>,
    performer_id: i64,
    name: String,
) -> Result<CatalogPerformer, String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.update_performer(performer_id, &name)
}

#[tauri::command]
fn delete_performer(
    catalog_state: tauri::State<'_, CatalogState>,
    performer_id: i64,
) -> Result<(), String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.delete_performer(performer_id)
}

#[tauri::command]
fn attach_tag_to_video(
    catalog_state: tauri::State<'_, CatalogState>,
    tag_id: i64,
    video_id: i64,
) -> Result<(), String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.attach_tag_to_video(tag_id, video_id)
}

#[tauri::command]
fn detach_tag_from_video(
    catalog_state: tauri::State<'_, CatalogState>,
    tag_id: i64,
    video_id: i64,
) -> Result<(), String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.detach_tag_from_video(tag_id, video_id)
}

#[tauri::command]
fn tags_for_video(
    catalog_state: tauri::State<'_, CatalogState>,
    video_id: i64,
) -> Result<Vec<CatalogTag>, String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.tags_for_video(video_id)
}

#[tauri::command]
fn attach_performer_to_video(
    catalog_state: tauri::State<'_, CatalogState>,
    performer_id: i64,
    video_id: i64,
) -> Result<(), String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.attach_performer_to_video(performer_id, video_id)
}

#[tauri::command]
fn detach_performer_from_video(
    catalog_state: tauri::State<'_, CatalogState>,
    performer_id: i64,
    video_id: i64,
) -> Result<(), String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.detach_performer_from_video(performer_id, video_id)
}

#[tauri::command]
fn performers_for_video(
    catalog_state: tauri::State<'_, CatalogState>,
    video_id: i64,
) -> Result<Vec<CatalogPerformer>, String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.performers_for_video(video_id)
}

#[tauri::command]
fn update_video_title(
    catalog_state: tauri::State<'_, CatalogState>,
    video_id: i64,
    title: String,
) -> Result<(), String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.update_video_title(video_id, &title)
}

#[tauri::command]
fn set_video_favorite(
    catalog_state: tauri::State<'_, CatalogState>,
    video_id: i64,
    is_favorite: bool,
) -> Result<(), String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.set_video_favorite(video_id, is_favorite)
}

#[tauri::command]
fn open_catalog_video(
    catalog_state: tauri::State<'_, CatalogState>,
    video_id: i64,
) -> Result<(), String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;
    let file_location_path = catalog.preferred_file_location_path(video_id)?;

    open_file_location(&file_location_path)?;
    catalog.record_video_opened(video_id)
}

#[tauri::command]
fn open_catalog_video_containing_folder(
    catalog_state: tauri::State<'_, CatalogState>,
    video_id: i64,
) -> Result<(), String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;
    let file_location_path = catalog.preferred_file_location_path(video_id)?;
    let containing_folder_path = file_location_path
        .parent()
        .ok_or_else(|| "Could not find containing folder".to_string())?;

    open_file_location(containing_folder_path)
}

fn open_file_location(file_location_path: &Path) -> Result<(), String> {
    let open_command = file_location_open_command(file_location_path);
    let output = Command::new(&open_command.program)
        .args(&open_command.arguments)
        .output()
        .map_err(|error| error.to_string())?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if stderr.is_empty() {
        "Could not open Video".to_string()
    } else {
        stderr
    })
}

struct FileLocationOpenCommand {
    program: String,
    arguments: Vec<String>,
}

fn file_location_open_command(file_location_path: &Path) -> FileLocationOpenCommand {
    file_location_open_command_for_platform(file_location_path, std::env::consts::OS)
}

fn file_location_open_command_for_platform(
    file_location_path: &Path,
    operating_system: &str,
) -> FileLocationOpenCommand {
    let file_location_path_text = file_location_path.to_string_lossy().into_owned();

    match operating_system {
        "macos" => FileLocationOpenCommand {
            program: "open".to_string(),
            arguments: vec![file_location_path_text],
        },
        "windows" => FileLocationOpenCommand {
            program: "cmd".to_string(),
            arguments: vec![
                "/C".to_string(),
                "start".to_string(),
                "".to_string(),
                file_location_path_text,
            ],
        },
        _ => FileLocationOpenCommand {
            program: "xdg-open".to_string(),
            arguments: vec![file_location_path_text],
        },
    }
}

#[tauri::command]
fn get_ffmpeg_tools_status(app: tauri::AppHandle) -> Result<FfmpegToolsStatus, String> {
    tooling::load_ffmpeg_tools_status(&app)
}

fn preview_strip_cache_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_cache_directory = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?;

    Ok(app_cache_directory.join(PREVIEW_STRIP_CACHE_FOLDER_NAME))
}

fn pause_preview_strip_queue_state(
    preview_generation_runtime: &PreviewGenerationRuntime,
) -> Result<(), String> {
    preview_generation_runtime.pause()
}

fn preview_strip_queue_status(
    catalog_state: &CatalogState,
    preview_generation_runtime: &PreviewGenerationRuntime,
) -> Result<PreviewGenerationStatus, String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;
    let queue_counts = catalog.preview_strip_queue_counts()?;

    preview_generation_runtime.status(queue_counts)
}

#[tauri::command]
fn save_ffmpeg_configuration(
    app: tauri::AppHandle,
    catalog_state: tauri::State<'_, CatalogState>,
    configuration: FfmpegConfiguration,
) -> Result<FfmpegToolsStatus, String> {
    let previous_configuration = tooling::load_saved_ffmpeg_configuration(&app)?;
    let should_retry_ignored_failures = previous_configuration != configuration;

    let ffmpeg_tools_status = tooling::save_ffmpeg_configuration(&app, &configuration)?;
    if should_retry_ignored_failures {
        let catalog = catalog_state
            .catalog
            .lock()
            .map_err(|error| error.to_string())?;
        catalog.retry_ignored_failed_preview_strips(
            PreviewStripRetryReason::FfmpegConfigurationChanged,
        )?;
    }

    Ok(ffmpeg_tools_status)
}

#[tauri::command]
fn start_scan_root_refresh_job(
    app: tauri::AppHandle,
    catalog_state: tauri::State<'_, CatalogState>,
    preview_generation_runtime: tauri::State<'_, PreviewGenerationRuntime>,
    scan_root_refresh_runtime: tauri::State<'_, ScanRootRefreshRuntime>,
    path: String,
    video_extension_allowlist: Option<VideoExtensionAllowlist>,
) -> Result<(), String> {
    pause_preview_strip_queue_state(&preview_generation_runtime)?;
    let ffprobe_path = tooling::configured_or_discovered_ffprobe_path(&app)?;
    let cancellation_requested = scan_root_refresh_runtime.start(&path)?;
    let video_extension_allowlist = video_extension_allowlist.unwrap_or_default();
    let catalog = Arc::clone(&catalog_state.inner().catalog);
    let app_handle = app.clone();
    let scan_root_path = path.clone();

    thread::spawn(move || {
        let video_file_probe = FfprobeVideoFileProbe::new(ffprobe_path);
        let catalog = catalog.lock().map_err(|error| error.to_string());

        match catalog {
            Ok(catalog) => {
                let last_progress = Arc::new(Mutex::new(None::<ScanRootRefreshProgress>));
                let emitted_progress = Arc::clone(&last_progress);
                let refresh_result = catalog.refresh_scan_root_with_progress(
                    &scan_root_path,
                    &video_file_probe,
                    &video_extension_allowlist,
                    || cancellation_requested.load(std::sync::atomic::Ordering::SeqCst),
                    |progress| {
                        if let Ok(mut last_progress) = emitted_progress.lock() {
                            *last_progress = Some(progress.clone());
                        }
                        emit_scan_root_refresh_progress(&app_handle, progress);
                    },
                );

                if let Err(error) = refresh_result {
                    let failed_progress = last_progress
                        .lock()
                        .ok()
                        .and_then(|last_progress| last_progress.clone())
                        .map(|last_progress| {
                            failed_scan_root_refresh_progress_from_last(
                                last_progress,
                                error.clone(),
                            )
                        })
                        .unwrap_or_else(|| {
                            failed_scan_root_refresh_progress(&scan_root_path, error)
                        });
                    emit_scan_root_refresh_progress(&app_handle, failed_progress);
                }
            }
            Err(error) => {
                emit_scan_root_refresh_progress(
                    &app_handle,
                    failed_scan_root_refresh_progress(&scan_root_path, error),
                );
            }
        }

        let scan_root_refresh_runtime = app_handle.state::<ScanRootRefreshRuntime>();
        scan_root_refresh_runtime.finish(&scan_root_path);
    });

    Ok(())
}

#[tauri::command]
fn cancel_scan_root_refresh_job(
    scan_root_refresh_runtime: tauri::State<'_, ScanRootRefreshRuntime>,
    path: String,
) -> Result<(), String> {
    scan_root_refresh_runtime.request_cancel(&path)
}

fn emit_scan_root_refresh_progress(app: &tauri::AppHandle, progress: ScanRootRefreshProgress) {
    let _ = app.emit("scan-root-refresh-progress", progress);
}

fn failed_scan_root_refresh_progress(
    scan_root_path: &str,
    message: String,
) -> ScanRootRefreshProgress {
    ScanRootRefreshProgress {
        scan_root_path: scan_root_path.to_string(),
        status: ScanRootRefreshStatus::Failed,
        processed_video_candidate_count: 0,
        total_video_candidate_count: None,
        scanned_video_count: 0,
        unprocessable_candidate_count: 0,
        message: Some(message),
    }
}

fn failed_scan_root_refresh_progress_from_last(
    last_progress: ScanRootRefreshProgress,
    message: String,
) -> ScanRootRefreshProgress {
    ScanRootRefreshProgress {
        status: ScanRootRefreshStatus::Failed,
        message: Some(message),
        ..last_progress
    }
}

#[tauri::command]
fn list_unprocessable_video_candidates(
    catalog_state: tauri::State<'_, CatalogState>,
) -> Result<Vec<UnprocessableVideoCandidate>, String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.list_unprocessable_video_candidates()
}

#[tauri::command]
fn list_failed_preview_strips(
    catalog_state: tauri::State<'_, CatalogState>,
) -> Result<Vec<FailedPreviewStrip>, String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.list_failed_preview_strips()
}

#[tauri::command]
fn list_metadata_suggestion_groups(
    catalog_state: tauri::State<'_, CatalogState>,
) -> Result<Vec<MetadataSuggestionGroup>, String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.list_metadata_suggestion_groups()
}

#[tauri::command]
fn accept_metadata_suggestion_for_videos(
    catalog_state: tauri::State<'_, CatalogState>,
    scan_root_path: String,
    suggested_value: String,
    source_path_segment: String,
    suggestion_kind: String,
    accepted_metadata_kind: Option<String>,
    accepted_value: Option<String>,
    video_ids: Vec<i64>,
) -> Result<(), String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.accept_metadata_suggestion_for_videos(
        &scan_root_path,
        &suggested_value,
        &source_path_segment,
        &suggestion_kind,
        accepted_metadata_kind.as_deref(),
        accepted_value.as_deref(),
        &video_ids,
    )
}

#[tauri::command]
fn reject_metadata_suggestion_source(
    catalog_state: tauri::State<'_, CatalogState>,
    scan_root_path: String,
    source_path_segment: String,
    suggested_value: String,
    suggestion_kind: String,
) -> Result<(), String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.reject_metadata_suggestion_source(
        &scan_root_path,
        &source_path_segment,
        &suggested_value,
        &suggestion_kind,
    )
}

#[tauri::command]
fn retry_failed_preview_strip(
    catalog_state: tauri::State<'_, CatalogState>,
    preview_generation_runtime: tauri::State<'_, PreviewGenerationRuntime>,
    video_id: i64,
) -> Result<PreviewGenerationStatus, String> {
    {
        let catalog = catalog_state
            .catalog
            .lock()
            .map_err(|error| error.to_string())?;
        catalog.retry_failed_preview_strip(video_id, PreviewStripRetryReason::Manual)?;
    }

    preview_strip_queue_status(&catalog_state, &preview_generation_runtime)
}

#[tauri::command]
fn ignore_failed_preview_strip(
    catalog_state: tauri::State<'_, CatalogState>,
    preview_generation_runtime: tauri::State<'_, PreviewGenerationRuntime>,
    video_id: i64,
) -> Result<PreviewGenerationStatus, String> {
    {
        let catalog = catalog_state
            .catalog
            .lock()
            .map_err(|error| error.to_string())?;
        catalog.ignore_failed_preview_strip(video_id)?;
    }

    preview_strip_queue_status(&catalog_state, &preview_generation_runtime)
}

#[tauri::command]
fn get_preview_strip_queue_status(
    catalog_state: tauri::State<'_, CatalogState>,
    preview_generation_runtime: tauri::State<'_, PreviewGenerationRuntime>,
) -> Result<PreviewGenerationStatus, String> {
    preview_strip_queue_status(&catalog_state, &preview_generation_runtime)
}

#[tauri::command]
fn pause_preview_strip_queue(
    catalog_state: tauri::State<'_, CatalogState>,
    preview_generation_runtime: tauri::State<'_, PreviewGenerationRuntime>,
) -> Result<PreviewGenerationStatus, String> {
    pause_preview_strip_queue_state(&preview_generation_runtime)?;

    preview_strip_queue_status(&catalog_state, &preview_generation_runtime)
}

#[tauri::command]
fn resume_preview_strip_queue(
    catalog_state: tauri::State<'_, CatalogState>,
    preview_generation_runtime: tauri::State<'_, PreviewGenerationRuntime>,
) -> Result<PreviewGenerationStatus, String> {
    preview_generation_runtime.resume()?;

    preview_strip_queue_status(&catalog_state, &preview_generation_runtime)
}

#[tauri::command]
fn process_next_preview_strip_queue_item(
    app: tauri::AppHandle,
    catalog_state: tauri::State<'_, CatalogState>,
    preview_generation_runtime: tauri::State<'_, PreviewGenerationRuntime>,
) -> Result<PreviewGenerationStatus, String> {
    match preview_generation_runtime.try_start()? {
        PreviewGenerationStart::Paused | PreviewGenerationStart::AlreadyRunning => {
            return preview_strip_queue_status(&catalog_state, &preview_generation_runtime);
        }
        PreviewGenerationStart::Started => {}
    }

    let preparation_result = (|| {
        let ffmpeg_path = tooling::configured_or_discovered_ffmpeg_path(&app)?;
        let preview_cache_path = preview_strip_cache_path(&app)?;
        let request = {
            let catalog = catalog_state
                .catalog
                .lock()
                .map_err(|error| error.to_string())?;
            catalog.next_preview_strip_request(&preview_cache_path)?
        };

        Ok((ffmpeg_path, request))
    })();
    let (ffmpeg_path, request) = match preparation_result {
        Ok(prepared_generation) => prepared_generation,
        Err(reason) => {
            preview_generation_runtime.finish_running_video();
            return Err(reason);
        }
    };
    let Some(request) = request else {
        preview_generation_runtime.finish_running_video();
        return preview_strip_queue_status(&catalog_state, &preview_generation_runtime);
    };

    preview_generation_runtime.mark_running_video(request.video_id)?;

    let worker_app = app.clone();
    let worker_stop_requested = preview_generation_runtime.stop_requested();
    thread::spawn(move || {
        let generation_result: Result<(), String> = (|| {
            let preview_strip_generator =
                FfmpegPreviewStripGenerator::new(ffmpeg_path, Arc::clone(&worker_stop_requested));
            let preview_generation_completion =
                generate_preview_strip_request(&preview_strip_generator, &request);

            let catalog_state = worker_app.state::<CatalogState>();
            let catalog = catalog_state
                .catalog
                .lock()
                .map_err(|error| error.to_string())?;
            store_preview_strip_completion(
                &catalog,
                request.video_id,
                preview_generation_completion,
            )?;

            Ok(())
        })();

        let preview_generation_runtime = worker_app.state::<PreviewGenerationRuntime>();
        preview_generation_runtime.finish_running_video();
        if let Err(reason) = generation_result {
            eprintln!("Preview Strip generation worker failed: {reason}");
        }
    });

    preview_strip_queue_status(&catalog_state, &preview_generation_runtime)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            initialize_catalog(app)
                .map_err(|error| Box::<dyn std::error::Error>::from(std::io::Error::other(error)))
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::CloseRequested { .. }) {
                if let Some(preview_generation_runtime) =
                    window.try_state::<PreviewGenerationRuntime>()
                {
                    preview_generation_runtime.request_stop();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_local_desktop_app_status,
            list_catalog_videos,
            list_scan_roots,
            add_scan_root,
            update_scan_root_inference_rules,
            remove_scan_root,
            forget_catalog_video,
            list_tags,
            create_tag,
            update_tag,
            delete_tag,
            list_performers,
            create_performer,
            update_performer,
            delete_performer,
            attach_tag_to_video,
            detach_tag_from_video,
            tags_for_video,
            attach_performer_to_video,
            detach_performer_from_video,
            performers_for_video,
            update_video_title,
            set_video_favorite,
            open_catalog_video,
            open_catalog_video_containing_folder,
            get_ffmpeg_tools_status,
            save_ffmpeg_configuration,
            start_scan_root_refresh_job,
            cancel_scan_root_refresh_job,
            list_unprocessable_video_candidates,
            list_failed_preview_strips,
            list_metadata_suggestion_groups,
            accept_metadata_suggestion_for_videos,
            reject_metadata_suggestion_source,
            retry_failed_preview_strip,
            ignore_failed_preview_strip,
            get_preview_strip_queue_status,
            pause_preview_strip_queue,
            resume_preview_strip_queue,
            process_next_preview_strip_queue_item
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests;
