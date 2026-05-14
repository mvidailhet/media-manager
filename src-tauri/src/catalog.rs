use std::{
    collections::HashSet,
    fs,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    process::Command,
};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

const FINGERPRINT_VERSION: i64 = 1;
const DEFAULT_VIDEO_EXTENSIONS: [&str; 7] = ["flv", "mp4", "mov", "mkv", "avi", "webm", "m4v"];
const FINGERPRINT_SAMPLE_SIZE_BYTES: usize = 64 * 1024;
const FNV_OFFSET_BASIS: u64 = 14_695_981_039_346_656_037;
const FNV_PRIME: u64 = 1_099_511_628_211;

const CREATE_SCAN_ROOTS_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS scan_roots (
        id INTEGER PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        drive_identity TEXT,
        is_available INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
";

const CREATE_VIDEOS_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY,
        fingerprint TEXT NOT NULL UNIQUE,
        fingerprint_version INTEGER NOT NULL,
        title TEXT NOT NULL,
        duration_milliseconds INTEGER NOT NULL,
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

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogVideo {
    pub id: i64,
    pub title: String,
    pub duration_milliseconds: i64,
    pub file_size_bytes: Option<i64>,
    pub file_location_path: Option<String>,
    pub is_available: bool,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRoot {
    pub path: String,
    pub is_available: bool,
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
                        file_locations.file_size_bytes,
                        file_locations.path,
                        file_locations.path IS NOT NULL
                 FROM videos
                 LEFT JOIN file_locations ON file_locations.video_id = videos.id
                 ORDER BY videos.title, file_locations.path",
            )
            .map_err(|error| error.to_string())?;

        let videos = statement
            .query_map([], |row| {
                Ok(CatalogVideo {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    duration_milliseconds: row.get(2)?,
                    file_size_bytes: row.get(3)?,
                    file_location_path: row.get(4)?,
                    is_available: row.get::<_, i64>(5)? == 1,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(videos)
    }

    pub fn add_scan_root(&self, scan_root_path: &Path) -> Result<ScanRoot, String> {
        let canonical_scan_root_path =
            canonical_scan_root_path(scan_root_path).map_err(|error| error.to_string())?;
        let scan_root = ScanRoot {
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
                "SELECT path, is_available
                 FROM scan_roots
                 ORDER BY path",
            )
            .map_err(|error| error.to_string())?;

        let scan_roots = statement
            .query_map([], |row| {
                Ok(ScanRoot {
                    path: row.get(0)?,
                    is_available: row.get::<_, i64>(1)? == 1,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(scan_roots)
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
        ]
        .join("\n");

        self.database
            .execute_batch(&migration_batch)
            .map_err(|error| error.to_string())?;
        self.add_scan_root_availability_column_if_missing()
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
                    title = excluded.title,
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

#[cfg(test)]
mod tests {
    use super::{Catalog, VideoFileProbe, VideoProbe};
    use rusqlite::Connection;
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
                    is_available: true,
                    path: documentaries_root
                        .canonicalize()
                        .expect("documentaries path canonicalizes")
                        .to_string_lossy()
                        .into_owned(),
                },
                super::ScanRoot {
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
                is_available: false,
                path: scan_root.path,
            }]
        );
        assert_eq!(
            catalog.listed_videos().expect("stored videos list"),
            vec![super::CatalogVideo {
                id: 1,
                is_available: false,
                title: "family-trip".to_string(),
                duration_milliseconds: 1_000,
                file_size_bytes: None,
                file_location_path: None,
            }]
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
                title: "family-trip".to_string(),
                duration_milliseconds: 1_000,
                file_size_bytes: None,
                file_location_path: None,
            }]
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
                    is_available: true,
                    path: available_scan_root.path,
                },
                super::ScanRoot {
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
                    title: "archived-trip".to_string(),
                    duration_milliseconds: 1_000,
                    file_size_bytes: None,
                    file_location_path: None,
                },
                super::CatalogVideo {
                    id: 1,
                    is_available: true,
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
                title: "Family Trip".to_string(),
                duration_milliseconds: 3723000,
                file_size_bytes: None,
                file_location_path: None,
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
                title: "Family Trip".to_string(),
                duration_milliseconds: 3_723_000,
                file_size_bytes: Some(11),
                file_location_path: Some(expected_family_trip_path.to_string_lossy().into_owned()),
            }]
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
                title: "family-trip".to_string(),
                duration_milliseconds: 1_000,
                file_size_bytes: Some(17),
                file_location_path: Some(expected_family_trip_path.to_string_lossy().into_owned()),
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
                title: "family-trip".to_string(),
                duration_milliseconds: 1_000,
                file_size_bytes: None,
                file_location_path: None,
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
                title: "family-trip".to_string(),
                duration_milliseconds: 1_000,
                file_size_bytes: None,
                file_location_path: None,
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
                title: "Family Trip".to_string(),
                duration_milliseconds: 3723000,
                file_size_bytes: Some(80740352),
                file_location_path: Some(
                    backup_root
                        .join("family-trip.mp4")
                        .to_string_lossy()
                        .into_owned()
                ),
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
                "file_locations",
                "scan_roots",
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
                "file_locations",
                "scan_roots",
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
                title: "Family Trip".to_string(),
                duration_milliseconds: 3723000,
                file_size_bytes: Some(80740352),
                file_location_path: Some("/Volumes/Archive/Videos/family-trip.mp4".to_string()),
            }]
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
}
