use super::*;

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
            "metadata_suggestion_mappings",
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
            "metadata_suggestion_mappings",
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
    assert!(crate::catalog::migrations::catalog_table_has_column(
        &database,
        "scan_roots",
        "is_available"
    )
    .expect("column presence loads"));
    assert_eq!(
        catalog.list_scan_roots().expect("scan roots list"),
        vec![crate::catalog::ScanRoot {
            inference_rules: crate::catalog::ScanRootInferenceRules::default(),
            is_available: true,
            path: "/Volumes/Archive/Videos".to_string(),
        }]
    );
}

#[test]
fn catalog_migration_renames_folder_name_rule_once() {
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
                    is_available INTEGER NOT NULL DEFAULT 1,
                    suggest_tags_from_child_folders INTEGER NOT NULL DEFAULT 0,
                    ignored_folder_names TEXT NOT NULL DEFAULT '[\"Misc\"]',
                    ignored_exact_year_start INTEGER NOT NULL DEFAULT 1900,
                    ignored_exact_year_end INTEGER NOT NULL DEFAULT 2099,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                INSERT INTO scan_roots (path, drive_identity)
                VALUES ('/Volumes/Archive/Videos', NULL);
                ",
        )
        .expect("old scan roots schema exists");
    drop(database);

    let catalog = Catalog::open(&catalog_path).expect("first open migrates");
    assert!(
        !catalog
            .list_scan_roots()
            .expect("scan roots list")
            .first()
            .expect("scan root exists")
            .inference_rules
            .suggest_tags_from_folder_names
    );
    catalog
        .update_scan_root_inference_rules(
            "/Volumes/Archive/Videos",
            crate::catalog::ScanRootInferenceRules {
                suggest_tags_from_folder_names: true,
                suggest_tags_from_filename_brackets: true,
                ignored_folder_names: vec!["Misc".to_string()],
                ignored_exact_year_range: crate::catalog::ExactYearRange {
                    start_year: 1900,
                    end_year: 2099,
                },
            },
        )
        .expect("folder rule updates");
    drop(catalog);

    let reopened_catalog = Catalog::open(&catalog_path).expect("second open keeps new rule");

    assert!(
        reopened_catalog
            .list_scan_roots()
            .expect("scan roots list")
            .first()
            .expect("scan root exists")
            .inference_rules
            .suggest_tags_from_folder_names
    );
}

#[test]
fn catalog_migration_rebuilds_metadata_suggestion_uniqueness_for_split_values() {
    let temporary_folder = tempfile::tempdir().expect("temporary folder exists");
    let catalog_path = temporary_folder.path().join("catalog.sqlite3");
    let database = Connection::open(&catalog_path).expect("catalog database opens");
    database
        .execute_batch(
            "
                PRAGMA foreign_keys = ON;

                CREATE TABLE scan_roots (
                    id INTEGER PRIMARY KEY,
                    path TEXT NOT NULL UNIQUE,
                    drive_identity TEXT,
                    is_available INTEGER NOT NULL DEFAULT 1,
                    suggest_tags_from_folder_names INTEGER NOT NULL DEFAULT 1,
                    suggest_tags_from_filename_brackets INTEGER NOT NULL DEFAULT 1,
                    ignored_folder_names TEXT NOT NULL DEFAULT '[\"Misc\"]',
                    ignored_exact_year_start INTEGER NOT NULL DEFAULT 1900,
                    ignored_exact_year_end INTEGER NOT NULL DEFAULT 2099,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE videos (
                    id INTEGER PRIMARY KEY,
                    fingerprint TEXT NOT NULL UNIQUE,
                    fingerprint_version INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    duration_milliseconds INTEGER NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE metadata_suggestions (
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

                INSERT INTO scan_roots (id, path, drive_identity)
                VALUES (1, '/Volumes/Archive/Videos', NULL);

                INSERT INTO videos (
                    id,
                    fingerprint,
                    fingerprint_version,
                    title,
                    duration_milliseconds
                )
                VALUES (1, 'family-trip-fingerprint', 1, 'Family Trip', 1000);

                INSERT INTO metadata_suggestions (
                    scan_root_id,
                    video_id,
                    source_path_segment,
                    suggested_value,
                    suggestion_kind
                )
                VALUES (1, 1, 'Family - Vacation', 'Family', 'tag');
                ",
        )
        .expect("old metadata suggestions schema exists");
    drop(database);

    Catalog::open(&catalog_path).expect("catalog migrates");
    let database = Connection::open(catalog_path).expect("catalog database opens");
    database
        .execute(
            "INSERT INTO metadata_suggestions (
                scan_root_id,
                video_id,
                source_path_segment,
                suggested_value,
                normalized_suggested_value,
                suggestion_kind
             )
             VALUES (1, 1, 'Family - Vacation', 'Vacation', 'vacation', 'tag')",
            [],
        )
        .expect("split value from same source can coexist after migration");

    assert_eq!(count_rows(&database, "metadata_suggestions"), 2);
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
            "suggest_tags_from_folder_names INTEGER required",
            "suggest_tags_from_filename_brackets INTEGER required",
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
            "normalized_suggested_value TEXT required",
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
        catalog_columns(&database, "metadata_suggestion_mappings"),
        vec![
            "id INTEGER optional",
            "scan_root_id INTEGER required",
            "source_path_segment TEXT required",
            "normalized_suggested_value TEXT required",
            "suggestion_kind TEXT required",
            "accepted_tag_id INTEGER optional",
            "accepted_performer_id INTEGER optional",
            "created_at TEXT required",
            "updated_at TEXT required",
        ]
    );
    assert_eq!(
        catalog_foreign_keys(&database, "metadata_suggestion_mappings"),
        vec![
            "accepted_performer_id -> performers.id on delete CASCADE",
            "accepted_tag_id -> tags.id on delete CASCADE",
            "scan_root_id -> scan_roots.id on delete CASCADE",
        ]
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
            "sqlite_autoindex_metadata_suggestions_1",
            "sqlite_autoindex_performer_videos_1",
            "sqlite_autoindex_performers_1",
            "sqlite_autoindex_tag_videos_1",
            "sqlite_autoindex_tags_1",
        ]
    );
}
