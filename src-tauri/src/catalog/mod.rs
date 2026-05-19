use std::{
    collections::{HashMap, HashSet},
    fs,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::Duration,
};

use rusqlite::{params, Connection, OptionalExtension, Row, Transaction};
use serde::{Deserialize, Serialize};

mod local_metadata;
mod metadata_suggestions;
mod migrations;
mod preview_strips;
mod scan_refresh;
mod scan_roots;
mod videos;

const FINGERPRINT_VERSION: i64 = 1;
const DEFAULT_VIDEO_EXTENSIONS: [&str; 7] = ["flv", "mp4", "mov", "mkv", "avi", "webm", "m4v"];
const FINGERPRINT_SAMPLE_SIZE_BYTES: usize = 64 * 1024;
const FNV_OFFSET_BASIS: u64 = 14_695_981_039_346_656_037;
const FNV_PRIME: u64 = 1_099_511_628_211;

const DEFAULT_PREVIEW_STRIP_FRAME_COUNT: i64 = 40;
const PREVIEW_STRIP_COLUMNS: i64 = 5;
const PREVIEW_STRIP_FRAME_WIDTH_PIXELS: i64 = 640;
pub(super) const DEFAULT_IGNORED_EXACT_YEAR_START: i64 = 1900;
pub(super) const DEFAULT_IGNORED_EXACT_YEAR_END: i64 = 2099;
const DEFAULT_IGNORED_FOLDER_NAMES: [&str; 10] = [
    "Misc",
    "Unsorted",
    "To Sort",
    "To Review",
    "New",
    "Temp",
    "Archive",
    "Archives",
    "Downloads",
    "Videos",
];
pub const PREVIEW_STRIP_GENERATION_CANCELLED_REASON: &str =
    "Preview Strip generation cancelled by the user";

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogVideo {
    pub id: i64,
    pub title: String,
    pub duration_milliseconds: i64,
    pub file_size_bytes: Option<i64>,
    pub file_location_path: Option<String>,
    pub file_locations: Vec<CatalogVideoFileLocation>,
    pub is_available: bool,
    pub is_favorite: bool,
    pub last_opened_at: Option<String>,
    pub open_count: i64,
    pub preview_strip: PreviewStripStatus,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogVideoFileLocation {
    pub path: String,
    pub file_size_bytes: i64,
    pub is_preferred: bool,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum PreviewStripStatus {
    #[serde(rename_all = "camelCase")]
    Generated {
        path: String,
        frame_count: i64,
        column_count: i64,
        row_count: i64,
    },
    #[serde(rename_all = "camelCase")]
    Failed {
        failure_reason: String,
    },
    Pending,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRoot {
    pub path: String,
    pub is_available: bool,
    pub last_scan_completed_at: Option<String>,
    pub inference_rules: ScanRootInferenceRules,
}

#[derive(Debug, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRootInferenceRules {
    pub suggest_tags_from_folder_names: bool,
    pub suggest_tags_from_filename_brackets: bool,
    pub ignored_folder_names: Vec<String>,
    pub ignored_exact_year_range: ExactYearRange,
}

#[derive(Debug, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExactYearRange {
    pub start_year: i64,
    pub end_year: i64,
}

impl Default for ScanRootInferenceRules {
    fn default() -> Self {
        ScanRootInferenceRules {
            suggest_tags_from_folder_names: true,
            suggest_tags_from_filename_brackets: true,
            ignored_folder_names: default_ignored_folder_names(),
            ignored_exact_year_range: ExactYearRange {
                start_year: DEFAULT_IGNORED_EXACT_YEAR_START,
                end_year: DEFAULT_IGNORED_EXACT_YEAR_END,
            },
        }
    }
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnprocessableVideoCandidate {
    pub path: String,
    pub reason: String,
    pub file_size_bytes: i64,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnprocessableVideoCandidateGroup {
    pub scan_root_path: String,
    pub candidate_count: i64,
    pub candidates: Vec<UnprocessableVideoCandidate>,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRootRefreshSummary {
    pub scanned_video_count: i64,
    pub unprocessable_candidate_count: i64,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ScanRootRefreshStatus {
    Discovery,
    Scanning,
    MetadataSuggestionUpdate,
    Complete,
    Cancelled,
    Failed,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRootRefreshProgress {
    pub scan_root_path: String,
    pub status: ScanRootRefreshStatus,
    pub processed_video_candidate_count: i64,
    pub total_video_candidate_count: Option<i64>,
    pub scanned_video_count: i64,
    pub unprocessable_candidate_count: i64,
    pub message: Option<String>,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewStripGenerationSummary {
    pub generated_preview_strip_count: i64,
    pub failed_preview_strip_count: i64,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewStripQueueCounts {
    pub pending_count: i64,
    pub failed_count: i64,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FailedPreviewStrip {
    pub video_id: i64,
    pub title: String,
    pub failure_reason: String,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataSuggestionGroup {
    pub suggested_value: String,
    pub suggestion_kind: String,
    pub sources: Vec<MetadataSuggestionSourceGroup>,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataSuggestionSourceGroup {
    pub scan_root_path: String,
    pub source_path_segment: String,
    pub videos: Vec<MetadataSuggestionVideo>,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataSuggestionVideo {
    pub video_id: i64,
    pub title: String,
    pub file_location_path: String,
}

#[derive(Debug, PartialEq, Eq, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogTag {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, PartialEq, Eq, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogPerformer {
    pub id: i64,
    pub name: String,
}

struct CatalogMetadataValue {
    id: i64,
    name: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PreviewStripRetryReason {
    Manual,
    FfmpegConfigurationChanged,
}

pub struct PreviewStripRequest {
    pub video_id: i64,
    pub video_path: PathBuf,
    pub output_path: PathBuf,
    pub duration_milliseconds: i64,
    pub frame_count: i64,
}

pub struct GeneratedPreviewStrip {
    pub path: PathBuf,
    pub frame_count: i64,
    pub column_count: i64,
    pub row_count: i64,
}

pub trait PreviewStripGenerator {
    fn generate_preview_strip(
        &self,
        request: &PreviewStripRequest,
    ) -> Result<GeneratedPreviewStrip, String>;
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VideoExtensionAllowlist {
    extensions: Vec<String>,
}

pub struct VideoProbe {
    pub duration_milliseconds: i64,
}

pub trait VideoFileProbe {
    fn probe_video_file(&self, video_path: &Path) -> Result<VideoProbe, String>;
}

pub struct FfprobeVideoFileProbe {
    ffprobe_path: PathBuf,
}

impl FfprobeVideoFileProbe {
    pub fn new(ffprobe_path: PathBuf) -> Self {
        Self { ffprobe_path }
    }
}

impl VideoFileProbe for FfprobeVideoFileProbe {
    fn probe_video_file(&self, video_path: &Path) -> Result<VideoProbe, String> {
        let output = Command::new(&self.ffprobe_path)
            .args([
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
            ])
            .arg(video_path)
            .output()
            .map_err(|error| error.to_string())?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(if stderr.is_empty() {
                "ffprobe could not read Duration".to_string()
            } else {
                stderr
            });
        }

        let duration_seconds = String::from_utf8_lossy(&output.stdout)
            .trim()
            .parse::<f64>()
            .map_err(|error| error.to_string())?;

        Ok(VideoProbe {
            duration_milliseconds: (duration_seconds * 1000.0).round() as i64,
        })
    }
}

pub struct Catalog {
    database: Connection,
}

pub struct FfmpegPreviewStripGenerator {
    ffmpeg_path: PathBuf,
    stop_requested: Arc<AtomicBool>,
}

impl FfmpegPreviewStripGenerator {
    pub fn new(ffmpeg_path: PathBuf, stop_requested: Arc<AtomicBool>) -> Self {
        Self {
            ffmpeg_path,
            stop_requested,
        }
    }
}

impl PreviewStripGenerator for FfmpegPreviewStripGenerator {
    fn generate_preview_strip(
        &self,
        request: &PreviewStripRequest,
    ) -> Result<GeneratedPreviewStrip, String> {
        if let Some(output_directory) = request.output_path.parent() {
            fs::create_dir_all(output_directory).map_err(|error| error.to_string())?;
        }

        let duration_seconds = request.duration_milliseconds as f64 / 1000.0;
        let frame_count = request.frame_count as f64;
        let timeline_inset_seconds = duration_seconds / (frame_count + 1.0);
        let sampled_duration_seconds =
            (duration_seconds - (timeline_inset_seconds * 2.0)).max(timeline_inset_seconds);
        let tile_rows = (request.frame_count + PREVIEW_STRIP_COLUMNS - 1) / PREVIEW_STRIP_COLUMNS;
        let video_filter = format!(
            "fps={}/{sampled_duration_seconds},scale={PREVIEW_STRIP_FRAME_WIDTH_PIXELS}:-1,tile={PREVIEW_STRIP_COLUMNS}x{tile_rows}",
            request.frame_count
        );
        let video_id_comment = format!("comment=Video ID {}", request.video_id);

        let mut child = Command::new(&self.ffmpeg_path)
            .args(["-y", "-ss", &timeline_inset_seconds.to_string()])
            .args(["-t", &sampled_duration_seconds.to_string()])
            .arg("-i")
            .arg(&request.video_path)
            .args(["-metadata", &video_id_comment])
            .args(["-frames:v", "1", "-vf", &video_filter])
            .arg(&request.output_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| error.to_string())?;

        loop {
            if self.stop_requested.load(Ordering::SeqCst) {
                let _ = child.kill();
                let _ = child.wait();
                return Err(PREVIEW_STRIP_GENERATION_CANCELLED_REASON.to_string());
            }

            if child
                .try_wait()
                .map_err(|error| error.to_string())?
                .is_some()
            {
                break;
            }

            thread::sleep(Duration::from_millis(100));
        }

        let output = child
            .wait_with_output()
            .map_err(|error| error.to_string())?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(if stderr.is_empty() {
                "ffmpeg could not generate Preview Strip".to_string()
            } else {
                stderr
            });
        }

        Ok(GeneratedPreviewStrip {
            path: request.output_path.clone(),
            frame_count: request.frame_count,
            column_count: PREVIEW_STRIP_COLUMNS,
            row_count: tile_rows,
        })
    }
}

impl Catalog {
    pub fn open(catalog_path: &Path) -> Result<Self, String> {
        let database = Connection::open(catalog_path).map_err(|error| error.to_string())?;
        database
            .execute_batch("PRAGMA foreign_keys = ON;")
            .map_err(|error| error.to_string())?;

        migrations::run_migrations(&database)?;

        Ok(Self { database })
    }
}

struct PendingPreviewStrip {
    video_id: i64,
    duration_milliseconds: i64,
    video_path: String,
}

struct NormalizedMetadataName {
    display_name: String,
    normalized_name: String,
}

struct AcceptedMetadataSuggestionMapping {
    scan_root_id: i64,
    normalized_suggested_value: String,
    suggestion_kind: String,
    accepted_tag_id: Option<i64>,
    accepted_performer_id: Option<i64>,
}

impl AcceptedMetadataSuggestionMapping {
    fn new(
        scan_root_id: i64,
        suggested_value: &str,
        suggestion_kind: &str,
        metadata_kind: &str,
        metadata_value_id: i64,
    ) -> Result<Self, String> {
        let metadata_name = normalized_metadata_input(suggested_value)?;
        let (accepted_tag_id, accepted_performer_id) = match metadata_kind {
            "tag" => (Some(metadata_value_id), None),
            "performer" => (None, Some(metadata_value_id)),
            _ => return Err("Metadata Suggestion kind is not supported".to_string()),
        };

        Ok(Self {
            scan_root_id,
            normalized_suggested_value: metadata_name.normalized_name,
            suggestion_kind: suggestion_kind.to_string(),
            accepted_tag_id,
            accepted_performer_id,
        })
    }

    fn accepted_metadata_kind(&self) -> &'static str {
        if self.accepted_tag_id.is_some() {
            "tag"
        } else {
            "performer"
        }
    }

    fn accepted_metadata_id(&self) -> i64 {
        self.accepted_tag_id
            .or(self.accepted_performer_id)
            .expect("mapping has one accepted metadata id")
    }
}

fn normalized_metadata_input(name: &str) -> Result<NormalizedMetadataName, String> {
    let display_name = name.trim().to_string();
    if display_name.is_empty() {
        return Err("Metadata name cannot be empty".to_string());
    }

    Ok(NormalizedMetadataName {
        normalized_name: display_name.to_lowercase(),
        display_name,
    })
}

fn metadata_value_id_for_suggestion(
    transaction: &Transaction<'_>,
    suggestion_kind: &str,
    suggested_value: &str,
) -> Result<i64, String> {
    match suggestion_kind {
        "tag" => metadata_value_id_for_suggestion_table(transaction, "tags", suggested_value),
        "performer" => {
            metadata_value_id_for_suggestion_table(transaction, "performers", suggested_value)
        }
        _ => Err("Metadata Suggestion kind is not supported".to_string()),
    }
}

fn metadata_value_id_for_suggestion_table(
    transaction: &Transaction<'_>,
    table_name: &str,
    suggested_value: &str,
) -> Result<i64, String> {
    let metadata_name = normalized_metadata_input(suggested_value)?;
    let query = format!(
        "SELECT id
         FROM {table_name}
         WHERE normalized_name = ?1"
    );
    let existing_metadata_id = transaction
        .query_row(&query, params![metadata_name.normalized_name], |row| {
            row.get(0)
        })
        .optional()
        .map_err(|error| error.to_string())?;

    match existing_metadata_id {
        Some(metadata_id) => Ok(metadata_id),
        None => {
            let insert_query = format!(
                "INSERT INTO {table_name} (name, normalized_name)
                 VALUES (?1, ?2)"
            );
            transaction
                .execute(
                    &insert_query,
                    params![metadata_name.display_name, metadata_name.normalized_name],
                )
                .map_err(|error| error.to_string())?;

            Ok(transaction.last_insert_rowid())
        }
    }
}

fn attach_metadata_suggestion_to_video(
    transaction: &Transaction<'_>,
    suggestion_kind: &str,
    metadata_value_id: i64,
    video_id: i64,
) -> Result<(), String> {
    let (table_name, metadata_id_column) = match suggestion_kind {
        "tag" => ("tag_videos", "tag_id"),
        "performer" => ("performer_videos", "performer_id"),
        _ => return Err("Metadata Suggestion kind is not supported".to_string()),
    };
    let query = format!(
        "INSERT OR IGNORE INTO {table_name} ({metadata_id_column}, video_id)
         VALUES (?1, ?2)"
    );
    transaction
        .execute(&query, params![metadata_value_id, video_id])
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn attach_mapped_metadata_suggestion_to_video(
    transaction: &Transaction<'_>,
    suggestion_mapping: &AcceptedMetadataSuggestionMapping,
    video_id: i64,
) -> Result<(), String> {
    attach_metadata_suggestion_to_video(
        transaction,
        suggestion_mapping.accepted_metadata_kind(),
        suggestion_mapping.accepted_metadata_id(),
        video_id,
    )
}

fn pending_metadata_suggestion_source_path_segments(
    transaction: &Transaction<'_>,
    scan_root_id: i64,
    video_id: i64,
    suggested_value: &str,
    source_path_segment: &str,
    suggestion_kind: &str,
) -> Result<Vec<String>, String> {
    let mut statement = transaction
        .prepare(
            "SELECT source_path_segment
             FROM metadata_suggestions
             WHERE scan_root_id = ?1
               AND video_id = ?2
               AND lower(suggested_value) = lower(?3)
               AND source_path_segment = ?4
               AND suggestion_kind = ?5
               AND accepted_at IS NULL
               AND rejected_at IS NULL
             ORDER BY source_path_segment",
        )
        .map_err(|error| error.to_string())?;

    let source_path_segments = statement
        .query_map(
            params![
                scan_root_id,
                video_id,
                suggested_value,
                source_path_segment,
                suggestion_kind
            ],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(source_path_segments)
}

fn remember_metadata_suggestion_mapping(
    transaction: &Transaction<'_>,
    suggestion_mapping: &AcceptedMetadataSuggestionMapping,
    source_path_segment: &str,
) -> Result<(), String> {
    transaction
        .execute(
            "INSERT INTO metadata_suggestion_mappings (
                scan_root_id,
                source_path_segment,
                normalized_suggested_value,
                suggestion_kind,
                accepted_tag_id,
                accepted_performer_id
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT (
                scan_root_id,
                source_path_segment,
                normalized_suggested_value,
                suggestion_kind
             )
             DO UPDATE SET
                accepted_tag_id = excluded.accepted_tag_id,
                accepted_performer_id = excluded.accepted_performer_id,
                updated_at = CURRENT_TIMESTAMP",
            params![
                suggestion_mapping.scan_root_id,
                source_path_segment,
                suggestion_mapping.normalized_suggested_value,
                suggestion_mapping.suggestion_kind,
                suggestion_mapping.accepted_tag_id,
                suggestion_mapping.accepted_performer_id,
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn mapped_metadata_suggestion(
    transaction: &Transaction<'_>,
    scan_root_id: i64,
    source_path_segment: &str,
    suggested_value: &str,
    suggestion_kind: &str,
) -> Result<Option<AcceptedMetadataSuggestionMapping>, String> {
    let metadata_name = normalized_metadata_input(suggested_value)?;
    transaction
        .query_row(
            "SELECT accepted_tag_id, accepted_performer_id
             FROM metadata_suggestion_mappings
             WHERE scan_root_id = ?1
               AND source_path_segment = ?2
               AND normalized_suggested_value = ?3
               AND suggestion_kind = ?4
             LIMIT 1",
            params![
                scan_root_id,
                source_path_segment,
                metadata_name.normalized_name,
                suggestion_kind
            ],
            |row| {
                Ok(AcceptedMetadataSuggestionMapping {
                    scan_root_id,
                    normalized_suggested_value: metadata_name.normalized_name.clone(),
                    suggestion_kind: suggestion_kind.to_string(),
                    accepted_tag_id: row.get(0)?,
                    accepted_performer_id: row.get(1)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn catalog_tag_from_value(metadata_value: CatalogMetadataValue) -> CatalogTag {
    CatalogTag {
        id: metadata_value.id,
        name: metadata_value.name,
    }
}

fn catalog_tags_from_values(metadata_values: Vec<CatalogMetadataValue>) -> Vec<CatalogTag> {
    metadata_values
        .into_iter()
        .map(catalog_tag_from_value)
        .collect()
}

fn catalog_performer_from_value(metadata_value: CatalogMetadataValue) -> CatalogPerformer {
    CatalogPerformer {
        id: metadata_value.id,
        name: metadata_value.name,
    }
}

fn catalog_performers_from_values(
    metadata_values: Vec<CatalogMetadataValue>,
) -> Vec<CatalogPerformer> {
    metadata_values
        .into_iter()
        .map(catalog_performer_from_value)
        .collect()
}

fn normalized_video_title(title: &str) -> Result<String, String> {
    let video_title = title.trim().to_string();
    if video_title.is_empty() {
        return Err("Video Title cannot be empty".to_string());
    }

    Ok(video_title)
}

fn preview_strip_status_from_row(
    row: &Row<'_>,
    preview_strip_column_index: usize,
) -> rusqlite::Result<PreviewStripStatus> {
    let preview_strip_path: Option<String> = row.get(preview_strip_column_index)?;

    if let Some(path) = preview_strip_path {
        return Ok(PreviewStripStatus::Generated {
            path,
            frame_count: row.get(preview_strip_column_index + 1)?,
            column_count: row.get(preview_strip_column_index + 2)?,
            row_count: row.get(preview_strip_column_index + 3)?,
        });
    }

    let failure_reason: Option<String> = row.get(preview_strip_column_index + 4)?;

    Ok(match failure_reason {
        Some(failure_reason) => PreviewStripStatus::Failed { failure_reason },
        None => PreviewStripStatus::Pending,
    })
}

fn canonical_scan_root_path(scan_root_path: &Path) -> std::io::Result<PathBuf> {
    scan_root_path.canonicalize()
}

impl Default for VideoExtensionAllowlist {
    fn default() -> Self {
        Self {
            extensions: DEFAULT_VIDEO_EXTENSIONS
                .iter()
                .map(|extension| extension.to_string())
                .collect(),
        }
    }
}

impl VideoExtensionAllowlist {
    fn normalized_extensions(&self) -> HashSet<String> {
        self.extensions
            .iter()
            .map(|extension| extension.trim_start_matches('.').to_ascii_lowercase())
            .collect()
    }
}

fn discover_video_candidate_paths(
    scan_root_path: &Path,
    video_extension_allowlist: &VideoExtensionAllowlist,
) -> Result<Vec<PathBuf>, String> {
    let allowed_extensions = video_extension_allowlist.normalized_extensions();
    let mut video_candidate_paths = Vec::new();
    discover_video_candidate_paths_recursively(
        scan_root_path,
        &allowed_extensions,
        &mut video_candidate_paths,
    )?;
    video_candidate_paths.sort();

    Ok(video_candidate_paths)
}

fn discover_video_candidate_paths_recursively(
    folder_path: &Path,
    allowed_extensions: &HashSet<String>,
    video_candidate_paths: &mut Vec<PathBuf>,
) -> Result<(), String> {
    const HIDDEN_FILE_PREFIX: char = '.';

    for directory_entry in fs::read_dir(folder_path).map_err(|error| error.to_string())? {
        let directory_entry = directory_entry.map_err(|error| error.to_string())?;
        let candidate_name = directory_entry.file_name();
        let is_hidden_candidate = candidate_name
            .to_str()
            .map(|candidate_name| candidate_name.starts_with(HIDDEN_FILE_PREFIX))
            .unwrap_or(false);
        if is_hidden_candidate {
            continue;
        }

        let candidate_path = directory_entry.path();
        let file_type = directory_entry
            .file_type()
            .map_err(|error| error.to_string())?;

        if file_type.is_dir() {
            discover_video_candidate_paths_recursively(
                &candidate_path,
                allowed_extensions,
                video_candidate_paths,
            )?;
        } else if file_type.is_file()
            && candidate_path
                .extension()
                .and_then(|extension| extension.to_str())
                .map(|extension| allowed_extensions.contains(&extension.to_ascii_lowercase()))
                .unwrap_or(false)
        {
            video_candidate_paths.push(
                candidate_path
                    .canonicalize()
                    .map_err(|error| error.to_string())?,
            );
        }
    }

    Ok(())
}

fn file_size_bytes(video_path: &Path) -> Result<i64, String> {
    let file_size_bytes = video_path
        .metadata()
        .map_err(|error| error.to_string())?
        .len();
    i64::try_from(file_size_bytes).map_err(|error| error.to_string())
}

fn video_title(video_path: &Path) -> Result<String, String> {
    let file_stem = video_path
        .file_stem()
        .and_then(|file_name| file_name.to_str())
        .ok_or_else(|| "Video Title could not be read from filename".to_string())?;

    Ok(cleaned_video_title_from_file_stem(file_stem))
}

fn cleaned_video_title_from_file_stem(file_stem: &str) -> String {
    let original_title = file_stem.trim();
    let title_without_brackets = remove_square_bracket_chunks(original_title);
    let title_without_capture_suffixes = remove_capture_suffixes(&title_without_brackets);
    let title_without_technical_tokens =
        remove_separator_boundary_technical_tokens(&title_without_capture_suffixes);
    let cleaned_title = normalized_title_cleanup_artifacts(&title_without_technical_tokens);

    if cleaned_title.is_empty() {
        original_title.to_string()
    } else {
        cleaned_title
    }
}

fn remove_square_bracket_chunks(title: &str) -> String {
    let mut title_without_brackets = String::new();
    let mut remaining_title = title;

    while let Some(open_index) = remaining_title.find('[') {
        title_without_brackets.push_str(&remaining_title[..open_index]);
        let after_open_bracket = &remaining_title[open_index + 1..];
        let Some(close_index) = after_open_bracket.find(']') else {
            title_without_brackets.push_str(&remaining_title[open_index..]);
            return title_without_brackets;
        };
        title_without_brackets.push(' ');
        remaining_title = &after_open_bracket[close_index + 1..];
    }

    title_without_brackets.push_str(remaining_title);
    title_without_brackets
}

fn remove_capture_suffixes(title: &str) -> String {
    let title_without_site_suffix = title
        .strip_suffix(" - Pornhub.com")
        .or_else(|| title.strip_suffix(" - Pornhubcom"))
        .unwrap_or(title);

    remove_google_chrome_capture_suffix(title_without_site_suffix)
}

fn remove_google_chrome_capture_suffix(title: &str) -> String {
    const GOOGLE_CHROME_CAPTURE_PREFIX: &str = " - Google Chrome ";
    const GOOGLE_CHROME_CAPTURE_TIMESTAMP_LENGTH: usize = "YYYY-MM-DD HH-MM-SS".len();

    let Some(capture_prefix_index) = title.rfind(GOOGLE_CHROME_CAPTURE_PREFIX) else {
        return title.to_string();
    };
    let capture_timestamp = &title[capture_prefix_index + GOOGLE_CHROME_CAPTURE_PREFIX.len()..];
    if capture_timestamp.len() != GOOGLE_CHROME_CAPTURE_TIMESTAMP_LENGTH {
        return title.to_string();
    }
    if !is_google_chrome_capture_timestamp(capture_timestamp) {
        return title.to_string();
    }

    title[..capture_prefix_index].to_string()
}

fn is_google_chrome_capture_timestamp(capture_timestamp: &str) -> bool {
    capture_timestamp
        .chars()
        .enumerate()
        .all(|(index, character)| match index {
            4 | 7 => character == '-',
            10 => character == ' ',
            13 | 16 => character == '-',
            _ => character.is_ascii_digit(),
        })
}

fn remove_separator_boundary_technical_tokens(title: &str) -> String {
    let title_without_separator_tokens = title
        .split(" - ")
        .map(str::trim)
        .filter(|title_segment| !title_segment.is_empty())
        .filter(|title_segment| !is_technical_filename_token(title_segment))
        .collect::<Vec<_>>()
        .join(" - ");

    remove_title_edge_technical_tokens(&title_without_separator_tokens)
}

fn remove_title_edge_technical_tokens(title: &str) -> String {
    let mut cleaned_title = title.trim().to_string();

    loop {
        let title_before_cleanup = cleaned_title.clone();
        cleaned_title = remove_leading_title_edge_technical_token(&cleaned_title);
        cleaned_title = remove_trailing_title_edge_technical_token(&cleaned_title);

        if cleaned_title == title_before_cleanup {
            return cleaned_title;
        }
    }
}

fn remove_leading_title_edge_technical_token(title: &str) -> String {
    for (separator_index, separator) in title.char_indices() {
        if !is_title_edge_separator(separator) {
            continue;
        }

        let leading_token = title[..separator_index].trim();
        if is_title_edge_technical_filename_token(leading_token, separator) {
            return title[separator_index + separator.len_utf8()..]
                .trim()
                .to_string();
        }
        return title.to_string();
    }

    title.to_string()
}

fn remove_trailing_title_edge_technical_token(title: &str) -> String {
    for (separator_index, separator) in title.char_indices().rev() {
        if !is_title_edge_separator(separator) {
            continue;
        }

        let trailing_token = title[separator_index + separator.len_utf8()..].trim();
        if is_title_edge_technical_filename_token(trailing_token, separator) {
            return title[..separator_index].trim().to_string();
        }
        return title.to_string();
    }

    title.to_string()
}

fn is_title_edge_separator(separator: char) -> bool {
    matches!(separator, ' ' | '_')
}

fn is_title_edge_technical_filename_token(title_segment: &str, separator: char) -> bool {
    if separator == ' ' {
        return is_whitespace_boundary_technical_filename_token(title_segment);
    }

    is_technical_filename_token(title_segment)
}

fn is_whitespace_boundary_technical_filename_token(title_segment: &str) -> bool {
    let normalized_title_segment = title_segment.trim().to_ascii_lowercase();

    !matches!(normalized_title_segment.as_str(), "4k" | "8k")
        && is_technical_filename_token(title_segment)
}

fn normalized_title_cleanup_artifacts(title: &str) -> String {
    let mut collapsed_spaces = title.split_whitespace().collect::<Vec<_>>().join(" ");
    while collapsed_spaces.contains(" - - ") {
        collapsed_spaces = collapsed_spaces.replace(" - - ", " - ");
    }
    let title_segments = collapsed_spaces
        .split(" - ")
        .map(str::trim)
        .map(|title_segment| title_segment.trim_matches('-').trim())
        .filter(|title_segment| !title_segment.is_empty())
        .collect::<Vec<_>>();

    title_segments.join(" - ")
}

fn video_fingerprint(
    video_path: &Path,
    file_size_bytes: i64,
    duration_milliseconds: i64,
) -> Result<String, String> {
    let first_sample_hash = content_sample_hash(video_path, SeekFrom::Start(0))?;
    let last_sample_offset = (file_size_bytes - FINGERPRINT_SAMPLE_SIZE_BYTES as i64).max(0) as u64;
    let last_sample_hash = content_sample_hash(video_path, SeekFrom::Start(last_sample_offset))?;

    Ok(format!(
        "v{FINGERPRINT_VERSION}:{file_size_bytes}:{duration_milliseconds}:{first_sample_hash:016x}:{last_sample_hash:016x}"
    ))
}

fn content_sample_hash(video_path: &Path, sample_offset: SeekFrom) -> Result<u64, String> {
    let mut video_file = fs::File::open(video_path).map_err(|error| error.to_string())?;
    let mut sample_buffer = vec![0; FINGERPRINT_SAMPLE_SIZE_BYTES];

    video_file
        .seek(sample_offset)
        .map_err(|error| error.to_string())?;
    let bytes_read = video_file
        .read(&mut sample_buffer)
        .map_err(|error| error.to_string())?;

    Ok(fnv1a_hash(&sample_buffer[..bytes_read]))
}

fn fnv1a_hash(bytes: &[u8]) -> u64 {
    bytes.iter().fold(FNV_OFFSET_BASIS, |hash, byte| {
        let hash_with_byte = hash ^ u64::from(*byte);

        hash_with_byte.wrapping_mul(FNV_PRIME)
    })
}

fn default_ignored_folder_names() -> Vec<String> {
    DEFAULT_IGNORED_FOLDER_NAMES
        .iter()
        .map(|ignored_folder_name| ignored_folder_name.to_string())
        .collect()
}

fn scan_root_inference_rules_from_row(row: &Row<'_>) -> rusqlite::Result<ScanRootInferenceRules> {
    let ignored_folder_names_text: String = row.get(4)?;
    let ignored_folder_names = ignored_folder_names_from_json(ignored_folder_names_text)?;

    Ok(ScanRootInferenceRules {
        suggest_tags_from_folder_names: row.get::<_, i64>(2)? == 1,
        suggest_tags_from_filename_brackets: row.get::<_, i64>(3)? == 1,
        ignored_folder_names,
        ignored_exact_year_range: ExactYearRange {
            start_year: row.get(5)?,
            end_year: row.get(6)?,
        },
    })
}

fn ignored_folder_names_from_json(
    ignored_folder_names_text: String,
) -> rusqlite::Result<Vec<String>> {
    serde_json::from_str(&ignored_folder_names_text).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(
            ignored_folder_names_text.len(),
            rusqlite::types::Type::Text,
            Box::new(error),
        )
    })
}

struct MetadataSuggestionRow {
    suggested_value: String,
    normalized_suggested_value: String,
    suggestion_kind: String,
    scan_root_path: String,
    source_path_segment: String,
    video_id: i64,
    title: String,
    file_location_path: String,
    inference_rules: ScanRootInferenceRules,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct FilenameBracketTagSuggestion {
    pub source: String,
    pub suggested_value: String,
}

fn group_metadata_suggestions(
    suggestion_rows: Vec<MetadataSuggestionRow>,
) -> Vec<MetadataSuggestionGroup> {
    let mut suggestion_groups = Vec::new();

    for suggestion_row in suggestion_rows {
        if !metadata_suggestion_sources_for_path(
            &suggestion_row.scan_root_path,
            &suggestion_row.file_location_path,
            &suggestion_row.inference_rules,
        )
        .iter()
        .any(|source| source.source_path_segment == suggestion_row.source_path_segment)
        {
            continue;
        }

        let needs_new_group = suggestion_groups
            .last()
            .map(|suggestion_group: &MetadataSuggestionGroup| {
                suggestion_group.suggested_value.to_lowercase()
                    != suggestion_row.normalized_suggested_value
                    || suggestion_group.suggestion_kind != suggestion_row.suggestion_kind
            })
            .unwrap_or(true);

        if needs_new_group {
            suggestion_groups.push(MetadataSuggestionGroup {
                suggested_value: suggestion_row.suggested_value.clone(),
                suggestion_kind: suggestion_row.suggestion_kind.clone(),
                sources: Vec::new(),
            });
        }

        let suggestion_group = suggestion_groups
            .last_mut()
            .expect("metadata suggestion group exists");
        if suggestion_row.suggested_value < suggestion_group.suggested_value {
            suggestion_group.suggested_value = suggestion_row.suggested_value.clone();
        }
        let needs_new_source = suggestion_group
            .sources
            .last()
            .map(|source_group| {
                source_group.scan_root_path != suggestion_row.scan_root_path
                    || source_group.source_path_segment != suggestion_row.source_path_segment
            })
            .unwrap_or(true);

        if needs_new_source {
            suggestion_group
                .sources
                .push(MetadataSuggestionSourceGroup {
                    scan_root_path: suggestion_row.scan_root_path.clone(),
                    source_path_segment: suggestion_row.source_path_segment.clone(),
                    videos: Vec::new(),
                });
        }

        let source_group = suggestion_group
            .sources
            .last_mut()
            .expect("metadata suggestion source group exists");
        source_group.videos.push(MetadataSuggestionVideo {
            video_id: suggestion_row.video_id,
            title: suggestion_row.title,
            file_location_path: suggestion_row.file_location_path,
        });
    }

    suggestion_groups
}

struct MetadataSuggestionSource {
    source_path_segment: String,
    suggested_value: String,
    origin: MetadataSuggestionSourceOrigin,
}

enum MetadataSuggestionSourceOrigin {
    FilenameBracket,
    FolderName,
}

fn metadata_suggestion_sources_for_path(
    scan_root_path: &str,
    video_path: &str,
    inference_rules: &ScanRootInferenceRules,
) -> Vec<MetadataSuggestionSource> {
    let mut suggestion_sources = Vec::new();

    suggestion_sources.extend(
        metadata_suggestion_segments(scan_root_path, video_path, inference_rules)
            .into_iter()
            .map(|folder_segment| MetadataSuggestionSource {
                suggested_value: metadata_suggestion_display_value(&folder_segment),
                source_path_segment: folder_segment,
                origin: MetadataSuggestionSourceOrigin::FolderName,
            }),
    );

    if inference_rules.suggest_tags_from_filename_brackets {
        let filename = Path::new(video_path)
            .file_name()
            .and_then(|filename| filename.to_str())
            .unwrap_or_default();
        suggestion_sources.extend(
            suggested_tags_from_filename_brackets(filename, inference_rules)
                .into_iter()
                .map(|suggestion| MetadataSuggestionSource {
                    source_path_segment: suggestion.source,
                    suggested_value: suggestion.suggested_value,
                    origin: MetadataSuggestionSourceOrigin::FilenameBracket,
                }),
        );
    }

    suggestion_sources
}

fn metadata_suggestion_segments(
    scan_root_path: &str,
    video_path: &str,
    inference_rules: &ScanRootInferenceRules,
) -> Vec<String> {
    if !inference_rules.suggest_tags_from_folder_names {
        return Vec::new();
    }

    let scan_root = Path::new(scan_root_path);
    let video_path = Path::new(video_path);
    let video_folder = video_path.parent().unwrap_or(video_path);
    let child_folder_path = match video_folder.strip_prefix(scan_root) {
        Ok(child_folder_path) => child_folder_path,
        Err(_) => return Vec::new(),
    };
    let ignored_folder_names = inference_rules
        .ignored_folder_names
        .iter()
        .map(|folder_name| folder_name.to_lowercase())
        .collect::<HashSet<_>>();

    child_folder_path
        .components()
        .filter_map(|component| component.as_os_str().to_str())
        .filter(|folder_name| !folder_name.is_empty())
        .filter(|folder_name| {
            let suggested_value = metadata_suggestion_display_value(folder_name);
            let normalized_suggested_value = suggested_value.to_lowercase();

            !suggested_value.is_empty()
                && !ignored_folder_names.contains(&normalized_suggested_value)
                && !is_ignored_exact_year(
                    &suggested_value,
                    &inference_rules.ignored_exact_year_range,
                )
        })
        .map(|folder_name| folder_name.to_string())
        .collect()
}

pub(crate) fn suggested_tags_from_filename_brackets(
    filename: &str,
    inference_rules: &ScanRootInferenceRules,
) -> Vec<FilenameBracketTagSuggestion> {
    let file_stem = Path::new(filename)
        .file_stem()
        .and_then(|file_stem| file_stem.to_str())
        .unwrap_or(filename);
    let ignored_folder_names = inference_rules
        .ignored_folder_names
        .iter()
        .map(|folder_name| folder_name.to_lowercase())
        .collect::<HashSet<_>>();
    let mut suggestions = Vec::new();
    let mut remaining_stem = file_stem;

    while let Some(open_index) = remaining_stem.find('[') {
        let bracket_content_start = open_index + 1;
        let after_open_bracket = &remaining_stem[bracket_content_start..];
        let close_index = match after_open_bracket.find(']') {
            Some(close_index) => close_index,
            None => break,
        };
        let source = &after_open_bracket[..close_index];

        if is_allowed_filename_bracket_source(source, &ignored_folder_names, inference_rules) {
            for suggested_value in source.split(" - ").map(metadata_suggestion_display_value) {
                if is_allowed_filename_bracket_value(
                    &suggested_value,
                    &ignored_folder_names,
                    inference_rules,
                ) {
                    suggestions.push(FilenameBracketTagSuggestion {
                        source: source.to_string(),
                        suggested_value,
                    });
                }
            }
        }

        remaining_stem = &after_open_bracket[close_index + 1..];
    }

    suggestions
}

fn is_allowed_filename_bracket_source(
    source: &str,
    ignored_folder_names: &HashSet<String>,
    inference_rules: &ScanRootInferenceRules,
) -> bool {
    is_allowed_filename_bracket_value(
        &metadata_suggestion_display_value(source),
        ignored_folder_names,
        inference_rules,
    )
}

fn is_allowed_filename_bracket_value(
    suggested_value: &str,
    ignored_folder_names: &HashSet<String>,
    inference_rules: &ScanRootInferenceRules,
) -> bool {
    !suggested_value.is_empty()
        && !ignored_folder_names.contains(&suggested_value.to_lowercase())
        && !is_ignored_exact_year(suggested_value, &inference_rules.ignored_exact_year_range)
        && !is_technical_filename_token(suggested_value)
}

fn is_technical_filename_token(suggested_value: &str) -> bool {
    let normalized_value = suggested_value.trim().to_ascii_lowercase();
    let quality_labels = ["hd", "fhd", "uhd", "4k", "8k"];

    quality_labels.contains(&normalized_value.as_str())
        || is_resolution_dimensions(&normalized_value)
        || is_vertical_resolution_token(&normalized_value)
}

fn is_resolution_dimensions(suggested_value: &str) -> bool {
    let Some((width, height)) = suggested_value.split_once('x') else {
        return false;
    };

    !width.is_empty()
        && !height.is_empty()
        && width.chars().all(|character| character.is_ascii_digit())
        && height.chars().all(|character| character.is_ascii_digit())
}

fn is_vertical_resolution_token(suggested_value: &str) -> bool {
    let Some(number) = suggested_value.strip_suffix('p') else {
        return false;
    };

    (3..=4).contains(&number.len()) && number.chars().all(|character| character.is_ascii_digit())
}

fn metadata_suggestion_display_value(source_path_segment: &str) -> String {
    source_path_segment.trim().to_string()
}

fn is_ignored_exact_year(folder_name: &str, ignored_exact_year_range: &ExactYearRange) -> bool {
    if folder_name.len() != 4
        || !folder_name
            .chars()
            .all(|character| character.is_ascii_digit())
    {
        return false;
    }

    folder_name
        .parse::<i64>()
        .map(|year| {
            year >= ignored_exact_year_range.start_year && year <= ignored_exact_year_range.end_year
        })
        .unwrap_or(false)
}

fn validated_inference_rules(
    inference_rules: ScanRootInferenceRules,
) -> Result<ScanRootInferenceRules, String> {
    if inference_rules.ignored_exact_year_range.start_year
        > inference_rules.ignored_exact_year_range.end_year
    {
        return Err("Ignored exact year range start must be before or equal to end".to_string());
    }

    let mut seen_ignored_folder_names = HashSet::new();
    let mut ignored_folder_names = Vec::new();
    for ignored_folder_name in inference_rules.ignored_folder_names {
        let trimmed_ignored_folder_name = ignored_folder_name.trim();
        if trimmed_ignored_folder_name.is_empty() {
            return Err("Ignored folder names cannot be empty".to_string());
        }

        let normalized_ignored_folder_name = trimmed_ignored_folder_name.to_lowercase();
        if seen_ignored_folder_names.insert(normalized_ignored_folder_name) {
            ignored_folder_names.push(trimmed_ignored_folder_name.to_string());
        }
    }

    Ok(ScanRootInferenceRules {
        ignored_folder_names,
        ..inference_rules
    })
}

#[cfg(test)]
mod tests;
