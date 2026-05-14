use std::path::Path;

use rusqlite::Connection;
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

#[cfg(test)]
mod tests {
    use super::Catalog;
    use rusqlite::Connection;

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
