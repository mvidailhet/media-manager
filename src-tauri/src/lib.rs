mod catalog;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::{
    env, fs, io,
    path::{Path, PathBuf},
    sync::Mutex,
};

use catalog::{
    Catalog, CatalogVideo, FfmpegPreviewStripGenerator, FfprobeVideoFileProbe,
    PreviewStripGenerationSummary, PreviewStripGenerator, PreviewStripQueueCounts, ScanRoot,
    ScanRootRefreshSummary, UnprocessableVideoCandidate, VideoExtensionAllowlist,
};
use serde::{Deserialize, Serialize};
use tauri::Manager;

const LOCAL_DESKTOP_APP_STATUS: &str = "Rust command online";
const CATALOG_DATABASE_FILENAME: &str = "catalog.sqlite3";
const FFMPEG_BINARY_NAME: &str = "ffmpeg";
const FFPROBE_BINARY_NAME: &str = "ffprobe";
const FFMPEG_SETTINGS_FILE_NAME: &str = "ffmpeg-settings.json";
const PREVIEW_STRIP_CACHE_FOLDER_NAME: &str = "preview-strips";

struct CatalogState {
    catalog: Mutex<Catalog>,
}

struct PreviewStripQueueState {
    is_paused: Mutex<bool>,
    running_count: Mutex<i64>,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct PreviewStripQueueStatus {
    pending_count: i64,
    running_count: i64,
    failed_count: i64,
    is_paused: bool,
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
        catalog: Mutex::new(catalog),
    };

    app.manage(catalog_state);
    app.manage(PreviewStripQueueState {
        is_paused: Mutex::new(false),
        running_count: Mutex::new(0),
    });

