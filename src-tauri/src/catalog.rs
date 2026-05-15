use std::{
    collections::HashSet,
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

const FINGERPRINT_VERSION: i64 = 1;
const DEFAULT_VIDEO_EXTENSIONS: [&str; 7] = ["flv", "mp4", "mov", "mkv", "avi", "webm", "m4v"];
const FINGERPRINT_SAMPLE_SIZE_BYTES: usize = 64 * 1024;
const FNV_OFFSET_BASIS: u64 = 14_695_981_039_346_656_037;
const FNV_PRIME: u64 = 1_099_511_628_211;
macro_rules! default_ignored_folder_names_json {
    () => {
        "[\"Misc\",\"Unsorted\",\"To Sort\",\"To Review\",\"New\",\"Temp\",\"Archive\",\"Archives\",\"Downloads\",\"Videos\"]"
    };
}
const DEFAULT_IGNORED_FOLDER_NAMES_JSON: &str = default_ignored_folder_names_json!();

const CREATE_SCAN_ROOTS_TABLE: &str = concat!(
    "
    CREATE TABLE IF NOT EXISTS scan_roots (
        id INTEGER PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        drive_identity TEXT,
        is_available INTEGER NOT NULL DEFAULT 1,
        suggest_tags_from_child_folders INTEGER NOT NULL DEFAULT 1,
        suggest_performers_from_child_folders INTEGER NOT NULL DEFAULT 0,
        ignored_folder_names TEXT NOT NULL DEFAULT '",
    default_ignored_folder_names_json!(),
    "',
        ignored_exact_year_start INTEGER NOT NULL DEFAULT 1900,
        ignored_exact_year_end INTEGER NOT NULL DEFAULT 2099,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
"
);

const CREATE_VIDEOS_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY,
        fingerprint TEXT NOT NULL UNIQUE,
        fingerprint_version INTEGER NOT NULL,
        title TEXT NOT NULL,
        duration_milliseconds INTEGER NOT NULL,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        last_opened_at TEXT,
        open_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
";

const CREATE_FILE_LOCATIONS_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS file_locations (
        id INTEGER PRIMARY KEY,
        video_id INTEGER NOT NULL,
        scan_root_id INTEGER NOT NULL,
        path TEXT NOT NULL UNIQUE,
        file_size_bytes INTEGER NOT NULL,
        last_seen_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos (id) ON DELETE CASCADE,
        FOREIGN KEY (scan_root_id) REFERENCES scan_roots (id) ON DELETE CASCADE
    );
";

const CREATE_UNPROCESSABLE_VIDEO_CANDIDATES_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS unprocessable_video_candidates (
        id INTEGER PRIMARY KEY,
        scan_root_id INTEGER NOT NULL,
        path TEXT NOT NULL UNIQUE,
        reason TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        last_seen_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (scan_root_id) REFERENCES scan_roots (id) ON DELETE CASCADE
    );
";

const CREATE_METADATA_SUGGESTIONS_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS metadata_suggestions (
        id INTEGER PRIMARY KEY,
        scan_root_id INTEGER NOT NULL,
        video_id INTEGER NOT NULL,
        source_path_segment TEXT NOT NULL,
        suggested_value TEXT NOT NULL,
        suggestion_kind TEXT NOT NULL,
        accepted_at TEXT,
        rejected_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (scan_root_id, video_id, source_path_segment, suggestion_kind),
        FOREIGN KEY (scan_root_id) REFERENCES scan_roots (id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos (id) ON DELETE CASCADE
    );
";

const CREATE_METADATA_SUGGESTION_REJECTIONS_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS metadata_suggestion_rejections (
        id INTEGER PRIMARY KEY,
        scan_root_id INTEGER NOT NULL,
        source_path_segment TEXT NOT NULL,
        normalized_suggested_value TEXT NOT NULL,
        suggestion_kind TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (
            scan_root_id,
            source_path_segment,
            normalized_suggested_value,
            suggestion_kind
        ),
        FOREIGN KEY (scan_root_id) REFERENCES scan_roots (id) ON DELETE CASCADE
    );
";

const CREATE_PREVIEW_STRIPS_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS preview_strips (
        id INTEGER PRIMARY KEY,
        video_id INTEGER NOT NULL UNIQUE,
        path TEXT NOT NULL UNIQUE,
        frame_count INTEGER NOT NULL,
        column_count INTEGER NOT NULL,
        row_count INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos (id) ON DELETE CASCADE
    );
";

const CREATE_FAILED_PREVIEW_STRIPS_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS failed_preview_strips (
        id INTEGER PRIMARY KEY,
        video_id INTEGER NOT NULL UNIQUE,
        reason TEXT NOT NULL,
        ignored_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos (id) ON DELETE CASCADE
    );
";

const CREATE_TAGS_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
";

const CREATE_PERFORMERS_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS performers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
";

const CREATE_TAG_VIDEOS_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS tag_videos (
        tag_id INTEGER NOT NULL,
        video_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (tag_id, video_id),
        FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos (id) ON DELETE CASCADE
    );
";

const CREATE_PERFORMER_VIDEOS_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS performer_videos (
        performer_id INTEGER NOT NULL,
        video_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (performer_id, video_id),
        FOREIGN KEY (performer_id) REFERENCES performers (id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos (id) ON DELETE CASCADE
    );
";

const CREATE_TAG_VIDEOS_VIDEO_INDEX: &str = "
    CREATE INDEX IF NOT EXISTS idx_tag_videos_video_id
    ON tag_videos (video_id);
";

const CREATE_PERFORMER_VIDEOS_VIDEO_INDEX: &str = "
    CREATE INDEX IF NOT EXISTS idx_performer_videos_video_id
    ON performer_videos (video_id);
";

const DEFAULT_PREVIEW_STRIP_FRAME_COUNT: i64 = 40;
const PREVIEW_STRIP_COLUMNS: i64 = 5;
const PREVIEW_STRIP_FRAME_WIDTH_PIXELS: i64 = 640;
const DEFAULT_IGNORED_EXACT_YEAR_START: i64 = 1900;
const DEFAULT_IGNORED_EXACT_YEAR_END: i64 = 2099;
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
    pub inference_rules: ScanRootInferenceRules,
}

#[derive(Debug, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRootInferenceRules {
    pub suggest_tags_from_child_folders: bool,
    pub suggest_performers_from_child_folders: bool,
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
            suggest_tags_from_child_folders: true,
            suggest_performers_from_child_folders: false,
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
pub struct ScanRootRefreshSummary {
    pub scanned_video_count: i64,
    pub unprocessable_candidate_count: i64,
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

        let catalog = Self { database };
        catalog.run_migrations()?;

        Ok(catalog)
    }

    pub fn listed_videos(&self) -> Result<Vec<CatalogVideo>, String> {
        let mut statement = self
            .database
            .prepare(
                "SELECT videos.id,
                        videos.title,
                        videos.duration_milliseconds,
                        videos.is_favorite,
                        videos.last_opened_at,
                        videos.open_count,
                        preferred_file_locations.file_size_bytes,
                        preferred_file_locations.path,
                        preferred_file_locations.path IS NOT NULL,
                        preview_strips.path,
                        preview_strips.frame_count,
                        preview_strips.column_count,
                        preview_strips.row_count,
                        failed_preview_strips.reason
                 FROM videos
                 LEFT JOIN file_locations AS preferred_file_locations
                   ON preferred_file_locations.id = (
                    SELECT file_locations.id
                    FROM file_locations
                    WHERE file_locations.video_id = videos.id
                    ORDER BY file_locations.path
                    LIMIT 1
                 )
                 LEFT JOIN preview_strips ON preview_strips.video_id = videos.id
                 LEFT JOIN failed_preview_strips ON failed_preview_strips.video_id = videos.id
                 ORDER BY videos.title, preferred_file_locations.path",
            )
            .map_err(|error| error.to_string())?;

        let videos = statement
            .query_map([], |row| {
                let video_id = row.get(0)?;
                Ok(CatalogVideo {
                    id: video_id,
                    title: row.get(1)?,
                    duration_milliseconds: row.get(2)?,
                    is_favorite: row.get::<_, i64>(3)? == 1,
                    last_opened_at: row.get(4)?,
                    open_count: row.get(5)?,
                    file_size_bytes: row.get(6)?,
                    file_location_path: row.get(7)?,
                    file_locations: self.file_locations_for_video(video_id)?,
                    is_available: row.get::<_, i64>(8)? == 1,
                    preview_strip: preview_strip_status_from_row(row, 9)?,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(videos)
    }

    pub fn update_video_title(&self, video_id: i64, title: &str) -> Result<(), String> {
        let video_title = normalized_video_title(title)?;
        let updated_video_count = self
            .database
            .execute(
                "UPDATE videos
                 SET title = ?1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?2",
                params![video_title, video_id],
            )
            .map_err(|error| error.to_string())?;
        if updated_video_count == 0 {
            return Err("Video is not in the Catalog".to_string());
        }

        Ok(())
    }

    pub fn set_video_favorite(&self, video_id: i64, is_favorite: bool) -> Result<(), String> {
        let updated_video_count = self
            .database
            .execute(
                "UPDATE videos
                 SET is_favorite = ?1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?2",
                params![i64::from(is_favorite), video_id],
            )
            .map_err(|error| error.to_string())?;
        if updated_video_count == 0 {
            return Err("Video is not in the Catalog".to_string());
        }

        Ok(())
    }

    pub fn record_video_opened(&self, video_id: i64) -> Result<(), String> {
        let updated_video_count = self
            .database
            .execute(
                "UPDATE videos
                 SET last_opened_at = CURRENT_TIMESTAMP,
                     open_count = open_count + 1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?1",
                params![video_id],
            )
            .map_err(|error| error.to_string())?;
        if updated_video_count == 0 {
            return Err("Video is not in the Catalog".to_string());
        }

        Ok(())
    }

    pub fn preferred_file_location_path(&self, video_id: i64) -> Result<PathBuf, String> {
        let file_location_path = self
            .database
            .query_row(
                "SELECT path
                 FROM file_locations
                 WHERE video_id = ?1
                 ORDER BY path
                 LIMIT 1",
                params![video_id],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| error.to_string())?;

        file_location_path
            .map(PathBuf::from)
            .ok_or_else(|| "Video has no available File Location".to_string())
    }

    pub fn add_scan_root(&self, scan_root_path: &Path) -> Result<ScanRoot, String> {
        let canonical_scan_root_path =
            canonical_scan_root_path(scan_root_path).map_err(|error| error.to_string())?;
        let scan_root = ScanRoot {
            inference_rules: ScanRootInferenceRules::default(),
            is_available: true,
            path: canonical_scan_root_path.to_string_lossy().into_owned(),
        };

        self.reject_overlapping_scan_root(&canonical_scan_root_path)?;
        self.database
            .execute(
                "INSERT INTO scan_roots (path, drive_identity) VALUES (?1, NULL)",
                params![scan_root.path],
            )
            .map_err(|error| error.to_string())?;

        Ok(scan_root)
    }

    pub fn list_scan_roots(&self) -> Result<Vec<ScanRoot>, String> {
        let mut statement = self
            .database
            .prepare(
                "SELECT path,
                        is_available,
                        suggest_tags_from_child_folders,
                        suggest_performers_from_child_folders,
                        ignored_folder_names,
                        ignored_exact_year_start,
                        ignored_exact_year_end
                 FROM scan_roots
                 ORDER BY path",
            )
            .map_err(|error| error.to_string())?;

        let scan_roots = statement
            .query_map([], |row| {
                Ok(ScanRoot {
                    path: row.get(0)?,
                    is_available: row.get::<_, i64>(1)? == 1,
                    inference_rules: scan_root_inference_rules_from_row(row)?,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(scan_roots)
    }

    pub fn update_scan_root_inference_rules(
        &self,
        scan_root_path: &str,
        inference_rules: ScanRootInferenceRules,
    ) -> Result<ScanRoot, String> {
        let inference_rules = validated_inference_rules(inference_rules)?;
        let ignored_folder_names = serde_json::to_string(&inference_rules.ignored_folder_names)
            .map_err(|error| error.to_string())?;
        let updated_scan_root_count = self
            .database
            .execute(
                "UPDATE scan_roots
                 SET suggest_tags_from_child_folders = ?1,
                     suggest_performers_from_child_folders = ?2,
                     ignored_folder_names = ?3,
                     ignored_exact_year_start = ?4,
                     ignored_exact_year_end = ?5,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE path = ?6",
                params![
                    i64::from(inference_rules.suggest_tags_from_child_folders),
                    i64::from(inference_rules.suggest_performers_from_child_folders),
                    ignored_folder_names,
                    inference_rules.ignored_exact_year_range.start_year,
                    inference_rules.ignored_exact_year_range.end_year,
                    scan_root_path,
                ],
            )
            .map_err(|error| error.to_string())?;
        if updated_scan_root_count == 0 {
            return Err("Scan Root is not in the Catalog".to_string());
        }
        self.regenerate_unaccepted_metadata_suggestions(
            self.scan_root_id(scan_root_path)?,
            scan_root_path,
        )?;

        self.scan_root(scan_root_path)
    }

    pub fn remove_scan_root_preserving_missing_videos(
        &self,
        scan_root_path: &str,
    ) -> Result<(), String> {
        self.database
            .execute(
                "DELETE FROM scan_roots
                 WHERE path = ?1",
                params![scan_root_path],
            )
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    pub fn remove_scan_root_forgetting_catalog_videos(
        &self,
        scan_root_path: &str,
    ) -> Result<(), String> {
        let transaction = self
            .database
            .unchecked_transaction()
            .map_err(|error| error.to_string())?;
        transaction
            .execute(
                "DELETE FROM file_locations
                 WHERE scan_root_id IN (
                    SELECT id
                    FROM scan_roots
                    WHERE path = ?1
                 )",
                params![scan_root_path],
            )
            .map_err(|error| error.to_string())?;
        transaction
            .execute(
                "DELETE FROM videos
                 WHERE NOT EXISTS (
                    SELECT 1
                    FROM file_locations
                    WHERE file_locations.video_id = videos.id
                 )",
                [],
            )
            .map_err(|error| error.to_string())?;
        transaction
            .execute(
                "DELETE FROM scan_roots
                 WHERE path = ?1",
                params![scan_root_path],
            )
            .map_err(|error| error.to_string())?;
        transaction.commit().map_err(|error| error.to_string())
    }

    pub fn forget_catalog_video(&self, video_id: i64) -> Result<(), String> {
        let transaction = self
            .database
            .unchecked_transaction()
            .map_err(|error| error.to_string())?;
        let deleted_video_count = transaction
            .execute(
                "DELETE FROM videos
                 WHERE id = ?1
                   AND NOT EXISTS (
                    SELECT 1
                    FROM file_locations
                    WHERE file_locations.video_id = videos.id
                   )",
                params![video_id],
            )
            .map_err(|error| error.to_string())?;
        if deleted_video_count == 0 {
            return Err("Only Missing Videos can be forgotten from the Catalog".to_string());
        }

        transaction.commit().map_err(|error| error.to_string())
    }

    pub fn refresh_scan_root<P: VideoFileProbe>(
        &self,
        scan_root_path: &str,
        video_file_probe: &P,
        video_extension_allowlist: &VideoExtensionAllowlist,
    ) -> Result<ScanRootRefreshSummary, String> {
        if let Some(refresh_summary) = self.refresh_scan_root_if_unreachable(scan_root_path)? {
            return Ok(refresh_summary);
        }

        let scan_root_id = self.scan_root_id(scan_root_path)?;
        self.mark_scan_root_availability(scan_root_id, true)?;
        let video_candidate_paths =
            discover_video_candidate_paths(Path::new(scan_root_path), video_extension_allowlist)?;
        let mut seen_video_candidate_paths = HashSet::new();
        let mut scanned_video_count = 0;
        let mut unprocessable_candidate_count = 0;

        for video_candidate_path in video_candidate_paths {
            let file_size_bytes = file_size_bytes(&video_candidate_path)?;
            let video_candidate_path_text = video_candidate_path.to_string_lossy().into_owned();
            seen_video_candidate_paths.insert(video_candidate_path_text.clone());

            match video_file_probe.probe_video_file(&video_candidate_path) {
                Ok(video_probe) => {
                    self.store_scanned_video(
                        scan_root_id,
                        &video_candidate_path,
                        file_size_bytes,
                        video_probe.duration_milliseconds,
                    )?;
                    scanned_video_count += 1;
                }
                Err(reason) => {
                    self.store_unprocessable_video_candidate(
                        scan_root_id,
                        &video_candidate_path,
                        file_size_bytes,
                        &reason,
                    )?;
                    self.remove_file_location(&video_candidate_path_text)?;
                    unprocessable_candidate_count += 1;
                }
            }
        }
        self.remove_stale_scan_root_entries(scan_root_id, &seen_video_candidate_paths)?;
        self.regenerate_unaccepted_metadata_suggestions(scan_root_id, scan_root_path)?;

        Ok(ScanRootRefreshSummary {
            scanned_video_count,
            unprocessable_candidate_count,
        })
    }

    pub fn refresh_all_scan_roots<P: VideoFileProbe>(
        &self,
        video_file_probe: &P,
        video_extension_allowlist: &VideoExtensionAllowlist,
    ) -> Result<ScanRootRefreshSummary, String> {
        let scan_roots = self.list_scan_roots()?;
        let mut refresh_summary = ScanRootRefreshSummary {
            scanned_video_count: 0,
            unprocessable_candidate_count: 0,
        };

        for scan_root in scan_roots {
            let scan_root_refresh_summary = self.refresh_scan_root(
                &scan_root.path,
                video_file_probe,
                video_extension_allowlist,
            )?;
            refresh_summary.scanned_video_count += scan_root_refresh_summary.scanned_video_count;
            refresh_summary.unprocessable_candidate_count +=
                scan_root_refresh_summary.unprocessable_candidate_count;
        }

        Ok(refresh_summary)
    }

    pub fn refresh_scan_root_if_unreachable(
        &self,
        scan_root_path: &str,
    ) -> Result<Option<ScanRootRefreshSummary>, String> {
        if Path::new(scan_root_path).is_dir() {
            return Ok(None);
        }

        let scan_root_id = self.scan_root_id(scan_root_path)?;
        self.mark_scan_root_availability(scan_root_id, false)?;
        self.remove_stale_scan_root_entries(scan_root_id, &HashSet::new())?;

        Ok(Some(ScanRootRefreshSummary {
            scanned_video_count: 0,
            unprocessable_candidate_count: 0,
        }))
    }

    pub fn list_unprocessable_video_candidates(
        &self,
    ) -> Result<Vec<UnprocessableVideoCandidate>, String> {
        let mut statement = self
            .database
            .prepare(
                "SELECT path, reason, file_size_bytes
                 FROM unprocessable_video_candidates
                 ORDER BY path",
            )
            .map_err(|error| error.to_string())?;

        let unprocessable_video_candidates = statement
            .query_map([], |row| {
                Ok(UnprocessableVideoCandidate {
                    path: row.get(0)?,
                    reason: row.get(1)?,
                    file_size_bytes: row.get(2)?,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(unprocessable_video_candidates)
    }

    pub fn list_failed_preview_strips(&self) -> Result<Vec<FailedPreviewStrip>, String> {
        let mut statement = self
            .database
            .prepare(
                "SELECT failed_preview_strips.video_id,
                        videos.title,
                        failed_preview_strips.reason
                 FROM failed_preview_strips
                 JOIN videos ON videos.id = failed_preview_strips.video_id
                 WHERE failed_preview_strips.ignored_at IS NULL
                 ORDER BY videos.title, failed_preview_strips.video_id",
            )
            .map_err(|error| error.to_string())?;

        let failed_preview_strips = statement
            .query_map([], |row| {
                Ok(FailedPreviewStrip {
                    video_id: row.get(0)?,
                    title: row.get(1)?,
                    failure_reason: row.get(2)?,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(failed_preview_strips)
    }

    pub fn list_metadata_suggestion_groups(&self) -> Result<Vec<MetadataSuggestionGroup>, String> {
        let mut statement = self
            .database
            .prepare(
                "SELECT metadata_suggestions.suggested_value,
                        lower(metadata_suggestions.suggested_value),
                        metadata_suggestions.suggestion_kind,
                        scan_roots.path,
                        metadata_suggestions.source_path_segment,
                        metadata_suggestions.video_id,
                        videos.title,
                        file_locations.path,
                        scan_roots.suggest_tags_from_child_folders,
                        scan_roots.suggest_performers_from_child_folders,
                        scan_roots.ignored_folder_names,
                        scan_roots.ignored_exact_year_start,
                        scan_roots.ignored_exact_year_end
                 FROM metadata_suggestions
                 JOIN scan_roots ON scan_roots.id = metadata_suggestions.scan_root_id
                 JOIN videos ON videos.id = metadata_suggestions.video_id
                 JOIN file_locations
                   ON file_locations.video_id = metadata_suggestions.video_id
                  AND file_locations.scan_root_id = metadata_suggestions.scan_root_id
                 WHERE metadata_suggestions.accepted_at IS NULL
                   AND metadata_suggestions.rejected_at IS NULL
                 ORDER BY lower(metadata_suggestions.suggested_value),
                          metadata_suggestions.suggestion_kind,
                          scan_roots.path,
                          metadata_suggestions.source_path_segment,
                          videos.title,
                          metadata_suggestions.suggested_value,
                          metadata_suggestions.video_id",
            )
            .map_err(|error| error.to_string())?;

        let suggestion_rows = statement
            .query_map([], |row| {
                Ok(MetadataSuggestionRow {
                    suggested_value: row.get(0)?,
                    normalized_suggested_value: row.get(1)?,
                    suggestion_kind: row.get(2)?,
                    scan_root_path: row.get(3)?,
                    source_path_segment: row.get(4)?,
                    video_id: row.get(5)?,
                    title: row.get(6)?,
                    file_location_path: row.get(7)?,
                    inference_rules: ScanRootInferenceRules {
                        suggest_tags_from_child_folders: row.get::<_, i64>(8)? == 1,
                        suggest_performers_from_child_folders: row.get::<_, i64>(9)? == 1,
                        ignored_folder_names: ignored_folder_names_from_json(row.get(10)?)?,
                        ignored_exact_year_range: ExactYearRange {
                            start_year: row.get(11)?,
                            end_year: row.get(12)?,
                        },
                    },
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(group_metadata_suggestions(suggestion_rows))
    }

    pub fn accept_metadata_suggestion_for_videos(
        &self,
        scan_root_path: &str,
        suggested_value: &str,
        suggestion_kind: &str,
        accepted_metadata_kind: Option<&str>,
        accepted_value: Option<&str>,
        video_ids: &[i64],
    ) -> Result<(), String> {
        if video_ids.is_empty() {
            return Err("Select at least one Video to accept".to_string());
        }

        self.reject_unknown_suggestion_kind(suggestion_kind)?;
        let metadata_kind = accepted_metadata_kind.unwrap_or(suggestion_kind);
        self.reject_unknown_suggestion_kind(metadata_kind)?;
        let scan_root_id = self.scan_root_id(scan_root_path)?;
        self.reject_videos_without_pending_metadata_suggestions(
            scan_root_id,
            suggested_value,
            suggestion_kind,
            video_ids,
        )?;

        let transaction = self
            .database
            .unchecked_transaction()
            .map_err(|error| error.to_string())?;
        let metadata_value_name = accepted_value.unwrap_or(suggested_value);
        let metadata_value_id =
            metadata_value_id_for_suggestion(&transaction, metadata_kind, metadata_value_name)?;

        for video_id in video_ids {
            attach_metadata_suggestion_to_video(
                &transaction,
                metadata_kind,
                metadata_value_id,
                *video_id,
            )?;
            transaction
                .execute(
                    "UPDATE metadata_suggestions
                     SET accepted_at = CURRENT_TIMESTAMP,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE scan_root_id = ?1
                       AND video_id = ?2
                       AND lower(suggested_value) = lower(?3)
                       AND suggestion_kind = ?4
                       AND accepted_at IS NULL
                       AND rejected_at IS NULL",
                    params![scan_root_id, video_id, suggested_value, suggestion_kind],
                )
                .map_err(|error| error.to_string())?;
        }

        transaction.commit().map_err(|error| error.to_string())
    }

    pub fn reject_metadata_suggestion_source(
        &self,
        scan_root_path: &str,
        source_path_segment: &str,
        suggested_value: &str,
        suggestion_kind: &str,
    ) -> Result<(), String> {
        self.reject_unknown_suggestion_kind(suggestion_kind)?;
        let scan_root_id = self.scan_root_id(scan_root_path)?;
        let metadata_name = normalized_metadata_input(suggested_value)?;
        let transaction = self
            .database
            .unchecked_transaction()
            .map_err(|error| error.to_string())?;

        transaction
            .execute(
                "INSERT INTO metadata_suggestion_rejections (
                    scan_root_id,
                    source_path_segment,
                    normalized_suggested_value,
                    suggestion_kind
                 )
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT (
                    scan_root_id,
                    source_path_segment,
                    normalized_suggested_value,
                    suggestion_kind
                 )
                 DO UPDATE SET updated_at = CURRENT_TIMESTAMP",
                params![
                    scan_root_id,
                    source_path_segment,
                    metadata_name.normalized_name,
                    suggestion_kind
                ],
            )
            .map_err(|error| error.to_string())?;

        transaction
            .execute(
                "UPDATE metadata_suggestions
                 SET rejected_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE scan_root_id = ?1
                   AND source_path_segment = ?2
                   AND lower(suggested_value) = lower(?3)
                   AND suggestion_kind = ?4
                   AND accepted_at IS NULL
                   AND rejected_at IS NULL",
                params![
                    scan_root_id,
                    source_path_segment,
                    suggested_value,
                    suggestion_kind
                ],
            )
            .map_err(|error| error.to_string())?;

        transaction.commit().map_err(|error| error.to_string())
    }

    #[cfg(test)]
    pub fn generate_missing_preview_strips<G: PreviewStripGenerator>(
        &self,
        preview_cache_path: &Path,
        preview_strip_generator: &G,
    ) -> Result<PreviewStripGenerationSummary, String> {
        let pending_preview_strip_requests =
            self.pending_preview_strip_requests(preview_cache_path)?;
        let mut generation_summary = PreviewStripGenerationSummary {
            generated_preview_strip_count: 0,
            failed_preview_strip_count: 0,
        };

        for request in pending_preview_strip_requests {
            match preview_strip_generator.generate_preview_strip(&request) {
                Ok(generated_preview_strip) => {
                    self.store_generated_preview_strip(request.video_id, &generated_preview_strip)?;
                    generation_summary.generated_preview_strip_count += 1;
                }
                Err(reason) => {
                    self.store_failed_preview_strip(request.video_id, &reason)?;
                    generation_summary.failed_preview_strip_count += 1;
                }
            }
        }

        Ok(generation_summary)
    }

    pub fn pending_preview_strip_requests(
        &self,
        preview_cache_path: &Path,
    ) -> Result<Vec<PreviewStripRequest>, String> {
        fs::create_dir_all(preview_cache_path).map_err(|error| error.to_string())?;
        self.remove_preview_strip_rows_without_cache_files()?;

        self.pending_preview_strips()?
            .into_iter()
            .map(|pending_preview_strip| {
                Ok(PreviewStripRequest {
                    video_id: pending_preview_strip.video_id,
                    video_path: PathBuf::from(&pending_preview_strip.video_path),
                    output_path: preview_cache_path.join(format!(
                        "video-{}-preview-strip.jpg",
                        pending_preview_strip.video_id
                    )),
                    duration_milliseconds: pending_preview_strip.duration_milliseconds,
                    frame_count: DEFAULT_PREVIEW_STRIP_FRAME_COUNT,
                })
            })
            .collect()
    }

    pub fn next_preview_strip_request(
        &self,
        preview_cache_path: &Path,
    ) -> Result<Option<PreviewStripRequest>, String> {
        Ok(self
            .pending_preview_strip_requests(preview_cache_path)?
            .into_iter()
            .next())
    }

    pub fn preview_strip_queue_counts(&self) -> Result<PreviewStripQueueCounts, String> {
        self.remove_preview_strip_rows_without_cache_files()?;

        Ok(PreviewStripQueueCounts {
            pending_count: self.pending_preview_strips()?.len() as i64,
            failed_count: self.failed_preview_strip_count()?,
        })
    }

    #[cfg(test)]
    pub fn generate_next_preview_strip<G: PreviewStripGenerator>(
        &self,
        preview_cache_path: &Path,
        preview_strip_generator: &G,
    ) -> Result<PreviewStripGenerationSummary, String> {
        let Some(request) = self
            .pending_preview_strip_requests(preview_cache_path)?
            .into_iter()
            .next()
        else {
            return Ok(PreviewStripGenerationSummary {
                generated_preview_strip_count: 0,
                failed_preview_strip_count: 0,
            });
        };

        match preview_strip_generator.generate_preview_strip(&request) {
            Ok(generated_preview_strip) => {
                self.store_generated_preview_strip(request.video_id, &generated_preview_strip)?;
                Ok(PreviewStripGenerationSummary {
                    generated_preview_strip_count: 1,
                    failed_preview_strip_count: 0,
                })
            }
            Err(reason) => {
                self.store_failed_preview_strip(request.video_id, &reason)?;
                Ok(PreviewStripGenerationSummary {
                    generated_preview_strip_count: 0,
                    failed_preview_strip_count: 1,
                })
            }
        }
    }

    pub fn store_generated_preview_strip(
        &self,
        video_id: i64,
        generated_preview_strip: &GeneratedPreviewStrip,
    ) -> Result<(), String> {
        self.store_preview_strip(video_id, generated_preview_strip)?;
        self.remove_failed_preview_strip(video_id)
    }

    pub fn store_failed_preview_strip(&self, video_id: i64, reason: &str) -> Result<(), String> {
        self.database
            .execute(
                "INSERT INTO failed_preview_strips (video_id, reason)
                 VALUES (?1, ?2)
                 ON CONFLICT(video_id) DO UPDATE SET
                    reason = excluded.reason,
                    ignored_at = NULL,
                    updated_at = CURRENT_TIMESTAMP",
                params![video_id, reason],
            )
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    pub fn ignore_failed_preview_strip(&self, video_id: i64) -> Result<(), String> {
        self.database
            .execute(
                "UPDATE failed_preview_strips
                 SET ignored_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE video_id = ?1",
                params![video_id],
            )
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    pub fn retry_failed_preview_strip(
        &self,
        video_id: i64,
        _retry_reason: PreviewStripRetryReason,
    ) -> Result<(), String> {
        self.remove_failed_preview_strip(video_id)
    }

    pub fn retry_ignored_failed_preview_strips(
        &self,
        _retry_reason: PreviewStripRetryReason,
    ) -> Result<(), String> {
        self.database
            .execute(
                "DELETE FROM failed_preview_strips
                 WHERE ignored_at IS NOT NULL",
                [],
            )
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    pub fn list_tags(&self) -> Result<Vec<CatalogTag>, String> {
        self.list_metadata_values("tags")
            .map(catalog_tags_from_values)
    }

    pub fn create_tag(&self, name: &str) -> Result<CatalogTag, String> {
        self.create_metadata_value("tags", name, "Tag")
            .map(catalog_tag_from_value)
    }

    pub fn update_tag(&self, tag_id: i64, name: &str) -> Result<CatalogTag, String> {
        self.update_metadata_value("tags", tag_id, name, "Tag")
            .map(catalog_tag_from_value)
    }

    pub fn delete_tag(&self, tag_id: i64) -> Result<(), String> {
        self.delete_metadata_value(
            "tags",
            "tag_videos",
            "tag_id",
            tag_id,
            "Attached Tags must be detached before deletion",
        )
    }

    pub fn list_performers(&self) -> Result<Vec<CatalogPerformer>, String> {
        self.list_metadata_values("performers")
            .map(catalog_performers_from_values)
    }

    pub fn create_performer(&self, name: &str) -> Result<CatalogPerformer, String> {
        self.create_metadata_value("performers", name, "Performer")
            .map(catalog_performer_from_value)
    }

    pub fn update_performer(
        &self,
        performer_id: i64,
        name: &str,
    ) -> Result<CatalogPerformer, String> {
        self.update_metadata_value("performers", performer_id, name, "Performer")
            .map(catalog_performer_from_value)
    }

    pub fn delete_performer(&self, performer_id: i64) -> Result<(), String> {
        self.delete_metadata_value(
            "performers",
            "performer_videos",
            "performer_id",
            performer_id,
            "Attached Performers must be detached before deletion",
        )
    }

    pub fn attach_tag_to_video(&self, tag_id: i64, video_id: i64) -> Result<(), String> {
        self.attach_metadata_to_video("tag_videos", "tag_id", tag_id, video_id)
    }

    pub fn detach_tag_from_video(&self, tag_id: i64, video_id: i64) -> Result<(), String> {
        self.detach_metadata_from_video("tags", "tag_videos", "tag_id", tag_id, video_id)
    }

    pub fn tags_for_video(&self, video_id: i64) -> Result<Vec<CatalogTag>, String> {
        self.metadata_values_for_video("tags", "tag_videos", "tag_id", video_id)
            .map(catalog_tags_from_values)
    }

    pub fn attach_performer_to_video(
        &self,
        performer_id: i64,
        video_id: i64,
    ) -> Result<(), String> {
        self.attach_metadata_to_video("performer_videos", "performer_id", performer_id, video_id)
    }

    pub fn detach_performer_from_video(
        &self,
        performer_id: i64,
        video_id: i64,
    ) -> Result<(), String> {
        self.detach_metadata_from_video(
            "performers",
            "performer_videos",
            "performer_id",
            performer_id,
            video_id,
        )
    }

    pub fn performers_for_video(&self, video_id: i64) -> Result<Vec<CatalogPerformer>, String> {
        self.metadata_values_for_video("performers", "performer_videos", "performer_id", video_id)
            .map(catalog_performers_from_values)
    }

    fn file_locations_for_video(
        &self,
        video_id: i64,
    ) -> Result<Vec<CatalogVideoFileLocation>, rusqlite::Error> {
        let preferred_path: Option<String> = self
            .database
            .query_row(
                "SELECT path
                 FROM file_locations
                 WHERE video_id = ?1
                 ORDER BY path
                 LIMIT 1",
                params![video_id],
                |row| row.get(0),
            )
            .optional()?;
        let mut statement = self.database.prepare(
            "SELECT path, file_size_bytes
             FROM file_locations
             WHERE video_id = ?1
             ORDER BY path",
        )?;

        let file_locations = statement
            .query_map(params![video_id], |row| {
                let path: String = row.get(0)?;
                Ok(CatalogVideoFileLocation {
                    is_preferred: Some(&path) == preferred_path.as_ref(),
                    path,
                    file_size_bytes: row.get(1)?,
                })
            })?
            .collect();

        file_locations
    }

    fn list_metadata_values(&self, table_name: &str) -> Result<Vec<CatalogMetadataValue>, String> {
        let query = format!(
            "SELECT id, name
             FROM {table_name}
             ORDER BY normalized_name"
        );
        let mut statement = self
            .database
            .prepare(&query)
            .map_err(|error| error.to_string())?;

        let metadata_values = statement
            .query_map([], |row| {
                Ok(CatalogMetadataValue {
                    id: row.get(0)?,
                    name: row.get(1)?,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(metadata_values)
    }

    fn create_metadata_value(
        &self,
        table_name: &str,
        name: &str,
        metadata_type_name: &str,
    ) -> Result<CatalogMetadataValue, String> {
        let metadata_name = normalized_metadata_input(name)?;
        let duplicate_error = format!("{metadata_type_name} already exists");
        self.reject_duplicate_metadata_name(
            table_name,
            &metadata_name.normalized_name,
            None,
            &duplicate_error,
        )?;
        let query = format!(
            "INSERT INTO {table_name} (name, normalized_name)
             VALUES (?1, ?2)"
        );
        self.database
            .execute(
                &query,
                params![metadata_name.display_name, metadata_name.normalized_name],
            )
            .map_err(|error| error.to_string())?;
        let metadata_id = self.database.last_insert_rowid();

        self.metadata_value_by_id(table_name, metadata_id, metadata_type_name)
    }

    fn update_metadata_value(
        &self,
        table_name: &str,
        metadata_id: i64,
        name: &str,
        metadata_type_name: &str,
    ) -> Result<CatalogMetadataValue, String> {
        let metadata_name = normalized_metadata_input(name)?;
        let duplicate_error = format!("{metadata_type_name} already exists");
        self.reject_duplicate_metadata_name(
            table_name,
            &metadata_name.normalized_name,
            Some(metadata_id),
            &duplicate_error,
        )?;
        let query = format!(
            "UPDATE {table_name}
             SET name = ?1,
                 normalized_name = ?2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?3"
        );
        self.database
            .execute(
                &query,
                params![
                    metadata_name.display_name,
                    metadata_name.normalized_name,
                    metadata_id
                ],
            )
            .map_err(|error| error.to_string())?;

        self.metadata_value_by_id(table_name, metadata_id, metadata_type_name)
    }

    fn delete_metadata_value(
        &self,
        table_name: &str,
        link_table_name: &str,
        metadata_id_column: &str,
        metadata_id: i64,
        attached_metadata_error: &str,
    ) -> Result<(), String> {
        self.reject_attached_metadata(
            link_table_name,
            metadata_id_column,
            metadata_id,
            attached_metadata_error,
        )?;
        let query = format!(
            "DELETE FROM {table_name}
             WHERE id = ?1"
        );
        self.database
            .execute(&query, params![metadata_id])
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    fn reject_attached_metadata(
        &self,
        link_table_name: &str,
        metadata_id_column: &str,
        metadata_id: i64,
        attached_metadata_error: &str,
    ) -> Result<(), String> {
        let query = format!(
            "SELECT 1
             FROM {link_table_name}
             WHERE {metadata_id_column} = ?1
             LIMIT 1"
        );
        let has_attached_video = self
            .database
            .query_row(&query, params![metadata_id], |_| Ok(()))
            .optional()
            .map_err(|error| error.to_string())?
            .is_some();

        if has_attached_video {
            Err(attached_metadata_error.to_string())
        } else {
            Ok(())
        }
    }

    fn attach_metadata_to_video(
        &self,
        table_name: &str,
        metadata_id_column: &str,
        metadata_id: i64,
        video_id: i64,
    ) -> Result<(), String> {
        let query = format!(
            "INSERT OR IGNORE INTO {table_name} ({metadata_id_column}, video_id)
             VALUES (?1, ?2)"
        );
        self.database
            .execute(&query, params![metadata_id, video_id])
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    fn reject_unknown_suggestion_kind(&self, suggestion_kind: &str) -> Result<(), String> {
        match suggestion_kind {
            "tag" | "performer" => Ok(()),
            _ => Err("Metadata Suggestion kind is not supported".to_string()),
        }
    }

    fn reject_videos_without_pending_metadata_suggestions(
        &self,
        scan_root_id: i64,
        suggested_value: &str,
        suggestion_kind: &str,
        video_ids: &[i64],
    ) -> Result<(), String> {
        let requested_video_ids = video_ids.iter().copied().collect::<HashSet<_>>();

        if requested_video_ids.len() != video_ids.len() {
            return Err("Selected Videos must be unique".to_string());
        }

        for video_id in video_ids {
            let has_pending_suggestion = self
                .database
                .query_row(
                    "SELECT 1
                     FROM metadata_suggestions
                     WHERE scan_root_id = ?1
                       AND video_id = ?2
                       AND lower(suggested_value) = lower(?3)
                       AND suggestion_kind = ?4
                       AND accepted_at IS NULL
                       AND rejected_at IS NULL
                     LIMIT 1",
                    params![scan_root_id, video_id, suggested_value, suggestion_kind],
                    |_| Ok(()),
                )
                .optional()
                .map_err(|error| error.to_string())?
                .is_some();

            if !has_pending_suggestion {
                return Err("Selected Videos must have pending Metadata Suggestions".to_string());
            }
        }

        Ok(())
    }

    fn detach_metadata_from_video(
        &self,
        metadata_table_name: &str,
        table_name: &str,
        metadata_id_column: &str,
        metadata_id: i64,
        video_id: i64,
    ) -> Result<(), String> {
        let query = format!(
            "DELETE FROM {table_name}
             WHERE {metadata_id_column} = ?1
               AND video_id = ?2"
        );
        self.database
            .execute(&query, params![metadata_id, video_id])
            .map_err(|error| error.to_string())?;
        self.delete_metadata_value_if_unused(
            metadata_table_name,
            table_name,
            metadata_id_column,
            metadata_id,
        )?;

        Ok(())
    }

    fn delete_metadata_value_if_unused(
        &self,
        metadata_table_name: &str,
        link_table_name: &str,
        metadata_id_column: &str,
        metadata_id: i64,
    ) -> Result<(), String> {
        let query = format!(
            "DELETE FROM {metadata_table_name}
             WHERE id = ?1
               AND NOT EXISTS (
                   SELECT 1
                   FROM {link_table_name}
                   WHERE {link_table_name}.{metadata_id_column} = ?1
               )"
        );
        self.database
            .execute(&query, params![metadata_id])
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    fn metadata_values_for_video(
        &self,
        metadata_table_name: &str,
        link_table_name: &str,
        metadata_id_column: &str,
        video_id: i64,
    ) -> Result<Vec<CatalogMetadataValue>, String> {
        let query = format!(
            "SELECT {metadata_table_name}.id, {metadata_table_name}.name
             FROM {metadata_table_name}
             JOIN {link_table_name}
               ON {link_table_name}.{metadata_id_column} = {metadata_table_name}.id
             WHERE {link_table_name}.video_id = ?1
             ORDER BY {metadata_table_name}.normalized_name"
        );
        let mut statement = self
            .database
            .prepare(&query)
            .map_err(|error| error.to_string())?;

        let metadata_values = statement
            .query_map(params![video_id], |row| {
                Ok(CatalogMetadataValue {
                    id: row.get(0)?,
                    name: row.get(1)?,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(metadata_values)
    }

    fn metadata_value_by_id(
        &self,
        table_name: &str,
        metadata_id: i64,
        metadata_type_name: &str,
    ) -> Result<CatalogMetadataValue, String> {
        let query = format!(
            "SELECT id, name
             FROM {table_name}
             WHERE id = ?1"
        );
        self.database
            .query_row(&query, params![metadata_id], |row| {
                Ok(CatalogMetadataValue {
                    id: row.get(0)?,
                    name: row.get(1)?,
                })
            })
            .optional()
            .map_err(|error| error.to_string())?
            .ok_or_else(|| format!("{metadata_type_name} is not in the Catalog"))
    }

    fn reject_duplicate_metadata_name(
        &self,
        table_name: &str,
        normalized_name: &str,
        ignored_metadata_id: Option<i64>,
        duplicate_error: &str,
    ) -> Result<(), String> {
        let query = format!(
            "SELECT id
             FROM {table_name}
             WHERE normalized_name = ?1"
        );
        let existing_metadata_id = self
            .database
            .query_row(&query, params![normalized_name], |row| row.get::<_, i64>(0))
            .optional()
            .map_err(|error| error.to_string())?;
        let is_duplicate = existing_metadata_id
            .filter(|existing_metadata_id| Some(*existing_metadata_id) != ignored_metadata_id)
            .is_some();

        if is_duplicate {
            Err(duplicate_error.to_string())
        } else {
            Ok(())
        }
    }

    fn reject_overlapping_scan_root(&self, candidate_path: &Path) -> Result<(), String> {
        let scan_roots = self.list_scan_roots()?;
        let has_overlap = scan_roots.iter().any(|scan_root| {
            let existing_path = Path::new(&scan_root.path);

            candidate_path.starts_with(existing_path) || existing_path.starts_with(candidate_path)
        });

        if has_overlap {
            Err("Scan Root overlaps with an existing Scan Root".to_string())
        } else {
            Ok(())
        }
    }

    fn run_migrations(&self) -> Result<(), String> {
        let migration_batch = [
            CREATE_SCAN_ROOTS_TABLE,
            CREATE_VIDEOS_TABLE,
            CREATE_FILE_LOCATIONS_TABLE,
            CREATE_UNPROCESSABLE_VIDEO_CANDIDATES_TABLE,
            CREATE_METADATA_SUGGESTIONS_TABLE,
            CREATE_METADATA_SUGGESTION_REJECTIONS_TABLE,
            CREATE_PREVIEW_STRIPS_TABLE,
            CREATE_FAILED_PREVIEW_STRIPS_TABLE,
            CREATE_TAGS_TABLE,
            CREATE_PERFORMERS_TABLE,
            CREATE_TAG_VIDEOS_TABLE,
            CREATE_PERFORMER_VIDEOS_TABLE,
            CREATE_TAG_VIDEOS_VIDEO_INDEX,
            CREATE_PERFORMER_VIDEOS_VIDEO_INDEX,
        ]
        .join("\n");

        self.database
            .execute_batch(&migration_batch)
            .map_err(|error| error.to_string())?;
        self.add_scan_root_availability_column_if_missing()?;
        self.add_scan_root_inference_rule_columns_if_missing()?;
        self.add_failed_preview_strip_ignored_at_column_if_missing()?;
        self.add_video_favorite_column_if_missing()?;
        self.add_video_open_history_columns_if_missing()
    }

    fn add_scan_root_availability_column_if_missing(&self) -> Result<(), String> {
        if catalog_table_has_column(&self.database, "scan_roots", "is_available")? {
            return Ok(());
        }

        self.database
            .execute(
                "ALTER TABLE scan_roots
                 ADD COLUMN is_available INTEGER NOT NULL DEFAULT 1",
                [],
            )
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    fn add_scan_root_inference_rule_columns_if_missing(&self) -> Result<(), String> {
        let scan_root_inference_rule_columns = [
            (
                "suggest_tags_from_child_folders",
                "INTEGER NOT NULL DEFAULT 1".to_string(),
            ),
            (
                "suggest_performers_from_child_folders",
                "INTEGER NOT NULL DEFAULT 0".to_string(),
            ),
            (
                "ignored_folder_names",
                format!("TEXT NOT NULL DEFAULT '{DEFAULT_IGNORED_FOLDER_NAMES_JSON}'"),
            ),
            (
                "ignored_exact_year_start",
                format!("INTEGER NOT NULL DEFAULT {DEFAULT_IGNORED_EXACT_YEAR_START}"),
            ),
            (
                "ignored_exact_year_end",
                format!("INTEGER NOT NULL DEFAULT {DEFAULT_IGNORED_EXACT_YEAR_END}"),
            ),
        ];

        for (column_name, column_definition) in scan_root_inference_rule_columns {
            if catalog_table_has_column(&self.database, "scan_roots", column_name)? {
                continue;
            }

            self.database
                .execute(
                    &format!("ALTER TABLE scan_roots ADD COLUMN {column_name} {column_definition}"),
                    [],
                )
                .map_err(|error| error.to_string())?;
        }

        Ok(())
    }

    fn add_failed_preview_strip_ignored_at_column_if_missing(&self) -> Result<(), String> {
        if catalog_table_has_column(&self.database, "failed_preview_strips", "ignored_at")? {
            return Ok(());
        }

        self.database
            .execute(
                "ALTER TABLE failed_preview_strips
                 ADD COLUMN ignored_at TEXT",
                [],
            )
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    fn add_video_favorite_column_if_missing(&self) -> Result<(), String> {
        if catalog_table_has_column(&self.database, "videos", "is_favorite")? {
            return Ok(());
        }

        self.database
            .execute(
                "ALTER TABLE videos
                 ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0",
                [],
            )
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    fn add_video_open_history_columns_if_missing(&self) -> Result<(), String> {
        if !catalog_table_has_column(&self.database, "videos", "last_opened_at")? {
            self.database
                .execute(
                    "ALTER TABLE videos
                     ADD COLUMN last_opened_at TEXT",
                    [],
                )
                .map_err(|error| error.to_string())?;
        }

        if !catalog_table_has_column(&self.database, "videos", "open_count")? {
            self.database
                .execute(
                    "ALTER TABLE videos
                     ADD COLUMN open_count INTEGER NOT NULL DEFAULT 0",
                    [],
                )
                .map_err(|error| error.to_string())?;
        }

        Ok(())
    }

    fn scan_root_id(&self, scan_root_path: &str) -> Result<i64, String> {
        self.database
            .query_row(
                "SELECT id FROM scan_roots WHERE path = ?1",
                params![scan_root_path],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "Scan Root is not in the Catalog".to_string())
    }

    fn scan_root(&self, scan_root_path: &str) -> Result<ScanRoot, String> {
        self.database
            .query_row(
                "SELECT path,
                        is_available,
                        suggest_tags_from_child_folders,
                        suggest_performers_from_child_folders,
                        ignored_folder_names,
                        ignored_exact_year_start,
                        ignored_exact_year_end
                 FROM scan_roots
                 WHERE path = ?1",
                params![scan_root_path],
                |row| {
                    Ok(ScanRoot {
                        path: row.get(0)?,
                        is_available: row.get::<_, i64>(1)? == 1,
                        inference_rules: scan_root_inference_rules_from_row(row)?,
                    })
                },
            )
            .optional()
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "Scan Root is not in the Catalog".to_string())
    }

    fn store_scanned_video(
        &self,
        scan_root_id: i64,
        video_path: &Path,
        file_size_bytes: i64,
        duration_milliseconds: i64,
    ) -> Result<(), String> {
        let video_title = video_title(video_path)?;
        let fingerprint = video_fingerprint(video_path, file_size_bytes, duration_milliseconds)?;
        let transaction = self
            .database
            .unchecked_transaction()
            .map_err(|error| error.to_string())?;

        transaction
            .execute(
                "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(fingerprint) DO UPDATE SET
                    duration_milliseconds = excluded.duration_milliseconds,
                    updated_at = CURRENT_TIMESTAMP",
                params![
                    fingerprint,
                    FINGERPRINT_VERSION,
                    video_title,
                    duration_milliseconds
                ],
            )
            .map_err(|error| error.to_string())?;

        let video_id: i64 = transaction
            .query_row(
                "SELECT id FROM videos WHERE fingerprint = ?1",
                params![fingerprint],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        let video_path = video_path.to_string_lossy().into_owned();

        transaction
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
                 ON CONFLICT(path) DO UPDATE SET
                    video_id = excluded.video_id,
                    scan_root_id = excluded.scan_root_id,
                    file_size_bytes = excluded.file_size_bytes,
                    last_seen_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP",
                params![video_id, scan_root_id, video_path, file_size_bytes],
            )
            .map_err(|error| error.to_string())?;
        transaction
            .execute(
                "DELETE FROM unprocessable_video_candidates WHERE path = ?1",
                params![video_path],
            )
            .map_err(|error| error.to_string())?;

        transaction.commit().map_err(|error| error.to_string())
    }

    fn store_unprocessable_video_candidate(
        &self,
        scan_root_id: i64,
        video_path: &Path,
        file_size_bytes: i64,
        reason: &str,
    ) -> Result<(), String> {
        self.database
            .execute(
                "INSERT INTO unprocessable_video_candidates
                    (scan_root_id, path, reason, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
                 ON CONFLICT(path) DO UPDATE SET
                    scan_root_id = excluded.scan_root_id,
                    reason = excluded.reason,
                    file_size_bytes = excluded.file_size_bytes,
                    last_seen_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP",
                params![
                    scan_root_id,
                    video_path.to_string_lossy().into_owned(),
                    reason,
                    file_size_bytes
                ],
            )
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    fn remove_file_location(&self, video_path: &str) -> Result<(), String> {
        self.database
            .execute(
                "DELETE FROM file_locations
                 WHERE path = ?1",
                params![video_path],
            )
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    fn remove_stale_scan_root_entries(
        &self,
        scan_root_id: i64,
        seen_video_candidate_paths: &HashSet<String>,
    ) -> Result<(), String> {
        let existing_file_location_paths = self.file_location_paths_for_scan_root(scan_root_id)?;
        for existing_file_location_path in existing_file_location_paths {
            if !seen_video_candidate_paths.contains(&existing_file_location_path) {
                self.remove_file_location(&existing_file_location_path)?;
            }
        }

        let existing_unprocessable_candidate_paths =
            self.unprocessable_candidate_paths_for_scan_root(scan_root_id)?;
        for existing_unprocessable_candidate_path in existing_unprocessable_candidate_paths {
            if !seen_video_candidate_paths.contains(&existing_unprocessable_candidate_path) {
                self.remove_unprocessable_video_candidate(&existing_unprocessable_candidate_path)?;
            }
        }

        Ok(())
    }

    fn file_location_paths_for_scan_root(&self, scan_root_id: i64) -> Result<Vec<String>, String> {
        let mut statement = self
            .database
            .prepare(
                "SELECT path
                 FROM file_locations
                 WHERE scan_root_id = ?1",
            )
            .map_err(|error| error.to_string())?;

        let file_location_paths = statement
            .query_map(params![scan_root_id], |row| row.get(0))
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(file_location_paths)
    }

    fn unprocessable_candidate_paths_for_scan_root(
        &self,
        scan_root_id: i64,
    ) -> Result<Vec<String>, String> {
        let mut statement = self
            .database
            .prepare(
                "SELECT path
                 FROM unprocessable_video_candidates
                 WHERE scan_root_id = ?1",
            )
            .map_err(|error| error.to_string())?;

        let unprocessable_candidate_paths = statement
            .query_map(params![scan_root_id], |row| row.get(0))
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(unprocessable_candidate_paths)
    }

    fn remove_unprocessable_video_candidate(&self, video_path: &str) -> Result<(), String> {
        self.database
            .execute(
                "DELETE FROM unprocessable_video_candidates
                 WHERE path = ?1",
                params![video_path],
            )
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    fn mark_scan_root_availability(
        &self,
        scan_root_id: i64,
        is_available: bool,
    ) -> Result<(), String> {
        self.database
            .execute(
                "UPDATE scan_roots
                 SET is_available = ?1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?2",
                params![i64::from(is_available), scan_root_id],
            )
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    fn pending_preview_strips(&self) -> Result<Vec<PendingPreviewStrip>, String> {
        let mut statement = self
            .database
            .prepare(
                "SELECT videos.id,
                        videos.duration_milliseconds,
                        MIN(file_locations.path)
                 FROM videos
                 JOIN file_locations ON file_locations.video_id = videos.id
                 LEFT JOIN preview_strips ON preview_strips.video_id = videos.id
                 LEFT JOIN failed_preview_strips ON failed_preview_strips.video_id = videos.id
                 WHERE preview_strips.id IS NULL
                   AND failed_preview_strips.id IS NULL
                 GROUP BY videos.id, videos.duration_milliseconds
                 ORDER BY videos.id",
            )
            .map_err(|error| error.to_string())?;

        let pending_preview_strips = statement
            .query_map([], |row| {
                Ok(PendingPreviewStrip {
                    video_id: row.get(0)?,
                    duration_milliseconds: row.get(1)?,
                    video_path: row.get(2)?,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(pending_preview_strips)
    }

    fn failed_preview_strip_count(&self) -> Result<i64, String> {
        self.database
            .query_row(
                "SELECT COUNT(*)
                 FROM failed_preview_strips
                 WHERE ignored_at IS NULL",
                [],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())
    }

    fn store_preview_strip(
        &self,
        video_id: i64,
        generated_preview_strip: &GeneratedPreviewStrip,
    ) -> Result<(), String> {
        self.database
            .execute(
                "INSERT INTO preview_strips
                    (video_id, path, frame_count, column_count, row_count)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(video_id) DO UPDATE SET
                    path = excluded.path,
                    frame_count = excluded.frame_count,
                    column_count = excluded.column_count,
                    row_count = excluded.row_count,
                    updated_at = CURRENT_TIMESTAMP",
                params![
                    video_id,
                    generated_preview_strip.path.to_string_lossy().into_owned(),
                    generated_preview_strip.frame_count,
                    generated_preview_strip.column_count,
                    generated_preview_strip.row_count
                ],
            )
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    fn remove_preview_strip_rows_without_cache_files(&self) -> Result<(), String> {
        let mut statement = self
            .database
            .prepare("SELECT id, path FROM preview_strips")
            .map_err(|error| error.to_string())?;
        let preview_strip_paths = statement
            .query_map([], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        for (preview_strip_id, preview_strip_path) in preview_strip_paths {
            if !Path::new(&preview_strip_path).is_file() {
                self.database
                    .execute(
                        "DELETE FROM preview_strips
                         WHERE id = ?1",
                        params![preview_strip_id],
                    )
                    .map_err(|error| error.to_string())?;
            }
        }

        Ok(())
    }

    fn remove_failed_preview_strip(&self, video_id: i64) -> Result<(), String> {
        self.database
            .execute(
                "DELETE FROM failed_preview_strips
                 WHERE video_id = ?1",
                params![video_id],
            )
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    fn regenerate_unaccepted_metadata_suggestions(
        &self,
        scan_root_id: i64,
        scan_root_path: &str,
    ) -> Result<(), String> {
        let scan_root = self.scan_root(scan_root_path)?;
        let file_locations = self.file_locations_for_metadata_inference(scan_root_id)?;
        let transaction = self
            .database
            .unchecked_transaction()
            .map_err(|error| error.to_string())?;

        transaction
            .execute(
                "DELETE FROM metadata_suggestions
                 WHERE scan_root_id = ?1
                   AND accepted_at IS NULL
                   AND rejected_at IS NULL",
                params![scan_root_id],
            )
            .map_err(|error| error.to_string())?;

        for (video_id, video_path) in file_locations {
            for folder_segment in metadata_suggestion_segments(
                scan_root_path,
                &video_path,
                &scan_root.inference_rules,
            ) {
                let suggested_value = metadata_suggestion_display_value(&folder_segment);
                let has_source_rejection = transaction
                    .query_row(
                        "SELECT 1
                         FROM metadata_suggestion_rejections
                         WHERE scan_root_id = ?1
                           AND source_path_segment = ?2
                           AND normalized_suggested_value = lower(?3)
                           AND suggestion_kind = 'tag'
                         LIMIT 1",
                        params![scan_root_id, folder_segment, suggested_value],
                        |_| Ok(()),
                    )
                    .optional()
                    .map_err(|error| error.to_string())?
                    .is_some();

                if has_source_rejection {
                    continue;
                }

                transaction
                    .execute(
                        "INSERT INTO metadata_suggestions (
                            scan_root_id,
                            video_id,
                            source_path_segment,
                            suggested_value,
                            suggestion_kind
                         )
                         VALUES (?1, ?2, ?3, ?4, 'tag')
                         ON CONFLICT(scan_root_id, video_id, source_path_segment, suggestion_kind)
                         DO UPDATE SET
                            suggested_value = excluded.suggested_value,
                            updated_at = CURRENT_TIMESTAMP",
                        params![scan_root_id, video_id, folder_segment, suggested_value],
                    )
                    .map_err(|error| error.to_string())?;
            }
        }

        transaction.commit().map_err(|error| error.to_string())
    }

    fn file_locations_for_metadata_inference(
        &self,
        scan_root_id: i64,
    ) -> Result<Vec<(i64, String)>, String> {
        let mut statement = self
            .database
            .prepare(
                "SELECT video_id, path
                 FROM file_locations
                 WHERE scan_root_id = ?1
                 ORDER BY path",
            )
            .map_err(|error| error.to_string())?;

        let file_locations = statement
            .query_map(params![scan_root_id], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(file_locations)
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

fn catalog_table_has_column(
    database: &Connection,
    table_name: &str,
    column_name: &str,
) -> Result<bool, String> {
    let mut statement = database
        .prepare(&format!("PRAGMA table_info({table_name})"))
        .map_err(|error| error.to_string())?;
    let column_names = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(column_names
        .iter()
        .any(|existing_column_name| existing_column_name == column_name))
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
    for directory_entry in fs::read_dir(folder_path).map_err(|error| error.to_string())? {
        let directory_entry = directory_entry.map_err(|error| error.to_string())?;
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
    video_path
        .file_stem()
        .and_then(|file_name| file_name.to_str())
        .map(|file_name| file_name.to_string())
        .ok_or_else(|| "Video Title could not be read from filename".to_string())
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
        suggest_tags_from_child_folders: row.get::<_, i64>(2)? == 1,
        suggest_performers_from_child_folders: row.get::<_, i64>(3)? == 1,
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

fn group_metadata_suggestions(
    suggestion_rows: Vec<MetadataSuggestionRow>,
) -> Vec<MetadataSuggestionGroup> {
    let mut suggestion_groups = Vec::new();

    for suggestion_row in suggestion_rows {
        if !metadata_suggestion_segments(
            &suggestion_row.scan_root_path,
            &suggestion_row.file_location_path,
            &suggestion_row.inference_rules,
        )
        .contains(&suggestion_row.source_path_segment)
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

fn metadata_suggestion_segments(
    scan_root_path: &str,
    video_path: &str,
    inference_rules: &ScanRootInferenceRules,
) -> Vec<String> {
    if !inference_rules.suggest_tags_from_child_folders {
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
mod tests {
    use super::{Catalog, FailedPreviewStrip, PreviewStripRetryReason, VideoFileProbe, VideoProbe};
    use rusqlite::{params, Connection};
    use std::path::Path;

    #[test]
    fn catalog_persists_scan_roots_and_rejects_overlapping_paths() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");

        let movies_root = temporary_folder.path().join("Movies");
        let documentaries_root = temporary_folder.path().join("Documentaries");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        std::fs::create_dir_all(&documentaries_root).expect("documentaries root exists");

        catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");
        catalog
            .add_scan_root(&documentaries_root)
            .expect("documentaries scan root adds");

        assert_eq!(
            catalog.list_scan_roots().expect("scan roots list"),
            vec![
                super::ScanRoot {
                    inference_rules: super::ScanRootInferenceRules::default(),
                    is_available: true,
                    path: documentaries_root
                        .canonicalize()
                        .expect("documentaries path canonicalizes")
                        .to_string_lossy()
                        .into_owned(),
                },
                super::ScanRoot {
                    inference_rules: super::ScanRootInferenceRules::default(),
                    is_available: true,
                    path: movies_root
                        .canonicalize()
                        .expect("movies path canonicalizes")
                        .to_string_lossy()
                        .into_owned(),
                },
            ]
        );

        let nested_movies_root = movies_root.join("Family");
        std::fs::create_dir_all(&nested_movies_root).expect("nested movies root exists");
        let add_nested_root_error = catalog
            .add_scan_root(&nested_movies_root)
            .expect_err("nested scan root is rejected");

        assert_eq!(
            add_nested_root_error,
            "Scan Root overlaps with an existing Scan Root"
        );
    }

    #[test]
    fn new_scan_roots_store_default_inference_rules_for_child_folder_tags_only() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");

        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");

        let scan_root = catalog
            .add_scan_root(&movies_root)
            .expect("scan root adds with inference rules");

        assert_eq!(
            scan_root.inference_rules,
            super::ScanRootInferenceRules {
                suggest_tags_from_child_folders: true,
                suggest_performers_from_child_folders: false,
                ignored_folder_names: vec![
                    "Misc".to_string(),
                    "Unsorted".to_string(),
                    "To Sort".to_string(),
                    "To Review".to_string(),
                    "New".to_string(),
                    "Temp".to_string(),
                    "Archive".to_string(),
                    "Archives".to_string(),
                    "Downloads".to_string(),
                    "Videos".to_string(),
                ],
                ignored_exact_year_range: super::ExactYearRange {
                    start_year: 1900,
                    end_year: 2099,
                },
            }
        );

        assert_eq!(
            catalog.list_scan_roots().expect("scan roots list"),
            vec![scan_root]
        );
    }

    #[test]
    fn scan_root_inference_rules_can_be_changed_without_changing_accepted_local_metadata() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");

        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        let scan_root = catalog
            .add_scan_root(&movies_root)
            .expect("scan root adds with inference rules");
        store_test_video(&catalog.database, "family-trip-fingerprint", "Family Trip");
        let video_id = catalog
            .database
            .query_row(
                "SELECT id FROM videos WHERE fingerprint = ?1",
                ["family-trip-fingerprint"],
                |row| row.get::<_, i64>(0),
            )
            .expect("video id loads");
        let tag = catalog.create_tag("Family").expect("tag creates");
        catalog
            .attach_tag_to_video(tag.id, video_id)
            .expect("tag attaches");
        let changed_inference_rules = super::ScanRootInferenceRules {
            suggest_tags_from_child_folders: true,
            suggest_performers_from_child_folders: false,
            ignored_folder_names: vec!["Extras".to_string(), "Temp".to_string()],
            ignored_exact_year_range: super::ExactYearRange {
                start_year: 1900,
                end_year: 2099,
            },
        };

        let changed_scan_root = catalog
            .update_scan_root_inference_rules(&scan_root.path, changed_inference_rules)
            .expect("scan root inference rules update");

        assert_eq!(
            changed_scan_root.inference_rules.ignored_folder_names,
            vec!["Extras".to_string(), "Temp".to_string()]
        );
        assert_eq!(
            catalog.tags_for_video(video_id).expect("video tags list"),
            vec![tag]
        );
    }

    #[test]
    fn scan_root_refresh_generates_tag_suggestions_from_allowed_child_folder_segments_only() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        let video_folder = movies_root.join("Videos").join("2024").join("Family");
        std::fs::create_dir_all(&video_folder).expect("video folder exists");
        let family_trip_path = video_folder.join("family-trip.mp4");
        std::fs::write(&family_trip_path, "valid video bytes").expect("family video exists");
        let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");

        catalog
            .refresh_scan_root(
                &scan_root.path,
                &FakeVideoFileProbe::with_duration(1_000),
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("scan root refreshes");

        assert_eq!(
            metadata_suggestions(&catalog.database),
            vec![("Family".to_string(), "tag".to_string())]
        );
    }

    #[test]
    fn metadata_suggestions_normalize_display_text_while_preserving_original_source_segment() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        let video_folder = movies_root.join("  Family Trip  ");
        std::fs::create_dir_all(&video_folder).expect("video folder exists");
        let family_trip_path = video_folder.join("family-trip.mp4");
        std::fs::write(&family_trip_path, "valid video bytes").expect("family video exists");
        let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");

        catalog
            .refresh_scan_root(
                &scan_root.path,
                &FakeVideoFileProbe::with_duration(1_000),
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("scan root refreshes");

        assert_eq!(
            metadata_suggestion_sources(&catalog.database),
            vec![(
                "  Family Trip  ".to_string(),
                "Family Trip".to_string(),
                "tag".to_string()
            )]
        );
    }

    #[test]
    fn metadata_suggestion_display_normalization_controls_ignored_segments() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        let family_folder = movies_root.join("Family");
        let ignored_folder = movies_root.join("  Extras  ");
        let year_folder = movies_root.join("  2024  ");
        let blank_folder = movies_root.join("   ");
        std::fs::create_dir_all(&family_folder).expect("family folder exists");
        std::fs::create_dir_all(&ignored_folder).expect("ignored folder exists");
        std::fs::create_dir_all(&year_folder).expect("year folder exists");
        std::fs::create_dir_all(&blank_folder).expect("blank folder exists");
        std::fs::write(family_folder.join("family-trip.mp4"), "valid video bytes")
            .expect("family video exists");
        std::fs::write(ignored_folder.join("extras.mp4"), "valid video bytes")
            .expect("ignored video exists");
        std::fs::write(year_folder.join("year.mp4"), "valid video bytes")
            .expect("year video exists");
        std::fs::write(blank_folder.join("blank.mp4"), "valid video bytes")
            .expect("blank video exists");
        let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
        catalog
            .update_scan_root_inference_rules(
                &scan_root.path,
                super::ScanRootInferenceRules {
                    suggest_tags_from_child_folders: true,
                    suggest_performers_from_child_folders: false,
                    ignored_folder_names: vec!["Extras".to_string()],
                    ignored_exact_year_range: super::ExactYearRange {
                        start_year: 1900,
                        end_year: 2099,
                    },
                },
            )
            .expect("inference rules update");

        catalog
            .refresh_scan_root(
                &scan_root.path,
                &FakeVideoFileProbe::with_duration(1_000),
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("scan root refreshes");

        assert_eq!(
            metadata_suggestions(&catalog.database),
            vec![("Family".to_string(), "tag".to_string())]
        );
    }

    #[test]
    fn changing_scan_root_inference_rules_regenerates_unaccepted_suggestions_only() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        let video_folder = movies_root.join("Travel").join("Family");
        std::fs::create_dir_all(&video_folder).expect("video folder exists");
        let family_trip_path = video_folder.join("family-trip.mp4");
        std::fs::write(&family_trip_path, "valid video bytes").expect("family video exists");
        let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
        catalog
            .refresh_scan_root(
                &scan_root.path,
                &FakeVideoFileProbe::with_duration(1_000),
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("scan root refreshes");
        catalog
            .database
            .execute(
                "UPDATE metadata_suggestions
                 SET accepted_at = CURRENT_TIMESTAMP
                 WHERE suggested_value = 'Travel'",
                [],
            )
            .expect("suggestion accepts");

        catalog
            .update_scan_root_inference_rules(
                &scan_root.path,
                super::ScanRootInferenceRules {
                    suggest_tags_from_child_folders: true,
                    suggest_performers_from_child_folders: false,
                    ignored_folder_names: vec![" Family ".to_string(), "family".to_string()],
                    ignored_exact_year_range: super::ExactYearRange {
                        start_year: 1900,
                        end_year: 2099,
                    },
                },
            )
            .expect("inference rules update");

        assert_eq!(
            metadata_suggestions(&catalog.database),
            vec![("Travel".to_string(), "tag".to_string())]
        );
    }

    #[test]
    fn pending_metadata_suggestions_are_grouped_by_value_source_and_affected_videos() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        let family_folder = movies_root.join("  Family  ");
        let travel_folder = movies_root.join("Travel");
        std::fs::create_dir_all(&family_folder).expect("family folder exists");
        std::fs::create_dir_all(&travel_folder).expect("travel folder exists");
        let family_trip_bytes = "valid family trip bytes";
        std::fs::write(family_folder.join("family-trip.mp4"), family_trip_bytes)
            .expect("family trip video exists");
        std::fs::write(family_folder.join("birthday.mp4"), "valid birthday bytes")
            .expect("birthday video exists");
        std::fs::write(
            travel_folder.join("family-trip-copy.mp4"),
            family_trip_bytes,
        )
        .expect("duplicate travel video location exists");
        let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
        catalog
            .refresh_scan_root(
                &scan_root.path,
                &FakeVideoFileProbe::with_duration(1_000),
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("scan root refreshes");
        catalog
            .database
            .execute(
                "UPDATE metadata_suggestions
                 SET accepted_at = CURRENT_TIMESTAMP
                 WHERE suggested_value = 'Travel'",
                [],
            )
            .expect("travel suggestion accepts");
        catalog
            .database
            .execute(
                "UPDATE metadata_suggestions
                 SET suggested_value = 'family'
                 WHERE suggested_value = 'Family'
                   AND video_id = (
                     SELECT id FROM videos WHERE title = 'birthday'
                   )",
                [],
            )
            .expect("case variant suggestion stores");

        let suggestion_groups = catalog
            .list_metadata_suggestion_groups()
            .expect("metadata suggestion groups list");

        assert_eq!(suggestion_groups.len(), 1);
        assert_eq!(suggestion_groups[0].suggested_value, "Family");
        assert_eq!(suggestion_groups[0].suggestion_kind, "tag");
        assert_eq!(suggestion_groups[0].sources.len(), 1);
        assert_eq!(
            suggestion_groups[0].sources[0].source_path_segment,
            "  Family  "
        );
        assert_eq!(suggestion_groups[0].sources[0].videos.len(), 2);
        assert_eq!(
            suggestion_groups[0].sources[0]
                .videos
                .iter()
                .map(|video| video.title.as_str())
                .collect::<Vec<_>>(),
            vec!["birthday", "family-trip"]
        );
        assert_eq!(
            suggestion_groups[0].sources[0]
                .videos
                .iter()
                .map(|video| video.file_location_path.contains("Travel"))
                .collect::<Vec<_>>(),
            vec![false, false]
        );
    }

    #[test]
    fn accepting_metadata_suggestion_for_many_videos_excludes_selected_videos_without_touching_files(
    ) {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        let family_folder = movies_root.join("Family");
        std::fs::create_dir_all(&family_folder).expect("family folder exists");
        let accepted_video_path = family_folder.join("accepted.mp4");
        let excluded_video_path = family_folder.join("excluded.mp4");
        std::fs::write(&accepted_video_path, "accepted video bytes")
            .expect("accepted video exists");
        std::fs::write(&excluded_video_path, "excluded video bytes")
            .expect("excluded video exists");
        let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
        catalog
            .refresh_scan_root(
                &scan_root.path,
                &FakeVideoFileProbe::with_duration(1_000),
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("scan root refreshes");
        let accepted_video_id = video_id_for_title(&catalog.database, "accepted");
        let excluded_video_id = video_id_for_title(&catalog.database, "excluded");

        catalog
            .accept_metadata_suggestion_for_videos(
                &scan_root.path,
                "Family",
                "tag",
                None,
                None,
                &[accepted_video_id],
            )
            .expect("metadata suggestion accepts");

        assert_eq!(
            catalog
                .tags_for_video(accepted_video_id)
                .expect("accepted video tags list"),
            vec![super::CatalogTag {
                id: 1,
                name: "Family".to_string()
            }]
        );
        assert_eq!(
            catalog
                .tags_for_video(excluded_video_id)
                .expect("excluded video tags list"),
            Vec::<super::CatalogTag>::new()
        );
        assert_eq!(
            catalog
                .list_metadata_suggestion_groups()
                .expect("metadata suggestions list")[0]
                .sources[0]
                .videos
                .iter()
                .map(|video| video.video_id)
                .collect::<Vec<_>>(),
            vec![excluded_video_id]
        );
        assert!(accepted_video_path.exists());
        assert!(excluded_video_path.exists());
    }

    #[test]
    fn accepting_metadata_suggestion_can_create_a_performer_instead_of_a_tag() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        let family_folder = movies_root.join("Family");
        std::fs::create_dir_all(&family_folder).expect("family folder exists");
        std::fs::write(family_folder.join("family-trip.mp4"), "valid video bytes")
            .expect("family video exists");
        let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
        catalog
            .refresh_scan_root(
                &scan_root.path,
                &FakeVideoFileProbe::with_duration(1_000),
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("scan root refreshes");
        let video_id = video_id_for_title(&catalog.database, "family-trip");

        catalog
            .accept_metadata_suggestion_for_videos(
                &scan_root.path,
                "Family",
                "tag",
                Some("performer"),
                Some("The Family"),
                &[video_id],
            )
            .expect("metadata suggestion accepts as performer");

        assert_eq!(
            catalog
                .performers_for_video(video_id)
                .expect("video performers list"),
            vec![super::CatalogPerformer {
                id: 1,
                name: "The Family".to_string()
            }]
        );
        assert_eq!(
            catalog.tags_for_video(video_id).expect("video tags list"),
            Vec::<super::CatalogTag>::new()
        );
        assert_eq!(
            catalog
                .list_metadata_suggestion_groups()
                .expect("metadata suggestions list"),
            Vec::<super::MetadataSuggestionGroup>::new()
        );
    }

    #[test]
    fn accepting_metadata_suggestion_can_map_to_an_existing_tag_with_a_different_name() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let existing_tag = catalog.create_tag("Home Movies").expect("tag creates");
        let movies_root = temporary_folder.path().join("Movies");
        let family_folder = movies_root.join("Family");
        std::fs::create_dir_all(&family_folder).expect("family folder exists");
        std::fs::write(family_folder.join("family-trip.mp4"), "valid video bytes")
            .expect("family video exists");
        let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
        catalog
            .refresh_scan_root(
                &scan_root.path,
                &FakeVideoFileProbe::with_duration(1_000),
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("scan root refreshes");
        let video_id = video_id_for_title(&catalog.database, "family-trip");

        catalog
            .accept_metadata_suggestion_for_videos(
                &scan_root.path,
                "Family",
                "tag",
                None,
                Some("home movies"),
                &[video_id],
            )
            .expect("metadata suggestion accepts as existing tag");

        assert_eq!(
            catalog.tags_for_video(video_id).expect("video tags list"),
            vec![existing_tag]
        );
        assert_eq!(
            catalog
                .list_tags()
                .expect("tags list")
                .into_iter()
                .map(|tag| tag.name)
                .collect::<Vec<_>>(),
            vec!["Home Movies".to_string()]
        );
    }

    #[test]
    fn accepting_one_metadata_suggestion_kind_keeps_other_pending_kinds_with_the_same_value() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        let family_folder = movies_root.join("Family");
        std::fs::create_dir_all(&family_folder).expect("family folder exists");
        std::fs::write(family_folder.join("family-trip.mp4"), "valid video bytes")
            .expect("family video exists");
        let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
        catalog
            .refresh_scan_root(
                &scan_root.path,
                &FakeVideoFileProbe::with_duration(1_000),
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("scan root refreshes");
        let scan_root_id = catalog
            .scan_root_id(&scan_root.path)
            .expect("scan root id exists");
        let video_id = video_id_for_title(&catalog.database, "family-trip");
        catalog
            .database
            .execute(
                "INSERT INTO metadata_suggestions (
                    scan_root_id,
                    video_id,
                    source_path_segment,
                    suggested_value,
                    suggestion_kind
                 )
                 VALUES (?1, ?2, 'Family', 'Family', 'performer')",
                params![scan_root_id, video_id],
            )
            .expect("performer suggestion inserts");

        catalog
            .accept_metadata_suggestion_for_videos(
                &scan_root.path,
                "Family",
                "tag",
                None,
                None,
                &[video_id],
            )
            .expect("tag suggestion accepts");

        let remaining_suggestion_groups = catalog
            .list_metadata_suggestion_groups()
            .expect("metadata suggestions list");
        assert_eq!(remaining_suggestion_groups.len(), 1);
        assert_eq!(remaining_suggestion_groups[0].suggestion_kind, "performer");
        assert_eq!(remaining_suggestion_groups[0].suggested_value, "Family");
    }

    #[test]
    fn rejecting_metadata_suggestion_source_suppresses_repeated_suggestions_for_the_same_source_value(
    ) {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        let family_folder = movies_root.join("Family");
        std::fs::create_dir_all(&family_folder).expect("family folder exists");
        std::fs::write(family_folder.join("family-trip.mp4"), "valid video bytes")
            .expect("family video exists");
        let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
        catalog
            .refresh_scan_root(
                &scan_root.path,
                &FakeVideoFileProbe::with_duration(1_000),
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("scan root refreshes");

        catalog
            .reject_metadata_suggestion_source(&scan_root.path, "Family", "Family", "tag")
            .expect("metadata suggestion rejects");
        catalog
            .refresh_scan_root(
                &scan_root.path,
                &FakeVideoFileProbe::with_duration(1_000),
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("scan root refreshes again");

        assert_eq!(
            catalog
                .list_metadata_suggestion_groups()
                .expect("metadata suggestions list"),
            Vec::<super::MetadataSuggestionGroup>::new()
        );
        assert!(family_folder.join("family-trip.mp4").exists());
    }

    #[test]
    fn rejected_metadata_suggestion_source_suppresses_new_videos_from_the_same_source_value() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        let family_folder = movies_root.join("Family");
        std::fs::create_dir_all(&family_folder).expect("family folder exists");
        std::fs::write(
            family_folder.join("family-trip.mp4"),
            "valid family trip bytes",
        )
        .expect("family video exists");
        let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
        catalog
            .refresh_scan_root(
                &scan_root.path,
                &FakeVideoFileProbe::with_duration(1_000),
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("scan root refreshes");
        catalog
            .reject_metadata_suggestion_source(&scan_root.path, "Family", "Family", "tag")
            .expect("metadata suggestion rejects");
        std::fs::write(family_folder.join("birthday.mp4"), "valid birthday bytes")
            .expect("new family video exists");

        catalog
            .refresh_scan_root(
                &scan_root.path,
                &FakeVideoFileProbe::with_duration(1_000),
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("scan root refreshes again");

        assert_eq!(
            catalog
                .list_metadata_suggestion_groups()
                .expect("metadata suggestions list"),
            Vec::<super::MetadataSuggestionGroup>::new()
        );
    }

    #[test]
    fn accepting_metadata_suggestion_rejects_videos_without_a_pending_matching_suggestion() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        let family_folder = movies_root.join("Family");
        let travel_folder = movies_root.join("Travel");
        std::fs::create_dir_all(&family_folder).expect("family folder exists");
        std::fs::create_dir_all(&travel_folder).expect("travel folder exists");
        std::fs::write(
            family_folder.join("family-trip.mp4"),
            "valid family trip bytes",
        )
        .expect("family video exists");
        std::fs::write(
            travel_folder.join("travel-trip.mp4"),
            "valid travel trip bytes",
        )
        .expect("travel video exists");
        let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");
        catalog
            .refresh_scan_root(
                &scan_root.path,
                &FakeVideoFileProbe::with_duration(1_000),
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("scan root refreshes");
        let travel_video_id = video_id_for_title(&catalog.database, "travel-trip");

        let accept_error = catalog
            .accept_metadata_suggestion_for_videos(
                &scan_root.path,
                "Family",
                "tag",
                None,
                None,
                &[travel_video_id],
            )
            .expect_err("unmatched suggestion acceptance is rejected");

        assert_eq!(
            accept_error,
            "Selected Videos must have pending Metadata Suggestions"
        );
        assert_eq!(
            catalog
                .tags_for_video(travel_video_id)
                .expect("travel video tags list"),
            Vec::<super::CatalogTag>::new()
        );
    }

    #[test]
    fn invalid_scan_root_inference_rules_are_rejected() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        let scan_root = catalog.add_scan_root(&movies_root).expect("scan root adds");

        let update_error = catalog
            .update_scan_root_inference_rules(
                &scan_root.path,
                super::ScanRootInferenceRules {
                    suggest_tags_from_child_folders: true,
                    suggest_performers_from_child_folders: false,
                    ignored_folder_names: vec![" ".to_string()],
                    ignored_exact_year_range: super::ExactYearRange {
                        start_year: 2100,
                        end_year: 1900,
                    },
                },
            )
            .expect_err("invalid rules are rejected");

        assert_eq!(
            update_error,
            "Ignored exact year range start must be before or equal to end"
        );
    }

    #[test]
    fn refreshing_an_unreachable_scan_root_marks_it_unavailable_without_discarding_catalog_metadata(
    ) {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        let scan_root = catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");
        let family_trip_path = movies_root.join("family-trip.mp4");
        std::fs::write(&family_trip_path, "valid video bytes").expect("video file exists");
        let video_file_probe = FakeVideoFileProbe::with_duration(1_000);
        catalog
            .refresh_scan_root(
                &scan_root.path,
                &video_file_probe,
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("initial scan root refreshes");
        std::fs::remove_dir_all(&movies_root).expect("scan root becomes unreachable");

        let refresh_summary = catalog
            .refresh_scan_root(
                &scan_root.path,
                &video_file_probe,
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("unreachable scan root refresh completes");

        assert_eq!(
            refresh_summary,
            super::ScanRootRefreshSummary {
                scanned_video_count: 0,
                unprocessable_candidate_count: 0,
            }
        );
        assert_eq!(
            catalog.list_scan_roots().expect("scan roots list"),
            vec![super::ScanRoot {
                inference_rules: super::ScanRootInferenceRules::default(),
                is_available: false,
                path: scan_root.path,
            }]
        );
        assert_eq!(
            catalog.listed_videos().expect("stored videos list"),
            vec![super::CatalogVideo {
                id: 1,
                is_available: false,
                preview_strip: super::PreviewStripStatus::Pending,
                title: "family-trip".to_string(),
                duration_milliseconds: 1_000,
                file_size_bytes: None,
                file_location_path: None,
                file_locations: Vec::new(),
                is_favorite: false,
                last_opened_at: None,
                open_count: 0,
            }]
        );
    }

    #[test]
    fn listed_videos_include_editable_metadata_and_all_file_locations() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let database = Connection::open(catalog_path).expect("catalog database opens");
        let primary_location = "/Volumes/Archive/Videos/family-trip.mp4";
        let secondary_location = "/Volumes/Backup/Videos/family-trip.mp4";

        database
            .execute(
                "INSERT INTO scan_roots (id, path, drive_identity)
                 VALUES (1, '/Volumes/Archive/Videos', NULL),
                        (2, '/Volumes/Backup/Videos', NULL)",
                [],
            )
            .expect("scan roots persist");
        database
            .execute(
                "INSERT INTO videos (id, fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (1, 'fingerprint', 1, 'Family Trip', 3723000)",
                [],
            )
            .expect("video persists");
        database
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (1, 1, ?1, 80740352, CURRENT_TIMESTAMP),
                        (1, 2, ?2, 80740352, CURRENT_TIMESTAMP)",
                rusqlite::params![primary_location, secondary_location],
            )
            .expect("file locations persist");

        catalog
            .update_video_title(1, "Family Archive")
            .expect("title updates");
        catalog
            .set_video_favorite(1, true)
            .expect("favorite updates");

        assert_eq!(
            catalog.listed_videos().expect("stored videos list"),
            vec![super::CatalogVideo {
                id: 1,
                is_available: true,
                preview_strip: super::PreviewStripStatus::Pending,
                title: "Family Archive".to_string(),
                duration_milliseconds: 3723000,
                file_size_bytes: Some(80740352),
                file_location_path: Some(primary_location.to_string()),
                file_locations: vec![
                    super::CatalogVideoFileLocation {
                        path: primary_location.to_string(),
                        file_size_bytes: 80740352,
                        is_preferred: true,
                    },
                    super::CatalogVideoFileLocation {
                        path: secondary_location.to_string(),
                        file_size_bytes: 80740352,
                        is_preferred: false,
                    },
                ],
                is_favorite: true,
                last_opened_at: None,
                open_count: 0,
            }]
        );
    }

    #[test]
    fn opening_a_video_records_open_history_without_playback_progress() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let database = Connection::open(&catalog_path).expect("catalog database opens");

        database
            .execute(
                "INSERT INTO videos (id, fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (1, 'fingerprint', 1, 'Family Trip', 3723000)",
                [],
            )
            .expect("video persists");

        catalog.record_video_opened(1).expect("first open records");
        catalog.record_video_opened(1).expect("second open records");

        let listed_video = catalog
            .listed_videos()
            .expect("stored videos list")
            .pop()
            .expect("video listed");
        assert_eq!(listed_video.open_count, 2);
        assert!(listed_video.last_opened_at.is_some());
        assert!(
            !super::catalog_table_has_column(&database, "videos", "playback_progress")
                .expect("column presence loads")
        );
    }

    #[test]
    fn listed_missing_videos_are_explicitly_unavailable() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        let scan_root = catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");
        let family_trip_path = movies_root.join("family-trip.mp4");
        std::fs::write(&family_trip_path, "valid video bytes").expect("video file exists");
        let video_file_probe = FakeVideoFileProbe::with_duration(1_000);
        catalog
            .refresh_scan_root(
                &scan_root.path,
                &video_file_probe,
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("initial scan root refreshes");
        std::fs::remove_file(&family_trip_path).expect("video file is removed");
        catalog
            .refresh_scan_root(
                &scan_root.path,
                &video_file_probe,
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("second scan root refreshes");

        assert_eq!(
            catalog.listed_videos().expect("stored videos list"),
            vec![super::CatalogVideo {
                id: 1,
                is_available: false,
                preview_strip: super::PreviewStripStatus::Pending,
                title: "family-trip".to_string(),
                duration_milliseconds: 1_000,
                file_size_bytes: None,
                file_location_path: None,
                file_locations: Vec::new(),
                is_favorite: false,
                last_opened_at: None,
                open_count: 0,
            }]
        );
    }

    #[test]
    fn listed_videos_include_preview_strip_status() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let database = catalog_test_database(&catalog_path);

        database
            .execute(
                "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
                ("generated-fingerprint", 1_i64, "Generated Trip", 1_000_i64),
            )
            .expect("generated video persists");
        database
            .execute(
                "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
                ("failed-fingerprint", 1_i64, "Failed Trip", 1_000_i64),
            )
            .expect("failed video persists");
        database
            .execute(
                "INSERT INTO preview_strips (video_id, path, frame_count, column_count, row_count)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    "/Users/michel/Library/Caches/preview-strips/video-1-preview-strip.jpg",
                    40_i64,
                    5_i64,
                    8_i64,
                ),
            )
            .expect("preview strip persists");
        database
            .execute(
                "INSERT INTO failed_preview_strips (video_id, reason)
                 VALUES (?1, ?2)",
                (2_i64, "ffmpeg failed"),
            )
            .expect("failed preview strip persists");

        assert_eq!(
            catalog.listed_videos().expect("stored videos list"),
            vec![
                super::CatalogVideo {
                    id: 2,
                    is_available: false,
                    preview_strip: super::PreviewStripStatus::Failed {
                        failure_reason: "ffmpeg failed".to_string(),
                    },
                    title: "Failed Trip".to_string(),
                    duration_milliseconds: 1_000,
                    file_size_bytes: None,
                    file_location_path: None,
                    file_locations: Vec::new(),
                    is_favorite: false,
                    last_opened_at: None,
                    open_count: 0,
                },
                super::CatalogVideo {
                    id: 1,
                    is_available: false,
                    preview_strip: super::PreviewStripStatus::Generated {
                        path:
                            "/Users/michel/Library/Caches/preview-strips/video-1-preview-strip.jpg"
                                .to_string(),
                        frame_count: 40,
                        column_count: 5,
                        row_count: 8,
                    },
                    title: "Generated Trip".to_string(),
                    duration_milliseconds: 1_000,
                    file_size_bytes: None,
                    file_location_path: None,
                    file_locations: Vec::new(),
                    is_favorite: false,
                    last_opened_at: None,
                    open_count: 0,
                },
            ]
        );
    }

    #[test]
    fn unreachable_scan_root_refresh_can_complete_without_a_video_file_probe() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        let scan_root = catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");
        std::fs::remove_dir_all(&movies_root).expect("scan root becomes unreachable");

        let refresh_summary = catalog
            .refresh_scan_root_if_unreachable(&scan_root.path)
            .expect("unreachable scan root refreshes without probe");

        assert_eq!(
            refresh_summary,
            Some(super::ScanRootRefreshSummary {
                scanned_video_count: 0,
                unprocessable_candidate_count: 0,
            })
        );
        assert_eq!(
            catalog.list_scan_roots().expect("scan roots list"),
            vec![super::ScanRoot {
                inference_rules: super::ScanRootInferenceRules::default(),
                is_available: false,
                path: scan_root.path,
            }]
        );
    }

    #[test]
    fn refreshing_all_scan_roots_updates_each_root_and_marks_missing_videos() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let available_root = temporary_folder.path().join("Available Movies");
        let unavailable_root = temporary_folder.path().join("Missing Movies");
        std::fs::create_dir_all(&available_root).expect("available root exists");
        std::fs::create_dir_all(&unavailable_root).expect("unavailable root exists");
        let available_scan_root = catalog
            .add_scan_root(&available_root)
            .expect("available scan root adds");
        let unavailable_scan_root = catalog
            .add_scan_root(&unavailable_root)
            .expect("unavailable scan root adds");
        let family_trip_path = available_root.join("family-trip.mp4");
        let archived_trip_path = unavailable_root.join("archived-trip.mp4");
        std::fs::write(&family_trip_path, "valid video bytes").expect("family video exists");
        std::fs::write(&archived_trip_path, "archived video bytes").expect("archived video exists");
        let video_file_probe = FakeVideoFileProbe::with_duration(1_000);
        catalog
            .refresh_all_scan_roots(
                &video_file_probe,
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("initial all scan roots refresh");
        std::fs::remove_dir_all(&unavailable_root).expect("one root becomes unavailable");

        let refresh_summary = catalog
            .refresh_all_scan_roots(
                &video_file_probe,
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("all scan roots refresh");

        assert_eq!(
            refresh_summary,
            super::ScanRootRefreshSummary {
                scanned_video_count: 1,
                unprocessable_candidate_count: 0,
            }
        );
        assert_eq!(
            catalog.list_scan_roots().expect("scan roots list"),
            vec![
                super::ScanRoot {
                    inference_rules: super::ScanRootInferenceRules::default(),
                    is_available: true,
                    path: available_scan_root.path,
                },
                super::ScanRoot {
                    inference_rules: super::ScanRootInferenceRules::default(),
                    is_available: false,
                    path: unavailable_scan_root.path,
                },
            ]
        );
        assert_eq!(
            catalog.listed_videos().expect("stored videos list"),
            vec![
                super::CatalogVideo {
                    id: 2,
                    is_available: false,
                    preview_strip: super::PreviewStripStatus::Pending,
                    title: "archived-trip".to_string(),
                    duration_milliseconds: 1_000,
                    file_size_bytes: None,
                    file_location_path: None,
                    file_locations: Vec::new(),
                    is_favorite: false,
                    last_opened_at: None,
                    open_count: 0,
                },
                super::CatalogVideo {
                    id: 1,
                    is_available: true,
                    preview_strip: super::PreviewStripStatus::Pending,
                    title: "family-trip".to_string(),
                    duration_milliseconds: 1_000,
                    file_size_bytes: Some(17),
                    file_location_path: Some(
                        family_trip_path
                            .canonicalize()
                            .expect("family trip path canonicalizes")
                            .to_string_lossy()
                            .into_owned()
                    ),
                    file_locations: vec![super::CatalogVideoFileLocation {
                        path: family_trip_path
                            .canonicalize()
                            .expect("family trip path canonicalizes")
                            .to_string_lossy()
                            .into_owned(),
                        file_size_bytes: 17,
                        is_preferred: true,
                    }],
                    is_favorite: false,
                    last_opened_at: None,
                    open_count: 0,
                },
            ]
        );
    }

    #[test]
    fn removing_scan_root_can_preserve_affected_videos_as_missing() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        let scan_root = catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");

        catalog_test_database(&catalog_path)
            .execute(
                "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
                ("fingerprint-one", 1_i64, "Family Trip", 3723000_i64),
            )
            .expect("video persists");
        catalog_test_database(&catalog_path)
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    1_i64,
                    movies_root.join("family-trip.mp4").to_string_lossy().into_owned(),
                    80740352_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("file location persists");

        catalog
            .remove_scan_root_preserving_missing_videos(&scan_root.path)
            .expect("scan root removes");

        let database = catalog_test_database(&catalog_path);
        assert_eq!(count_rows(&database, "scan_roots"), 0);
        assert_eq!(count_rows(&database, "file_locations"), 0);
        assert_eq!(count_rows(&database, "videos"), 1);
        assert_eq!(
            catalog.listed_videos().expect("stored videos list"),
            vec![super::CatalogVideo {
                id: 1,
                is_available: false,
                preview_strip: super::PreviewStripStatus::Pending,
                title: "Family Trip".to_string(),
                duration_milliseconds: 3723000,
                file_size_bytes: None,
                file_location_path: None,
                file_locations: Vec::new(),
                is_favorite: false,
                last_opened_at: None,
                open_count: 0,
            }]
        );
    }

    #[test]
    fn refreshing_a_scan_root_recursively_stores_probeable_videos() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        let family_folder = movies_root.join("Family");
        std::fs::create_dir_all(&family_folder).expect("family folder exists");
        let scan_root = catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");
        let family_trip_path = family_folder.join("Family Trip.FLV");
        std::fs::write(&family_trip_path, "video bytes").expect("video file exists");
        let video_file_probe = FakeVideoFileProbe::with_duration(3_723_000);

        let refresh_summary = catalog
            .refresh_scan_root(
                &scan_root.path,
                &video_file_probe,
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("scan root refreshes");

        assert_eq!(
            refresh_summary,
            super::ScanRootRefreshSummary {
                scanned_video_count: 1,
                unprocessable_candidate_count: 0,
            }
        );
        let expected_family_trip_path = family_trip_path
            .canonicalize()
            .expect("family trip path canonicalizes");
        assert_eq!(
            catalog.listed_videos().expect("stored videos list"),
            vec![super::CatalogVideo {
                id: 1,
                is_available: true,
                preview_strip: super::PreviewStripStatus::Pending,
                title: "Family Trip".to_string(),
                duration_milliseconds: 3_723_000,
                file_size_bytes: Some(11),
                file_location_path: Some(expected_family_trip_path.to_string_lossy().into_owned()),
                file_locations: vec![super::CatalogVideoFileLocation {
                    path: expected_family_trip_path.to_string_lossy().into_owned(),
                    file_size_bytes: 11,
                    is_preferred: true,
                }],
                is_favorite: false,
                last_opened_at: None,
                open_count: 0,
            }]
        );
    }

    #[test]
    fn preview_strip_generation_stores_one_cache_file_for_each_video_without_a_preview_strip() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let preview_cache_path = temporary_folder.path().join("Preview Cache");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        let scan_root = catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");
        let family_trip_path = movies_root.join("family-trip.mp4");
        std::fs::write(&family_trip_path, "valid video bytes").expect("video file exists");
        let video_file_probe = FakeVideoFileProbe::with_duration(21_000);
        catalog
            .refresh_scan_root(
                &scan_root.path,
                &video_file_probe,
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("scan root refreshes");
        let preview_strip_generator = FakePreviewStripGenerator::default();

        let generation_summary = catalog
            .generate_missing_preview_strips(&preview_cache_path, &preview_strip_generator)
            .expect("preview strips generate");

        assert_eq!(
            generation_summary,
            super::PreviewStripGenerationSummary {
                generated_preview_strip_count: 1,
                failed_preview_strip_count: 0,
            }
        );
        let stored_preview_strips = stored_preview_strips(&catalog_path);
        assert_eq!(stored_preview_strips.len(), 1);
        assert_eq!(stored_preview_strips[0].video_id, 1);
        assert_eq!(stored_preview_strips[0].frame_count, 40);
        assert_eq!(stored_preview_strips[0].column_count, 5);
        assert_eq!(stored_preview_strips[0].row_count, 8);
        assert!(stored_preview_strips[0].path.ends_with(".jpg"));
        assert!(Path::new(&stored_preview_strips[0].path).exists());
    }

    #[test]
    fn preview_strip_frames_are_generated_for_high_density_display() {
        assert_eq!(super::PREVIEW_STRIP_FRAME_WIDTH_PIXELS, 640);
    }

    #[test]
    fn preview_strip_queue_processes_one_pending_video_per_step() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let preview_cache_path = temporary_folder.path().join("Preview Cache");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");
        let database = catalog_test_database(&catalog_path);
        for video_number in 1..=2 {
            database
                .execute(
                    "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                     VALUES (?1, ?2, ?3, ?4)",
                    (
                        format!("fingerprint-{video_number}"),
                        1_i64,
                        format!("Trip {video_number}"),
                        21_000_i64,
                    ),
                )
                .expect("video persists");
            database
                .execute(
                    "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    (
                        video_number,
                        1_i64,
                        movies_root
                            .join(format!("trip-{video_number}.mp4"))
                            .to_string_lossy()
                            .into_owned(),
                        17_i64,
                        "2026-05-14T16:35:48Z",
                    ),
                )
                .expect("file location persists");
        }
        let preview_strip_generator = FakePreviewStripGenerator::default();

        let first_generation_summary = catalog
            .generate_next_preview_strip(&preview_cache_path, &preview_strip_generator)
            .expect("first preview strip step completes");

        assert_eq!(
            first_generation_summary,
            super::PreviewStripGenerationSummary {
                generated_preview_strip_count: 1,
                failed_preview_strip_count: 0,
            }
        );
        assert_eq!(count_rows(&database, "preview_strips"), 1);
        assert_eq!(
            catalog
                .preview_strip_queue_counts()
                .expect("preview queue status loads")
                .pending_count,
            1
        );
    }

    #[test]
    fn preview_strip_generation_uses_one_file_location_for_duplicate_locations_of_the_same_video() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let preview_cache_path = temporary_folder.path().join("Preview Cache");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        let backup_root = temporary_folder.path().join("Backup");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        std::fs::create_dir_all(&backup_root).expect("backup root exists");
        catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");
        catalog
            .add_scan_root(&backup_root)
            .expect("backup scan root adds");
        let database = catalog_test_database(&catalog_path);
        database
            .execute(
                "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
                ("fingerprint-one", 1_i64, "Family Trip", 21_000_i64),
            )
            .expect("video persists");
        database
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    1_i64,
                    movies_root.join("family-trip.mp4").to_string_lossy().into_owned(),
                    17_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("movies file location persists");
        database
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    2_i64,
                    backup_root.join("family-trip.mp4").to_string_lossy().into_owned(),
                    17_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("backup file location persists");
        let preview_strip_generator = FakePreviewStripGenerator::default();

        catalog
            .generate_missing_preview_strips(&preview_cache_path, &preview_strip_generator)
            .expect("preview strips generate");
        catalog
            .generate_missing_preview_strips(&preview_cache_path, &preview_strip_generator)
            .expect("second preview strip pass is idempotent");

        assert_eq!(count_rows(&database, "preview_strips"), 1);
    }

    #[test]
    fn preview_strip_generation_recreates_cache_files_that_were_removed() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let preview_cache_path = temporary_folder.path().join("Preview Cache");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        let scan_root = catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");
        let family_trip_path = movies_root.join("family-trip.mp4");
        std::fs::write(&family_trip_path, "valid video bytes").expect("video file exists");
        let video_file_probe = FakeVideoFileProbe::with_duration(21_000);
        catalog
            .refresh_scan_root(
                &scan_root.path,
                &video_file_probe,
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("scan root refreshes");
        let preview_strip_generator = FakePreviewStripGenerator::default();
        catalog
            .generate_missing_preview_strips(&preview_cache_path, &preview_strip_generator)
            .expect("preview strips generate");
        let first_preview_strip_path = stored_preview_strips(&catalog_path)[0].path.clone();
        std::fs::remove_file(&first_preview_strip_path).expect("preview cache file is removed");

        let generation_summary = catalog
            .generate_missing_preview_strips(&preview_cache_path, &preview_strip_generator)
            .expect("preview strips regenerate");

        assert_eq!(
            generation_summary,
            super::PreviewStripGenerationSummary {
                generated_preview_strip_count: 1,
                failed_preview_strip_count: 0,
            }
        );
        assert!(Path::new(&first_preview_strip_path).exists());
    }

    #[test]
    fn preview_strip_generation_continues_after_one_video_fails() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let preview_cache_path = temporary_folder.path().join("Preview Cache");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");
        let database = catalog_test_database(&catalog_path);
        database
            .execute(
                "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
                ("fingerprint-one", 1_i64, "Broken Trip", 21_000_i64),
            )
            .expect("first video persists");
        database
            .execute(
                "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
                ("fingerprint-two", 1_i64, "Family Trip", 21_000_i64),
            )
            .expect("second video persists");
        database
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    1_i64,
                    movies_root.join("broken-trip.mp4").to_string_lossy().into_owned(),
                    17_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("first file location persists");
        database
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    2_i64,
                    1_i64,
                    movies_root.join("family-trip.mp4").to_string_lossy().into_owned(),
                    17_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("second file location persists");
        let preview_strip_generator =
            FakePreviewStripGenerator::failing_for_video(1, "ffmpeg failed");

        let generation_summary = catalog
            .generate_missing_preview_strips(&preview_cache_path, &preview_strip_generator)
            .expect("preview strip batch completes");

        assert_eq!(
            generation_summary,
            super::PreviewStripGenerationSummary {
                generated_preview_strip_count: 1,
                failed_preview_strip_count: 1,
            }
        );
        assert_eq!(count_rows(&database, "preview_strips"), 1);
        assert_eq!(count_rows(&database, "failed_preview_strips"), 1);
    }

    #[test]
    fn failed_preview_strips_are_listed_for_review_until_ignored() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let database = catalog_test_database(&catalog_path);
        database
            .execute(
                "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
                ("fingerprint-one", 1_i64, "Broken Trip", 21_000_i64),
            )
            .expect("video persists");
        database
            .execute(
                "INSERT INTO failed_preview_strips (video_id, reason)
                 VALUES (?1, ?2)",
                (1_i64, "ffmpeg failed"),
            )
            .expect("failed preview strip persists");

        assert_eq!(
            catalog
                .list_failed_preview_strips()
                .expect("failed preview strips list"),
            vec![FailedPreviewStrip {
                video_id: 1,
                title: "Broken Trip".to_string(),
                failure_reason: "ffmpeg failed".to_string(),
            }]
        );

        catalog
            .ignore_failed_preview_strip(1)
            .expect("failed preview strip ignores");

        assert_eq!(
            catalog
                .list_failed_preview_strips()
                .expect("ignored failed preview strips are hidden"),
            Vec::<FailedPreviewStrip>::new()
        );
    }

    #[test]
    fn failed_preview_strips_can_be_manually_retried_after_failure_or_ignore() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let preview_cache_path = temporary_folder.path().join("Preview Cache");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");
        let database = catalog_test_database(&catalog_path);
        database
            .execute(
                "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
                ("fingerprint-one", 1_i64, "Broken Trip", 21_000_i64),
            )
            .expect("video persists");
        database
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    1_i64,
                    movies_root.join("broken-trip.mp4").to_string_lossy().into_owned(),
                    17_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("file location persists");
        database
            .execute(
                "INSERT INTO failed_preview_strips (video_id, reason, ignored_at)
                 VALUES (?1, ?2, CURRENT_TIMESTAMP)",
                (1_i64, "ffmpeg failed"),
            )
            .expect("ignored failed preview strip persists");
        let preview_strip_generator = FakePreviewStripGenerator::default();

        catalog
            .retry_failed_preview_strip(1, PreviewStripRetryReason::Manual)
            .expect("failed preview strip retries");
        let generation_summary = catalog
            .generate_missing_preview_strips(&preview_cache_path, &preview_strip_generator)
            .expect("retry generates preview strip");

        assert_eq!(
            generation_summary,
            super::PreviewStripGenerationSummary {
                generated_preview_strip_count: 1,
                failed_preview_strip_count: 0,
            }
        );
        assert_eq!(count_rows(&database, "failed_preview_strips"), 0);
        assert_eq!(count_rows(&database, "preview_strips"), 1);
    }

    #[test]
    fn ignored_failed_preview_strips_are_retried_when_ffmpeg_configuration_changes() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let preview_cache_path = temporary_folder.path().join("Preview Cache");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");
        let database = catalog_test_database(&catalog_path);
        database
            .execute(
                "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
                ("fingerprint-one", 1_i64, "Broken Trip", 21_000_i64),
            )
            .expect("video persists");
        database
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    1_i64,
                    movies_root.join("broken-trip.mp4").to_string_lossy().into_owned(),
                    17_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("file location persists");
        database
            .execute(
                "INSERT INTO failed_preview_strips (video_id, reason, ignored_at)
                 VALUES (?1, ?2, CURRENT_TIMESTAMP)",
                (1_i64, "ffmpeg failed"),
            )
            .expect("ignored failed preview strip persists");

        catalog
            .retry_ignored_failed_preview_strips(
                PreviewStripRetryReason::FfmpegConfigurationChanged,
            )
            .expect("ignored failures retry");
        let preview_strip_generator = FakePreviewStripGenerator::default();
        let generation_summary = catalog
            .generate_missing_preview_strips(&preview_cache_path, &preview_strip_generator)
            .expect("ignored failure regenerates");

        assert_eq!(
            generation_summary,
            super::PreviewStripGenerationSummary {
                generated_preview_strip_count: 1,
                failed_preview_strip_count: 0,
            }
        );
        assert_eq!(count_rows(&database, "failed_preview_strips"), 0);
    }

    #[test]
    fn unchanged_scan_root_refresh_keeps_ignored_failed_preview_strips_ignored() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        let scan_root = catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");
        let family_trip_path = movies_root.join("family-trip.mp4");
        std::fs::write(&family_trip_path, "valid video bytes").expect("video file exists");
        let video_file_probe = FakeVideoFileProbe::with_duration(21_000);
        catalog
            .refresh_scan_root(
                &scan_root.path,
                &video_file_probe,
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("scan root refreshes");
        catalog
            .store_failed_preview_strip(1, "ffmpeg failed")
            .expect("failed preview strip stores");
        catalog
            .ignore_failed_preview_strip(1)
            .expect("failed preview strip ignores");

        catalog
            .refresh_scan_root(
                &scan_root.path,
                &video_file_probe,
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("unchanged scan root refreshes");

        assert_eq!(
            catalog
                .list_failed_preview_strips()
                .expect("failed preview strips list"),
            Vec::<FailedPreviewStrip>::new()
        );
    }

    #[test]
    fn refreshing_a_scan_root_stores_unprocessable_candidates_without_discarding_progress() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        let scan_root = catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");
        let family_trip_path = movies_root.join("family-trip.mp4");
        let broken_video_path = movies_root.join("broken-video.mkv");
        let ignored_document_path = movies_root.join("notes.txt");
        std::fs::write(&family_trip_path, "valid video bytes").expect("valid video exists");
        std::fs::write(&broken_video_path, "broken").expect("broken video exists");
        std::fs::write(&ignored_document_path, "not video").expect("document exists");
        let canonical_broken_video_path = broken_video_path
            .canonicalize()
            .expect("broken video path canonicalizes");
        let video_file_probe = FakeVideoFileProbe::failing_for(
            canonical_broken_video_path.to_string_lossy().into_owned(),
            "missing moov atom",
        );

        let refresh_summary = catalog
            .refresh_scan_root(
                &scan_root.path,
                &video_file_probe,
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("scan root refreshes");

        assert_eq!(
            refresh_summary,
            super::ScanRootRefreshSummary {
                scanned_video_count: 1,
                unprocessable_candidate_count: 1,
            }
        );
        let expected_family_trip_path = family_trip_path
            .canonicalize()
            .expect("family trip path canonicalizes");
        assert_eq!(
            catalog.listed_videos().expect("stored videos list"),
            vec![super::CatalogVideo {
                id: 1,
                is_available: true,
                preview_strip: super::PreviewStripStatus::Pending,
                title: "family-trip".to_string(),
                duration_milliseconds: 1_000,
                file_size_bytes: Some(17),
                file_location_path: Some(expected_family_trip_path.to_string_lossy().into_owned()),
                file_locations: vec![super::CatalogVideoFileLocation {
                    path: expected_family_trip_path.to_string_lossy().into_owned(),
                    file_size_bytes: 17,
                    is_preferred: true,
                }],
                is_favorite: false,
                last_opened_at: None,
                open_count: 0,
            }]
        );
        assert_eq!(
            catalog
                .list_unprocessable_video_candidates()
                .expect("unprocessable candidates list"),
            vec![super::UnprocessableVideoCandidate {
                path: canonical_broken_video_path.to_string_lossy().into_owned(),
                reason: "missing moov atom".to_string(),
                file_size_bytes: 6,
            }]
        );
    }

    #[test]
    fn refreshing_a_scan_root_removes_file_locations_that_are_no_longer_present() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        let scan_root = catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");
        let family_trip_path = movies_root.join("family-trip.mp4");
        std::fs::write(&family_trip_path, "valid video bytes").expect("valid video exists");
        let video_file_probe = FakeVideoFileProbe::with_duration(1_000);
        catalog
            .refresh_scan_root(
                &scan_root.path,
                &video_file_probe,
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("initial scan root refreshes");
        std::fs::remove_file(&family_trip_path).expect("video file is removed");

        let refresh_summary = catalog
            .refresh_scan_root(
                &scan_root.path,
                &video_file_probe,
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("second scan root refreshes");

        assert_eq!(
            refresh_summary,
            super::ScanRootRefreshSummary {
                scanned_video_count: 0,
                unprocessable_candidate_count: 0,
            }
        );
        assert_eq!(
            catalog.listed_videos().expect("stored videos list"),
            vec![super::CatalogVideo {
                id: 1,
                is_available: false,
                preview_strip: super::PreviewStripStatus::Pending,
                title: "family-trip".to_string(),
                duration_milliseconds: 1_000,
                file_size_bytes: None,
                file_location_path: None,
                file_locations: Vec::new(),
                is_favorite: false,
                last_opened_at: None,
                open_count: 0,
            }]
        );
    }

    #[test]
    fn refreshing_a_scan_root_replaces_a_previous_file_location_with_an_unprocessable_candidate() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        let scan_root = catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");
        let family_trip_path = movies_root.join("family-trip.mp4");
        std::fs::write(&family_trip_path, "valid video bytes").expect("valid video exists");
        let successful_video_file_probe = FakeVideoFileProbe::with_duration(1_000);
        catalog
            .refresh_scan_root(
                &scan_root.path,
                &successful_video_file_probe,
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("initial scan root refreshes");
        let canonical_family_trip_path = family_trip_path
            .canonicalize()
            .expect("family trip path canonicalizes");
        let failing_video_file_probe = FakeVideoFileProbe::failing_for(
            canonical_family_trip_path.to_string_lossy().into_owned(),
            "missing moov atom",
        );

        let refresh_summary = catalog
            .refresh_scan_root(
                &scan_root.path,
                &failing_video_file_probe,
                &super::VideoExtensionAllowlist::default(),
            )
            .expect("second scan root refreshes");

        assert_eq!(
            refresh_summary,
            super::ScanRootRefreshSummary {
                scanned_video_count: 0,
                unprocessable_candidate_count: 1,
            }
        );
        assert_eq!(
            catalog.listed_videos().expect("stored videos list"),
            vec![super::CatalogVideo {
                id: 1,
                is_available: false,
                preview_strip: super::PreviewStripStatus::Pending,
                title: "family-trip".to_string(),
                duration_milliseconds: 1_000,
                file_size_bytes: None,
                file_location_path: None,
                file_locations: Vec::new(),
                is_favorite: false,
                last_opened_at: None,
                open_count: 0,
            }]
        );
        assert_eq!(
            catalog
                .list_unprocessable_video_candidates()
                .expect("unprocessable candidates list"),
            vec![super::UnprocessableVideoCandidate {
                path: canonical_family_trip_path.to_string_lossy().into_owned(),
                reason: "missing moov atom".to_string(),
                file_size_bytes: 17,
            }]
        );
    }

    #[test]
    fn removing_scan_root_can_forget_affected_videos_from_catalog() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        let scan_root = catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");

        catalog_test_database(&catalog_path)
            .execute(
                "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
                ("fingerprint-one", 1_i64, "Family Trip", 3723000_i64),
            )
            .expect("video persists");
        catalog_test_database(&catalog_path)
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    1_i64,
                    movies_root.join("family-trip.mp4").to_string_lossy().into_owned(),
                    80740352_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("file location persists");

        catalog
            .remove_scan_root_forgetting_catalog_videos(&scan_root.path)
            .expect("scan root removes");

        let database = catalog_test_database(&catalog_path);
        assert_eq!(count_rows(&database, "scan_roots"), 0);
        assert_eq!(count_rows(&database, "file_locations"), 0);
        assert_eq!(count_rows(&database, "videos"), 0);
    }

    #[test]
    fn forgetting_one_missing_catalog_video_removes_metadata_without_touching_the_file() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let family_trip_path = temporary_folder.path().join("family-trip.mp4");
        std::fs::write(&family_trip_path, "valid video bytes").expect("video file exists");

        let database = catalog_test_database(&catalog_path);
        database
            .execute(
                "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
                ("fingerprint-one", 1_i64, "Family Trip", 3723000_i64),
            )
            .expect("video persists");

        catalog
            .forget_catalog_video(1)
            .expect("catalog video metadata is forgotten");

        assert!(family_trip_path.exists());
        assert_eq!(count_rows(&database, "file_locations"), 0);
        assert_eq!(count_rows(&database, "videos"), 0);
    }

    #[test]
    fn forgetting_one_available_catalog_video_is_rejected() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");
        let family_trip_path = movies_root.join("family-trip.mp4");
        std::fs::write(&family_trip_path, "valid video bytes").expect("video file exists");

        let database = catalog_test_database(&catalog_path);
        database
            .execute(
                "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
                ("fingerprint-one", 1_i64, "Family Trip", 3723000_i64),
            )
            .expect("video persists");
        database
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    1_i64,
                    family_trip_path.to_string_lossy().into_owned(),
                    17_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("file location persists");

        let forget_error = catalog
            .forget_catalog_video(1)
            .expect_err("available catalog video is rejected");

        assert_eq!(
            forget_error,
            "Only Missing Videos can be forgotten from the Catalog"
        );
        assert_eq!(count_rows(&database, "file_locations"), 1);
        assert_eq!(count_rows(&database, "videos"), 1);
    }

    #[test]
    fn forgetting_scan_root_preserves_videos_with_locations_in_other_scan_roots() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let movies_root = temporary_folder.path().join("Movies");
        let backup_root = temporary_folder.path().join("Backup");
        std::fs::create_dir_all(&movies_root).expect("movies root exists");
        std::fs::create_dir_all(&backup_root).expect("backup root exists");
        let movies_scan_root = catalog
            .add_scan_root(&movies_root)
            .expect("movies scan root adds");
        catalog
            .add_scan_root(&backup_root)
            .expect("backup scan root adds");

        let database = catalog_test_database(&catalog_path);
        database
            .execute(
                "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
                ("fingerprint-one", 1_i64, "Family Trip", 3723000_i64),
            )
            .expect("video persists");
        database
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    1_i64,
                    movies_root.join("family-trip.mp4").to_string_lossy().into_owned(),
                    80740352_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("movies file location persists");
        database
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    2_i64,
                    backup_root.join("family-trip.mp4").to_string_lossy().into_owned(),
                    80740352_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("backup file location persists");

        catalog
            .remove_scan_root_forgetting_catalog_videos(&movies_scan_root.path)
            .expect("scan root removes");

        assert_eq!(count_rows(&database, "scan_roots"), 1);
        assert_eq!(count_rows(&database, "file_locations"), 1);
        assert_eq!(count_rows(&database, "videos"), 1);
        assert_eq!(
            catalog.listed_videos().expect("stored videos list"),
            vec![super::CatalogVideo {
                id: 1,
                is_available: true,
                preview_strip: super::PreviewStripStatus::Pending,
                title: "Family Trip".to_string(),
                duration_milliseconds: 3723000,
                file_size_bytes: Some(80740352),
                file_location_path: Some(
                    backup_root
                        .join("family-trip.mp4")
                        .to_string_lossy()
                        .into_owned()
                ),
                file_locations: vec![super::CatalogVideoFileLocation {
                    path: backup_root
                        .join("family-trip.mp4")
                        .to_string_lossy()
                        .into_owned(),
                    file_size_bytes: 80740352,
                    is_preferred: true,
                }],
                is_favorite: false,
                last_opened_at: None,
                open_count: 0,
            }]
        );
    }

    #[test]
    fn opening_the_catalog_creates_the_first_vertical_slice_schema() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");

        Catalog::open(&catalog_path).expect("catalog opens");

        let database = Connection::open(catalog_path).expect("catalog database opens");
        let table_names = catalog_table_names(&database);

        assert_eq!(
            table_names,
            vec![
                "failed_preview_strips",
                "file_locations",
                "metadata_suggestion_rejections",
                "metadata_suggestions",
                "performer_videos",
                "performers",
                "preview_strips",
                "scan_roots",
                "tag_videos",
                "tags",
                "unprocessable_video_candidates",
                "videos"
            ]
        );
    }

    #[test]
    fn catalog_migrations_are_idempotent() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");

        Catalog::open(&catalog_path).expect("first open migrates");
        Catalog::open(&catalog_path).expect("second open leaves schema usable");

        let database = Connection::open(catalog_path).expect("catalog database opens");
        let table_names = catalog_table_names(&database);

        assert_eq!(
            table_names,
            vec![
                "failed_preview_strips",
                "file_locations",
                "metadata_suggestion_rejections",
                "metadata_suggestions",
                "performer_videos",
                "performers",
                "preview_strips",
                "scan_roots",
                "tag_videos",
                "tags",
                "unprocessable_video_candidates",
                "videos"
            ]
        );
    }

    #[test]
    fn catalog_migration_adds_scan_root_availability_to_existing_databases() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let database = Connection::open(&catalog_path).expect("catalog database opens");
        database
            .execute_batch(
                "
                CREATE TABLE scan_roots (
                    id INTEGER PRIMARY KEY,
                    path TEXT NOT NULL UNIQUE,
                    drive_identity TEXT,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                INSERT INTO scan_roots (path, drive_identity)
                VALUES ('/Volumes/Archive/Videos', NULL);
                ",
            )
            .expect("old scan roots schema exists");
        drop(database);

        let catalog = Catalog::open(&catalog_path).expect("catalog opens");

        let database = Connection::open(catalog_path).expect("catalog database opens");
        assert!(
            super::catalog_table_has_column(&database, "scan_roots", "is_available")
                .expect("column presence loads")
        );
        assert_eq!(
            catalog.list_scan_roots().expect("scan roots list"),
            vec![super::ScanRoot {
                inference_rules: super::ScanRootInferenceRules::default(),
                is_available: true,
                path: "/Volumes/Archive/Videos".to_string(),
            }]
        );
    }

    #[test]
    fn catalog_schema_preserves_the_first_vertical_slice_contract() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");

        Catalog::open(&catalog_path).expect("catalog opens");

        let database = Connection::open(catalog_path).expect("catalog database opens");

        assert_eq!(
            catalog_columns(&database, "scan_roots"),
            vec![
                "id INTEGER optional",
                "path TEXT required",
                "drive_identity TEXT optional",
                "is_available INTEGER required",
                "suggest_tags_from_child_folders INTEGER required",
                "suggest_performers_from_child_folders INTEGER required",
                "ignored_folder_names TEXT required",
                "ignored_exact_year_start INTEGER required",
                "ignored_exact_year_end INTEGER required",
                "created_at TEXT required",
                "updated_at TEXT required",
            ]
        );
        assert_eq!(
            catalog_columns(&database, "videos"),
            vec![
                "id INTEGER optional",
                "fingerprint TEXT required",
                "fingerprint_version INTEGER required",
                "title TEXT required",
                "duration_milliseconds INTEGER required",
                "is_favorite INTEGER required",
                "last_opened_at TEXT optional",
                "open_count INTEGER required",
                "created_at TEXT required",
                "updated_at TEXT required",
            ]
        );
        assert_eq!(
            catalog_columns(&database, "file_locations"),
            vec![
                "id INTEGER optional",
                "video_id INTEGER required",
                "scan_root_id INTEGER required",
                "path TEXT required",
                "file_size_bytes INTEGER required",
                "last_seen_at TEXT required",
                "created_at TEXT required",
                "updated_at TEXT required",
            ]
        );
        assert_eq!(
            catalog_foreign_keys(&database, "file_locations"),
            vec![
                "scan_root_id -> scan_roots.id on delete CASCADE",
                "video_id -> videos.id on delete CASCADE",
            ]
        );
        assert_eq!(
            catalog_columns(&database, "unprocessable_video_candidates"),
            vec![
                "id INTEGER optional",
                "scan_root_id INTEGER required",
                "path TEXT required",
                "reason TEXT required",
                "file_size_bytes INTEGER required",
                "last_seen_at TEXT required",
                "created_at TEXT required",
                "updated_at TEXT required",
            ]
        );
        assert_eq!(
            catalog_foreign_keys(&database, "unprocessable_video_candidates"),
            vec!["scan_root_id -> scan_roots.id on delete CASCADE"]
        );
        assert_eq!(
            catalog_columns(&database, "metadata_suggestions"),
            vec![
                "id INTEGER optional",
                "scan_root_id INTEGER required",
                "video_id INTEGER required",
                "source_path_segment TEXT required",
                "suggested_value TEXT required",
                "suggestion_kind TEXT required",
                "accepted_at TEXT optional",
                "rejected_at TEXT optional",
                "created_at TEXT required",
                "updated_at TEXT required",
            ]
        );
        assert_eq!(
            catalog_foreign_keys(&database, "metadata_suggestions"),
            vec![
                "scan_root_id -> scan_roots.id on delete CASCADE",
                "video_id -> videos.id on delete CASCADE",
            ]
        );
        assert_eq!(
            catalog_columns(&database, "metadata_suggestion_rejections"),
            vec![
                "id INTEGER optional",
                "scan_root_id INTEGER required",
                "source_path_segment TEXT required",
                "normalized_suggested_value TEXT required",
                "suggestion_kind TEXT required",
                "created_at TEXT required",
                "updated_at TEXT required",
            ]
        );
        assert_eq!(
            catalog_foreign_keys(&database, "metadata_suggestion_rejections"),
            vec!["scan_root_id -> scan_roots.id on delete CASCADE"]
        );
        assert_eq!(
            catalog_columns(&database, "preview_strips"),
            vec![
                "id INTEGER optional",
                "video_id INTEGER required",
                "path TEXT required",
                "frame_count INTEGER required",
                "column_count INTEGER required",
                "row_count INTEGER required",
                "created_at TEXT required",
                "updated_at TEXT required",
            ]
        );
        assert_eq!(
            catalog_foreign_keys(&database, "preview_strips"),
            vec!["video_id -> videos.id on delete CASCADE"]
        );
        assert_eq!(
            catalog_columns(&database, "failed_preview_strips"),
            vec![
                "id INTEGER optional",
                "video_id INTEGER required",
                "reason TEXT required",
                "ignored_at TEXT optional",
                "created_at TEXT required",
                "updated_at TEXT required",
            ]
        );
        assert_eq!(
            catalog_foreign_keys(&database, "failed_preview_strips"),
            vec!["video_id -> videos.id on delete CASCADE"]
        );
        assert_eq!(
            catalog_columns(&database, "tags"),
            vec![
                "id INTEGER optional",
                "name TEXT required",
                "normalized_name TEXT required",
                "created_at TEXT required",
                "updated_at TEXT required",
            ]
        );
        assert_eq!(
            catalog_columns(&database, "performers"),
            vec![
                "id INTEGER optional",
                "name TEXT required",
                "normalized_name TEXT required",
                "created_at TEXT required",
                "updated_at TEXT required",
            ]
        );
        assert_eq!(
            catalog_columns(&database, "tag_videos"),
            vec![
                "tag_id INTEGER required",
                "video_id INTEGER required",
                "created_at TEXT required",
            ]
        );
        assert_eq!(
            catalog_foreign_keys(&database, "tag_videos"),
            vec![
                "tag_id -> tags.id on delete CASCADE",
                "video_id -> videos.id on delete CASCADE",
            ]
        );
        assert_eq!(
            catalog_columns(&database, "performer_videos"),
            vec![
                "performer_id INTEGER required",
                "video_id INTEGER required",
                "created_at TEXT required",
            ]
        );
        assert_eq!(
            catalog_foreign_keys(&database, "performer_videos"),
            vec![
                "performer_id -> performers.id on delete CASCADE",
                "video_id -> videos.id on delete CASCADE",
            ]
        );
        assert_eq!(
            catalog_index_names(&database),
            vec![
                "idx_performer_videos_video_id",
                "idx_tag_videos_video_id",
                "sqlite_autoindex_performer_videos_1",
                "sqlite_autoindex_performers_1",
                "sqlite_autoindex_tag_videos_1",
                "sqlite_autoindex_tags_1",
            ]
        );
    }

    #[test]
    fn catalog_persists_scan_roots_videos_titles_durations_and_file_sizes() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");

        let catalog = Catalog::open(&catalog_path).expect("catalog opens");

        let database = Connection::open(catalog_path).expect("catalog database opens");
        database
            .execute(
                "INSERT INTO scan_roots (path, drive_identity) VALUES (?1, ?2)",
                ("/Volumes/Archive/Videos", "drive-archive"),
            )
            .expect("scan root persists");
        database
            .execute(
                "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
                ("fingerprint-one", 1_i64, "Family Trip", 3723000_i64),
            )
            .expect("video persists");
        database
            .execute(
                "INSERT INTO file_locations (video_id, scan_root_id, path, file_size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    1_i64,
                    1_i64,
                    "/Volumes/Archive/Videos/family-trip.mp4",
                    80740352_i64,
                    "2026-05-14T16:35:48Z",
                ),
            )
            .expect("file location persists");

        let stored_videos = catalog.listed_videos().expect("stored videos list");

        assert_eq!(
            stored_videos,
            vec![super::CatalogVideo {
                id: 1,
                is_available: true,
                preview_strip: super::PreviewStripStatus::Pending,
                title: "Family Trip".to_string(),
                duration_milliseconds: 3723000,
                file_size_bytes: Some(80740352),
                file_location_path: Some("/Volumes/Archive/Videos/family-trip.mp4".to_string()),
                file_locations: vec![super::CatalogVideoFileLocation {
                    path: "/Volumes/Archive/Videos/family-trip.mp4".to_string(),
                    file_size_bytes: 80740352,
                    is_preferred: true,
                }],
                is_favorite: false,
                last_opened_at: None,
                open_count: 0,
            }]
        );
    }

    #[test]
    fn tags_and_performers_are_unique_within_their_own_type_case_insensitively() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");

        let travel_tag = catalog.create_tag("Travel").expect("travel tag creates");
        let travel_performer = catalog
            .create_performer("Travel")
            .expect("travel performer creates");

        assert_eq!(
            catalog
                .create_tag(" travel ")
                .expect_err("duplicate tag is rejected"),
            "Tag already exists"
        );
        assert_eq!(
            catalog
                .create_performer("TRAVEL")
                .expect_err("duplicate performer is rejected"),
            "Performer already exists"
        );
        assert_eq!(travel_tag.name, "Travel");
        assert_eq!(travel_performer.name, "Travel");
        assert_eq!(catalog.list_tags().expect("tags list"), vec![travel_tag]);
        assert_eq!(
            catalog.list_performers().expect("performers list"),
            vec![travel_performer]
        );
    }

    #[test]
    fn tags_and_performers_match_non_ascii_names_case_insensitively() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");

        catalog.create_tag("Élodie").expect("tag creates");
        catalog
            .create_performer("Élodie")
            .expect("performer creates");

        assert_eq!(
            catalog
                .create_tag("élodie")
                .expect_err("accented duplicate tag is rejected"),
            "Tag already exists"
        );
        assert_eq!(
            catalog
                .create_performer("élodie")
                .expect_err("accented duplicate performer is rejected"),
            "Performer already exists"
        );
    }

    #[test]
    fn tags_and_performers_can_be_attached_to_many_videos() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let database = catalog_test_database(&catalog_path);
        store_test_video(&database, "fingerprint-one", "Family Trip");
        store_test_video(&database, "fingerprint-two", "Concert Night");
        let travel_tag = catalog.create_tag("Travel").expect("tag creates");
        let featured_performer = catalog
            .create_performer("Featured Person")
            .expect("performer creates");

        catalog
            .attach_tag_to_video(travel_tag.id, 1)
            .expect("tag attaches to first video");
        catalog
            .attach_tag_to_video(travel_tag.id, 2)
            .expect("tag attaches to second video");
        catalog
            .attach_performer_to_video(featured_performer.id, 1)
            .expect("performer attaches to first video");
        catalog
            .attach_performer_to_video(featured_performer.id, 2)
            .expect("performer attaches to second video");

        assert_eq!(
            catalog.tags_for_video(1).expect("video tags list"),
            vec![travel_tag]
        );
        assert_eq!(
            catalog
                .performers_for_video(2)
                .expect("video performers list"),
            vec![featured_performer]
        );
        assert_eq!(count_rows(&database, "tag_videos"), 2);
        assert_eq!(count_rows(&database, "performer_videos"), 2);
    }

    #[test]
    fn metadata_primitives_support_update_delete_and_detach() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let database = catalog_test_database(&catalog_path);
        store_test_video(&database, "fingerprint-one", "Family Trip");
        let tag = catalog.create_tag("Travel").expect("tag creates");
        let performer = catalog.create_performer("Alex").expect("performer creates");
        catalog
            .attach_tag_to_video(tag.id, 1)
            .expect("tag attaches to video");
        catalog
            .attach_performer_to_video(performer.id, 1)
            .expect("performer attaches to video");

        let updated_tag = catalog.update_tag(tag.id, "Archive").expect("tag updates");
        let updated_performer = catalog
            .update_performer(performer.id, "Blair")
            .expect("performer updates");
        catalog
            .detach_tag_from_video(updated_tag.id, 1)
            .expect("tag detaches from video");
        catalog
            .detach_performer_from_video(updated_performer.id, 1)
            .expect("performer detaches from video");
        catalog.delete_tag(updated_tag.id).expect("tag deletes");
        catalog
            .delete_performer(updated_performer.id)
            .expect("performer deletes");

        assert_eq!(catalog.list_tags().expect("tags list"), Vec::new());
        assert_eq!(
            catalog.list_performers().expect("performers list"),
            Vec::new()
        );
        assert_eq!(count_rows(&database, "tag_videos"), 0);
        assert_eq!(count_rows(&database, "performer_videos"), 0);
    }

    #[test]
    fn attached_tags_and_performers_must_be_detached_before_deletion() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let database = catalog_test_database(&catalog_path);
        store_test_video(&database, "fingerprint-one", "Family Trip");
        let tag = catalog.create_tag("Travel").expect("tag creates");
        let performer = catalog.create_performer("Alex").expect("performer creates");
        catalog
            .attach_tag_to_video(tag.id, 1)
            .expect("tag attaches to video");
        catalog
            .attach_performer_to_video(performer.id, 1)
            .expect("performer attaches to video");

        assert_eq!(
            catalog
                .delete_tag(tag.id)
                .expect_err("attached tag deletion is rejected"),
            "Attached Tags must be detached before deletion"
        );
        assert_eq!(
            catalog
                .delete_performer(performer.id)
                .expect_err("attached performer deletion is rejected"),
            "Attached Performers must be detached before deletion"
        );

        assert_eq!(catalog.list_tags().expect("tags list"), vec![tag]);
        assert_eq!(
            catalog.list_performers().expect("performers list"),
            vec![performer]
        );
    }

    #[test]
    fn detaching_the_last_video_use_removes_unused_tags_and_performers() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let database = catalog_test_database(&catalog_path);
        store_test_video(&database, "fingerprint-one", "Family Trip");
        let tag = catalog.create_tag("Travel").expect("tag creates");
        let performer = catalog.create_performer("Alex").expect("performer creates");
        catalog
            .attach_tag_to_video(tag.id, 1)
            .expect("tag attaches to video");
        catalog
            .attach_performer_to_video(performer.id, 1)
            .expect("performer attaches to video");

        catalog
            .detach_tag_from_video(tag.id, 1)
            .expect("tag detaches from video");
        catalog
            .detach_performer_from_video(performer.id, 1)
            .expect("performer detaches from video");

        assert_eq!(catalog.list_tags().expect("tags list"), Vec::new());
        assert_eq!(
            catalog.list_performers().expect("performers list"),
            Vec::new()
        );
    }

    #[test]
    fn detaching_one_video_use_keeps_metadata_attached_to_other_videos() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");
        let catalog = Catalog::open(&catalog_path).expect("catalog opens");
        let database = catalog_test_database(&catalog_path);
        store_test_video(&database, "fingerprint-one", "Family Trip");
        store_test_video(&database, "fingerprint-two", "Concert Night");
        let tag = catalog.create_tag("Travel").expect("tag creates");
        let performer = catalog.create_performer("Alex").expect("performer creates");
        catalog
            .attach_tag_to_video(tag.id, 1)
            .expect("tag attaches to first video");
        catalog
            .attach_tag_to_video(tag.id, 2)
            .expect("tag attaches to second video");
        catalog
            .attach_performer_to_video(performer.id, 1)
            .expect("performer attaches to first video");
        catalog
            .attach_performer_to_video(performer.id, 2)
            .expect("performer attaches to second video");

        catalog
            .detach_tag_from_video(tag.id, 1)
            .expect("tag detaches from first video");
        catalog
            .detach_performer_from_video(performer.id, 1)
            .expect("performer detaches from first video");

        assert_eq!(catalog.list_tags().expect("tags list"), vec![tag]);
        assert_eq!(
            catalog.list_performers().expect("performers list"),
            vec![performer]
        );
    }

    fn catalog_table_names(database: &Connection) -> Vec<String> {
        let mut statement = database
            .prepare(
                "SELECT name
                 FROM sqlite_schema
                 WHERE type = 'table'
                   AND name NOT LIKE 'sqlite_%'
                 ORDER BY name",
            )
            .expect("table names query prepares");

        statement
            .query_map([], |row| row.get::<_, String>(0))
            .expect("table names query runs")
            .collect::<Result<Vec<_>, _>>()
            .expect("table names load")
    }

    fn catalog_index_names(database: &Connection) -> Vec<String> {
        let mut statement = database
            .prepare(
                "SELECT name
                 FROM sqlite_schema
                 WHERE type = 'index'
                   AND tbl_name IN ('tags', 'performers', 'tag_videos', 'performer_videos')
                 ORDER BY name",
            )
            .expect("index names query prepares");

        statement
            .query_map([], |row| row.get::<_, String>(0))
            .expect("index names query runs")
            .collect::<Result<Vec<_>, _>>()
            .expect("index names load")
    }

    fn catalog_test_database(catalog_path: &std::path::Path) -> Connection {
        Connection::open(catalog_path).expect("catalog database opens")
    }

    fn count_rows(database: &Connection, table_name: &str) -> i64 {
        database
            .query_row(&format!("SELECT COUNT(*) FROM {table_name}"), [], |row| {
                row.get(0)
            })
            .expect("row count loads")
    }

    fn store_test_video(database: &Connection, fingerprint: &str, title: &str) {
        database
            .execute(
                "INSERT INTO videos (fingerprint, fingerprint_version, title, duration_milliseconds)
                 VALUES (?1, ?2, ?3, ?4)",
                (fingerprint, 1_i64, title, 1_000_i64),
            )
            .expect("video persists");
    }

    fn video_id_for_title(database: &Connection, title: &str) -> i64 {
        database
            .query_row("SELECT id FROM videos WHERE title = ?1", [title], |row| {
                row.get(0)
            })
            .expect("video id loads")
    }

    fn metadata_suggestions(database: &Connection) -> Vec<(String, String)> {
        let mut statement = database
            .prepare(
                "SELECT suggested_value, suggestion_kind
                 FROM metadata_suggestions
                 ORDER BY suggested_value",
            )
            .expect("metadata suggestions query prepares");

        statement
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .expect("metadata suggestions query runs")
            .collect::<Result<Vec<_>, _>>()
            .expect("metadata suggestions load")
    }

    fn metadata_suggestion_sources(database: &Connection) -> Vec<(String, String, String)> {
        let mut statement = database
            .prepare(
                "SELECT source_path_segment, suggested_value, suggestion_kind
                 FROM metadata_suggestions
                 ORDER BY source_path_segment",
            )
            .expect("metadata suggestion sources query prepares");

        statement
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .expect("metadata suggestion sources query runs")
            .collect::<Result<Vec<_>, _>>()
            .expect("metadata suggestion sources load")
    }

    #[derive(Debug)]
    struct StoredPreviewStrip {
        video_id: i64,
        path: String,
        frame_count: i64,
        column_count: i64,
        row_count: i64,
    }

    fn stored_preview_strips(catalog_path: &std::path::Path) -> Vec<StoredPreviewStrip> {
        let database = catalog_test_database(catalog_path);
        let mut statement = database
            .prepare(
                "SELECT video_id, path, frame_count, column_count, row_count
                 FROM preview_strips
                 ORDER BY video_id",
            )
            .expect("preview strips query prepares");

        statement
            .query_map([], |row| {
                Ok(StoredPreviewStrip {
                    video_id: row.get(0)?,
                    path: row.get(1)?,
                    frame_count: row.get(2)?,
                    column_count: row.get(3)?,
                    row_count: row.get(4)?,
                })
            })
            .expect("preview strips query runs")
            .collect::<Result<Vec<_>, _>>()
            .expect("preview strips load")
    }

    fn catalog_columns(database: &Connection, table_name: &str) -> Vec<String> {
        let mut statement = database
            .prepare(&format!("PRAGMA table_info({table_name})"))
            .expect("table info query prepares");

        statement
            .query_map([], |row| {
                let column_name: String = row.get(1)?;
                let declared_type: String = row.get(2)?;
                let is_required: i64 = row.get(3)?;
                let requirement = if is_required == 1 {
                    "required"
                } else {
                    "optional"
                };

                Ok(format!("{column_name} {declared_type} {requirement}"))
            })
            .expect("table info query runs")
            .collect::<Result<Vec<_>, _>>()
            .expect("table info loads")
    }

    fn catalog_foreign_keys(database: &Connection, table_name: &str) -> Vec<String> {
        let mut statement = database
            .prepare(&format!("PRAGMA foreign_key_list({table_name})"))
            .expect("foreign key query prepares");

        let mut foreign_keys = statement
            .query_map([], |row| {
                let referenced_table: String = row.get(2)?;
                let column_name: String = row.get(3)?;
                let referenced_column: String = row.get(4)?;
                let on_delete: String = row.get(6)?;

                Ok(format!(
                    "{column_name} -> {referenced_table}.{referenced_column} on delete {on_delete}"
                ))
            })
            .expect("foreign key query runs")
            .collect::<Result<Vec<_>, _>>()
            .expect("foreign keys load");

        foreign_keys.sort();
        foreign_keys
    }

    struct FakeVideoFileProbe {
        failed_path: Option<String>,
        failure_reason: String,
        duration_milliseconds: i64,
    }

    impl FakeVideoFileProbe {
        fn with_duration(duration_milliseconds: i64) -> Self {
            Self {
                failed_path: None,
                failure_reason: String::new(),
                duration_milliseconds,
            }
        }

        fn failing_for(failed_path: String, failure_reason: &str) -> Self {
            Self {
                failed_path: Some(failed_path),
                failure_reason: failure_reason.to_string(),
                duration_milliseconds: 1_000,
            }
        }
    }

    impl VideoFileProbe for FakeVideoFileProbe {
        fn probe_video_file(&self, video_path: &Path) -> Result<VideoProbe, String> {
            if self.failed_path.as_deref() == Some(video_path.to_string_lossy().as_ref()) {
                Err(self.failure_reason.clone())
            } else {
                Ok(VideoProbe {
                    duration_milliseconds: self.duration_milliseconds,
                })
            }
        }
    }

    struct FakePreviewStripGenerator {
        failed_video_id: Option<i64>,
        failure_reason: String,
    }

    impl FakePreviewStripGenerator {
        fn failing_for_video(failed_video_id: i64, failure_reason: &str) -> Self {
            Self {
                failed_video_id: Some(failed_video_id),
                failure_reason: failure_reason.to_string(),
            }
        }
    }

    impl Default for FakePreviewStripGenerator {
        fn default() -> Self {
            Self {
                failed_video_id: None,
                failure_reason: String::new(),
            }
        }
    }

    impl super::PreviewStripGenerator for FakePreviewStripGenerator {
        fn generate_preview_strip(
            &self,
            request: &super::PreviewStripRequest,
        ) -> Result<super::GeneratedPreviewStrip, String> {
            assert_eq!(request.frame_count, 40);
            assert_eq!(request.duration_milliseconds, 21_000);
            if self.failed_video_id == Some(request.video_id) {
                return Err(self.failure_reason.clone());
            }
            if let Some(output_directory) = request.output_path.parent() {
                std::fs::create_dir_all(output_directory).expect("preview output directory exists");
            }
            std::fs::write(&request.output_path, "preview strip bytes")
                .expect("preview strip file is written");

            Ok(super::GeneratedPreviewStrip {
                path: request.output_path.clone(),
                frame_count: request.frame_count,
                column_count: 5,
                row_count: 8,
            })
        }
    }
}
