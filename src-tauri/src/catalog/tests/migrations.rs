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
            "sqlite_autoindex_performer_videos_1",
            "sqlite_autoindex_performers_1",
            "sqlite_autoindex_tag_videos_1",
            "sqlite_autoindex_tags_1",
        ]
    );
}