    Ok(())
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct FfmpegConfiguration {
    ffmpeg_path: Option<String>,
    ffprobe_path: Option<String>,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct FfmpegToolsStatus {
    ffmpeg: FfmpegToolStatus,
    ffprobe: FfmpegToolStatus,
    configuration: FfmpegConfiguration,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct FfmpegToolStatus {
    binary_name: &'static str,
    is_available: bool,
    resolved_path: Option<String>,
    status_message: String,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
enum ScanRootRemovalPolicy {
    PreserveMissingVideos,
    ForgetFromCatalog,
}

fn discover_ffmpeg_tools_status(
    path_value: &str,
    configuration: FfmpegConfiguration,
) -> FfmpegToolsStatus {
    FfmpegToolsStatus {
        ffmpeg: discover_ffmpeg_tool_status(
            FFMPEG_BINARY_NAME,
            configuration.ffmpeg_path.as_deref(),
            path_value,
        ),
        ffprobe: discover_ffmpeg_tool_status(
            FFPROBE_BINARY_NAME,
            configuration.ffprobe_path.as_deref(),
            path_value,
        ),
        configuration,
    }
}

fn discover_ffmpeg_tool_status(
    binary_name: &'static str,
    configured_path: Option<&str>,
    path_value: &str,
) -> FfmpegToolStatus {
    if let Some(configured_path) = configured_path.filter(|path| !path.trim().is_empty()) {
        return status_for_candidate(binary_name, Path::new(configured_path), "configured path");
    }

    if let Some(discovered_path) = find_binary_on_path(binary_name, path_value) {
        return available_tool_status(binary_name, discovered_path, "discovered from PATH");
    }

    FfmpegToolStatus {
        binary_name,
        is_available: false,
        resolved_path: None,
        status_message: format!("{binary_name} is not available from PATH or settings"),
    }
}

fn status_for_candidate(
    binary_name: &'static str,
    candidate_path: &Path,
    source_description: &str,
) -> FfmpegToolStatus {
    if is_executable_file(candidate_path) {
        available_tool_status(
            binary_name,
            candidate_path.to_path_buf(),
            source_description,
        )
    } else {
        FfmpegToolStatus {
            binary_name,
            is_available: false,
            resolved_path: Some(candidate_path.to_string_lossy().into_owned()),
            status_message: format!("{binary_name} was not found at the {source_description}"),
        }
    }
}

fn available_tool_status(
    binary_name: &'static str,
    resolved_path: PathBuf,
    source_description: &str,
) -> FfmpegToolStatus {
    FfmpegToolStatus {
        binary_name,
        is_available: true,
        resolved_path: Some(resolved_path.to_string_lossy().into_owned()),
        status_message: format!("{binary_name} is available ({source_description})"),
    }
}

fn find_binary_on_path(binary_name: &str, path_value: &str) -> Option<PathBuf> {
    env::split_paths(path_value)
        .flat_map(|path_directory| {
            executable_binary_names(binary_name)
                .into_iter()
                .map(move |candidate_name| path_directory.join(candidate_name))
        })
        .find(|candidate_path| is_executable_file(candidate_path))
}

fn executable_binary_names(binary_name: &str) -> Vec<String> {
    let binary_file_name = binary_name.to_string();
    let windows_binary_file_name = format!("{binary_name}.exe");

    if binary_name.ends_with(".exe") {
        vec![binary_file_name]
    } else {
        vec![binary_file_name, windows_binary_file_name]
    }
}

#[cfg(unix)]
fn is_executable_file(path: &Path) -> bool {
    path.metadata()
        .map(|metadata| metadata.is_file() && metadata.permissions().mode() & 0o111 != 0)
        .unwrap_or(false)
}

#[cfg(not(unix))]
fn is_executable_file(path: &Path) -> bool {
    path.is_file()
}

fn load_ffmpeg_configuration(settings_path: &Path) -> Result<FfmpegConfiguration, String> {
    match fs::read_to_string(settings_path) {
        Ok(settings_json) => {
            serde_json::from_str(&settings_json).map_err(|error| error.to_string())
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(FfmpegConfiguration::default()),
        Err(error) => Err(error.to_string()),
    }
}

fn save_ffmpeg_configuration_to_path(
    settings_path: &Path,
    configuration: &FfmpegConfiguration,
) -> Result<(), String> {
    if let Some(settings_directory) = settings_path.parent() {
        fs::create_dir_all(settings_directory).map_err(|error| error.to_string())?;
    }

    let settings_json =
        serde_json::to_string_pretty(configuration).map_err(|error| error.to_string())?;
    fs::write(settings_path, settings_json).map_err(|error| error.to_string())
}

fn ffmpeg_settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_config_directory = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;

    Ok(app_config_directory.join(FFMPEG_SETTINGS_FILE_NAME))
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
fn get_ffmpeg_tools_status(app: tauri::AppHandle) -> Result<FfmpegToolsStatus, String> {
    let settings_path = ffmpeg_settings_path(&app)?;
    let configuration = load_ffmpeg_configuration(&settings_path)?;
    let path_value = env::var_os("PATH").unwrap_or_default();
    let path_value = path_value.to_string_lossy();

    Ok(discover_ffmpeg_tools_status(&path_value, configuration))
}

fn configured_or_discovered_ffprobe_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let settings_path = ffmpeg_settings_path(app)?;
    let configuration = load_ffmpeg_configuration(&settings_path)?;
    let path_value = env::var_os("PATH").unwrap_or_default();
    let path_value = path_value.to_string_lossy();
    let ffmpeg_tools_status = discover_ffmpeg_tools_status(&path_value, configuration);

    ffmpeg_tools_status
        .ffprobe
        .resolved_path
        .filter(|_| ffmpeg_tools_status.ffprobe.is_available)
        .map(PathBuf::from)
        .ok_or(ffmpeg_tools_status.ffprobe.status_message)
}

fn configured_or_discovered_ffmpeg_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let settings_path = ffmpeg_settings_path(app)?;
    let configuration = load_ffmpeg_configuration(&settings_path)?;
    let path_value = env::var_os("PATH").unwrap_or_default();
    let path_value = path_value.to_string_lossy();
    let ffmpeg_tools_status = discover_ffmpeg_tools_status(&path_value, configuration);

    ffmpeg_tools_status
        .ffmpeg
        .resolved_path
        .filter(|_| ffmpeg_tools_status.ffmpeg.is_available)
        .map(PathBuf::from)
        .ok_or(ffmpeg_tools_status.ffmpeg.status_message)
}

fn preview_strip_cache_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_cache_directory = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?;

    Ok(app_cache_directory.join(PREVIEW_STRIP_CACHE_FOLDER_NAME))
}

fn preview_strip_queue_status_from_counts(
    preview_strip_queue_state: &PreviewStripQueueState,
    queue_counts: PreviewStripQueueCounts,
) -> Result<PreviewStripQueueStatus, String> {
    let is_paused = *preview_strip_queue_state
        .is_paused
        .lock()
        .map_err(|error| error.to_string())?;
    let running_count = *preview_strip_queue_state
        .running_count
        .lock()
        .map_err(|error| error.to_string())?;

    Ok(PreviewStripQueueStatus {
        pending_count: queue_counts.pending_count,
        running_count,
        failed_count: queue_counts.failed_count,
        is_paused,
    })
}

fn preview_strip_queue_status(
    catalog_state: &CatalogState,
    preview_strip_queue_state: &PreviewStripQueueState,
) -> Result<PreviewStripQueueStatus, String> {
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;
    let queue_counts = catalog.preview_strip_queue_counts()?;

    preview_strip_queue_status_from_counts(preview_strip_queue_state, queue_counts)
}

#[tauri::command]
fn save_ffmpeg_configuration(
    app: tauri::AppHandle,
    configuration: FfmpegConfiguration,
) -> Result<FfmpegToolsStatus, String> {
    let settings_path = ffmpeg_settings_path(&app)?;

    save_ffmpeg_configuration_to_path(&settings_path, &configuration)?;

    let path_value = env::var_os("PATH").unwrap_or_default();
    let path_value = path_value.to_string_lossy();

    Ok(discover_ffmpeg_tools_status(&path_value, configuration))
}

#[tauri::command]
fn refresh_scan_root(
    app: tauri::AppHandle,
    catalog_state: tauri::State<'_, CatalogState>,
    path: String,
    video_extension_allowlist: Option<VideoExtensionAllowlist>,
) -> Result<ScanRootRefreshSummary, String> {
    {
        let catalog = catalog_state
            .catalog
            .lock()
            .map_err(|error| error.to_string())?;
        if let Some(refresh_summary) = catalog.refresh_scan_root_if_unreachable(&path)? {
            return Ok(refresh_summary);
        }
    }

    let ffprobe_path = configured_or_discovered_ffprobe_path(&app)?;
    let video_file_probe = FfprobeVideoFileProbe::new(ffprobe_path);
    let video_extension_allowlist = video_extension_allowlist.unwrap_or_default();
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;

    catalog.refresh_scan_root(&path, &video_file_probe, &video_extension_allowlist)
}

#[tauri::command]
fn refresh_all_scan_roots(
    app: tauri::AppHandle,
    catalog_state: tauri::State<'_, CatalogState>,
    video_extension_allowlist: Option<VideoExtensionAllowlist>,
) -> Result<ScanRootRefreshSummary, String> {
    let scan_roots = {
        let catalog = catalog_state
            .catalog
            .lock()
            .map_err(|error| error.to_string())?;
        catalog.list_scan_roots()?
    };
    let has_reachable_scan_root = scan_roots
        .iter()
        .any(|scan_root| Path::new(&scan_root.path).is_dir());

    if !has_reachable_scan_root {
        let catalog = catalog_state
            .catalog
            .lock()
            .map_err(|error| error.to_string())?;
        let mut refresh_summary = ScanRootRefreshSummary {
            scanned_video_count: 0,
            unprocessable_candidate_count: 0,
        };

        for scan_root in scan_roots {
            if let Some(scan_root_refresh_summary) =
                catalog.refresh_scan_root_if_unreachable(&scan_root.path)?
            {
                refresh_summary.scanned_video_count +=
                    scan_root_refresh_summary.scanned_video_count;
                refresh_summary.unprocessable_candidate_count +=
                    scan_root_refresh_summary.unprocessable_candidate_count;
            }
        }

        return Ok(refresh_summary);
    }

    let ffprobe_path = configured_or_discovered_ffprobe_path(&app)?;
    let video_file_probe = FfprobeVideoFileProbe::new(ffprobe_path);
    let video_extension_allowlist = video_extension_allowlist.unwrap_or_default();
    let catalog = catalog_state
        .catalog
        .lock()
        .map_err(|error| error.to_string())?;
    catalog.refresh_all_scan_roots(&video_file_probe, &video_extension_allowlist)
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
fn generate_missing_preview_strips(
    app: tauri::AppHandle,
    catalog_state: tauri::State<'_, CatalogState>,
) -> Result<PreviewStripGenerationSummary, String> {
    let ffmpeg_path = configured_or_discovered_ffmpeg_path(&app)?;
    let preview_cache_path = preview_strip_cache_path(&app)?;
    let preview_strip_generator = FfmpegPreviewStripGenerator::new(ffmpeg_path);
    let pending_preview_strip_requests = {
        let catalog = catalog_state
            .catalog
            .lock()
            .map_err(|error| error.to_string())?;
        catalog.pending_preview_strip_requests(&preview_cache_path)?
    };
    let mut generation_summary = PreviewStripGenerationSummary {
        generated_preview_strip_count: 0,
        failed_preview_strip_count: 0,
    };

    for request in pending_preview_strip_requests {
        match preview_strip_generator.generate_preview_strip(&request) {
            Ok(generated_preview_strip) => {
                let catalog = catalog_state
                    .catalog
                    .lock()
                    .map_err(|error| error.to_string())?;
                catalog
                    .store_generated_preview_strip(request.video_id, &generated_preview_strip)?;
                generation_summary.generated_preview_strip_count += 1;
            }
            Err(reason) => {
                let catalog = catalog_state
                    .catalog
                    .lock()
                    .map_err(|error| error.to_string())?;
                catalog.store_failed_preview_strip(request.video_id, &reason)?;
                generation_summary.failed_preview_strip_count += 1;
            }
        }
    }

    Ok(generation_summary)
}

#[tauri::command]
fn get_preview_strip_queue_status(
    catalog_state: tauri::State<'_, CatalogState>,
    preview_strip_queue_state: tauri::State<'_, PreviewStripQueueState>,
) -> Result<PreviewStripQueueStatus, String> {
    preview_strip_queue_status(&catalog_state, &preview_strip_queue_state)
}

#[tauri::command]
fn pause_preview_strip_queue(
    catalog_state: tauri::State<'_, CatalogState>,
    preview_strip_queue_state: tauri::State<'_, PreviewStripQueueState>,
) -> Result<PreviewStripQueueStatus, String> {
    *preview_strip_queue_state
        .is_paused
        .lock()
        .map_err(|error| error.to_string())? = true;

    preview_strip_queue_status(&catalog_state, &preview_strip_queue_state)
}

#[tauri::command]
fn resume_preview_strip_queue(
    catalog_state: tauri::State<'_, CatalogState>,
    preview_strip_queue_state: tauri::State<'_, PreviewStripQueueState>,
) -> Result<PreviewStripQueueStatus, String> {
    *preview_strip_queue_state
        .is_paused
        .lock()
        .map_err(|error| error.to_string())? = false;

    preview_strip_queue_status(&catalog_state, &preview_strip_queue_state)
}

#[tauri::command]
fn process_next_preview_strip_queue_item(
    app: tauri::AppHandle,
    catalog_state: tauri::State<'_, CatalogState>,
    preview_strip_queue_state: tauri::State<'_, PreviewStripQueueState>,
) -> Result<PreviewStripQueueStatus, String> {
    if *preview_strip_queue_state
        .is_paused
        .lock()
        .map_err(|error| error.to_string())?
    {
        return preview_strip_queue_status(&catalog_state, &preview_strip_queue_state);
    }

    {
        let mut running_count = preview_strip_queue_state
            .running_count
            .lock()
            .map_err(|error| error.to_string())?;
        if *running_count > 0 {
            return preview_strip_queue_status(&catalog_state, &preview_strip_queue_state);
        }
        *running_count = 1;
    }

    let generation_result = (|| {
        let ffmpeg_path = configured_or_discovered_ffmpeg_path(&app)?;
        let preview_cache_path = preview_strip_cache_path(&app)?;
        let preview_strip_generator = FfmpegPreviewStripGenerator::new(ffmpeg_path);
        let catalog = catalog_state
            .catalog
            .lock()
            .map_err(|error| error.to_string())?;
        catalog.generate_next_preview_strip(&preview_cache_path, &preview_strip_generator)
    })();

    *preview_strip_queue_state
        .running_count
        .lock()
        .map_err(|error| error.to_string())? = 0;
    generation_result?;

    preview_strip_queue_status(&catalog_state, &preview_strip_queue_state)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            initialize_catalog(app)
                .map_err(|error| Box::<dyn std::error::Error>::from(std::io::Error::other(error)))
        })
        .invoke_handler(tauri::generate_handler![
            get_local_desktop_app_status,
            list_catalog_videos,
            list_scan_roots,
            add_scan_root,
            remove_scan_root,
            forget_catalog_video,
            get_ffmpeg_tools_status,
            save_ffmpeg_configuration,
            refresh_scan_root,
            refresh_all_scan_roots,
            list_unprocessable_video_candidates,
            generate_missing_preview_strips,
            get_preview_strip_queue_status,
            pause_preview_strip_queue,
            resume_preview_strip_queue,
            process_next_preview_strip_queue_item
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use std::fs;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;

    use super::{
        discover_ffmpeg_tools_status, executable_binary_names, load_ffmpeg_configuration,
        local_desktop_app_status, save_ffmpeg_configuration_to_path, FfmpegConfiguration,
        CATALOG_DATABASE_FILENAME, PREVIEW_STRIP_CACHE_FOLDER_NAME,
    };

    #[test]
    fn local_desktop_app_status_describes_the_tauri_bridge() {
        assert_eq!(local_desktop_app_status(), "Rust command online");
    }

    #[test]
    fn catalog_database_filename_is_app_private_sqlite_storage() {
        assert_eq!(CATALOG_DATABASE_FILENAME, "catalog.sqlite3");
    }

    #[test]
    fn preview_strip_cache_folder_name_is_app_private_cache_storage() {
        assert_eq!(PREVIEW_STRIP_CACHE_FOLDER_NAME, "preview-strips");
    }

    #[test]
    fn ffmpeg_tools_status_discovers_binaries_from_path() {
        let test_bin_dir =
            std::env::temp_dir().join(format!("media-manager-ffmpeg-test-{}", std::process::id()));
        fs::create_dir_all(&test_bin_dir).expect("test bin directory should be created");
        fs::write(test_bin_dir.join("ffmpeg"), "").expect("ffmpeg test binary should exist");
        fs::write(test_bin_dir.join("ffprobe"), "").expect("ffprobe test binary should exist");
        make_test_binary_executable(&test_bin_dir.join("ffmpeg"));
        make_test_binary_executable(&test_bin_dir.join("ffprobe"));

        let ffmpeg_tools_status = discover_ffmpeg_tools_status(
            test_bin_dir.to_string_lossy().as_ref(),
            FfmpegConfiguration::default(),
        );

        assert!(ffmpeg_tools_status.ffmpeg.is_available);
        assert!(ffmpeg_tools_status.ffprobe.is_available);

        fs::remove_dir_all(test_bin_dir).expect("test bin directory should be removed");
    }

    #[cfg(unix)]
    #[test]
    fn ffmpeg_tools_status_does_not_accept_non_executable_files_from_path() {
        let test_bin_dir = std::env::temp_dir().join(format!(
            "media-manager-ffmpeg-non-executable-test-{}",
            std::process::id()
        ));
        fs::create_dir_all(&test_bin_dir).expect("test bin directory should be created");
        fs::write(test_bin_dir.join("ffmpeg"), "").expect("ffmpeg test file should exist");

        let ffmpeg_tools_status = discover_ffmpeg_tools_status(
            test_bin_dir.to_string_lossy().as_ref(),
            FfmpegConfiguration::default(),
        );

        assert!(!ffmpeg_tools_status.ffmpeg.is_available);

        fs::remove_dir_all(test_bin_dir).expect("test bin directory should be removed");
    }

    #[test]
    fn executable_binary_names_include_windows_exe_candidate() {
        let binary_names = executable_binary_names("ffmpeg");

        assert!(binary_names.contains(&"ffmpeg".to_string()));
        assert!(binary_names.contains(&"ffmpeg.exe".to_string()));
    }

    #[test]
    fn ffmpeg_tools_status_discovers_windows_exe_binary_from_path() {
        let test_bin_dir = std::env::temp_dir().join(format!(
            "media-manager-ffmpeg-windows-path-test-{}",
            std::process::id()
        ));
        fs::create_dir_all(&test_bin_dir).expect("test bin directory should be created");
        fs::write(test_bin_dir.join("ffmpeg.exe"), "")
            .expect("ffmpeg exe test binary should exist");
        make_test_binary_executable(&test_bin_dir.join("ffmpeg.exe"));

        let ffmpeg_tools_status = discover_ffmpeg_tools_status(
            test_bin_dir.to_string_lossy().as_ref(),
            FfmpegConfiguration::default(),
        );

        assert!(ffmpeg_tools_status.ffmpeg.is_available);

        fs::remove_dir_all(test_bin_dir).expect("test bin directory should be removed");
    }

    #[test]
    fn ffmpeg_tools_status_reports_missing_configured_binary_without_crashing() {
        let configuration = FfmpegConfiguration {
            ffmpeg_path: Some("/definitely/missing/ffmpeg".to_string()),
            ffprobe_path: None,
        };

        let ffmpeg_tools_status = discover_ffmpeg_tools_status("", configuration);

        assert!(!ffmpeg_tools_status.ffmpeg.is_available);
        assert_eq!(
            ffmpeg_tools_status.ffmpeg.status_message,
            "ffmpeg was not found at the configured path"
        );
    }

    #[test]
    fn ffmpeg_configuration_round_trips_through_settings_file() {
        let settings_dir = std::env::temp_dir().join(format!(
            "media-manager-ffmpeg-settings-test-{}",
            std::process::id()
        ));
        let settings_path = settings_dir.join("ffmpeg-settings.json");
        let configuration = FfmpegConfiguration {
            ffmpeg_path: Some("/usr/local/bin/ffmpeg".to_string()),
            ffprobe_path: Some("/usr/local/bin/ffprobe".to_string()),
        };

        save_ffmpeg_configuration_to_path(&settings_path, &configuration)
            .expect("settings should be saved");
        let saved_configuration =
            load_ffmpeg_configuration(&settings_path).expect("settings should be loaded");

        assert_eq!(saved_configuration, configuration);

        fs::remove_dir_all(settings_dir).expect("settings directory should be removed");
    }

    #[cfg(unix)]
    fn make_test_binary_executable(path: &std::path::Path) {
        let mut permissions = fs::metadata(path)
            .expect("test binary metadata should be available")
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(path, permissions).expect("test binary should be executable");
    }

    #[cfg(not(unix))]
    fn make_test_binary_executable(_path: &std::path::Path) {}
}
