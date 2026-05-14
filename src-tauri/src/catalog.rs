use std::path::{Path, PathBuf};

use rusqlite::{params, Connection};
use serde::Serialize;

const CREATE_SCAN_ROOTS_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS scan_roots (
        id INTEGER PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        drive_identity TEXT,
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

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogVideo {
    pub title: String,
    pub duration_milliseconds: i64,
    pub file_size_bytes: i64,
    pub file_location_path: String,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRoot {
    pub path: String,
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
                "SELECT videos.title,
                        videos.duration_milliseconds,
                        file_locations.file_size_bytes,
                        file_locations.path
                 FROM videos
                 JOIN file_locations ON file_locations.video_id = videos.id
                 ORDER BY videos.title, file_locations.path",
            )
            .map_err(|error| error.to_string())?;

        let videos = statement
            .query_map([], |row| {
                Ok(CatalogVideo {
                    title: row.get(0)?,
                    duration_milliseconds: row.get(1)?,
                    file_size_bytes: row.get(2)?,
                    file_location_path: row.get(3)?,
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
                "SELECT path
                 FROM scan_roots
                 ORDER BY path",
            )
            .map_err(|error| error.to_string())?;

        let scan_roots = statement
            .query_map([], |row| Ok(ScanRoot { path: row.get(0)? }))
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
                "DELETE FROM videos
                 WHERE id IN (
                    SELECT videos.id
                    FROM videos
                    JOIN file_locations ON file_locations.video_id = videos.id
                    JOIN scan_roots ON scan_roots.id = file_locations.scan_root_id
                    WHERE scan_roots.path = ?1
                 )",
                params![scan_root_path],
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
        ]
        .join("\n");

        self.database
            .execute_batch(&migration_batch)
            .map_err(|error| error.to_string())
    }
}

fn canonical_scan_root_path(scan_root_path: &Path) -> std::io::Result<PathBuf> {
    scan_root_path.canonicalize()
}

#[cfg(test)]
mod tests {
    use super::Catalog;
    use rusqlite::Connection;

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
                    path: documentaries_root
                        .canonicalize()
                        .expect("documentaries path canonicalizes")
                        .to_string_lossy()
                        .into_owned(),
                },
                super::ScanRoot {
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
    fn opening_the_catalog_creates_the_first_vertical_slice_schema() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");

        Catalog::open(&catalog_path).expect("catalog opens");

        let database = Connection::open(catalog_path).expect("catalog database opens");
        let table_names = catalog_table_names(&database);

        assert_eq!(table_names, vec!["file_locations", "scan_roots", "videos"]);
    }

    #[test]
    fn catalog_migrations_are_idempotent() {
        let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
        let catalog_path = temporary_folder.path().join("catalog.sqlite3");

        Catalog::open(&catalog_path).expect("first open migrates");
        Catalog::open(&catalog_path).expect("second open leaves schema usable");

        let database = Connection::open(catalog_path).expect("catalog database opens");
        let table_names = catalog_table_names(&database);

        assert_eq!(table_names, vec!["file_locations", "scan_roots", "videos"]);
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
                title: "Family Trip".to_string(),
                duration_milliseconds: 3723000,
                file_size_bytes: 80740352,
                file_location_path: "/Volumes/Archive/Videos/family-trip.mp4".to_string(),
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
}
