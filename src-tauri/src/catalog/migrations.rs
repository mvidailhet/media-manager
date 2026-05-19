use rusqlite::Connection;

use super::{DEFAULT_IGNORED_EXACT_YEAR_END, DEFAULT_IGNORED_EXACT_YEAR_START};

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
        suggest_tags_from_folder_names INTEGER NOT NULL DEFAULT 1,
        suggest_tags_from_filename_brackets INTEGER NOT NULL DEFAULT 1,
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
        normalized_suggested_value TEXT NOT NULL,
        suggestion_kind TEXT NOT NULL,
        accepted_at TEXT,
        rejected_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (
            scan_root_id,
            video_id,
            source_path_segment,
            normalized_suggested_value,
            suggestion_kind
        ),
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

const CREATE_METADATA_SUGGESTION_MAPPINGS_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS metadata_suggestion_mappings (
        id INTEGER PRIMARY KEY,
        scan_root_id INTEGER NOT NULL,
        source_path_segment TEXT NOT NULL,
        normalized_suggested_value TEXT NOT NULL,
        suggestion_kind TEXT NOT NULL,
        accepted_tag_id INTEGER,
        accepted_performer_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (
            (accepted_tag_id IS NOT NULL AND accepted_performer_id IS NULL)
            OR (accepted_tag_id IS NULL AND accepted_performer_id IS NOT NULL)
        ),
        UNIQUE (
            scan_root_id,
            source_path_segment,
            normalized_suggested_value,
            suggestion_kind
        ),
        FOREIGN KEY (scan_root_id) REFERENCES scan_roots (id) ON DELETE CASCADE,
        FOREIGN KEY (accepted_tag_id) REFERENCES tags (id) ON DELETE CASCADE,
        FOREIGN KEY (accepted_performer_id) REFERENCES performers (id) ON DELETE CASCADE
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

pub(super) fn run_migrations(database: &Connection) -> Result<(), String> {
    let migration_batch = [
        CREATE_SCAN_ROOTS_TABLE,
        CREATE_VIDEOS_TABLE,
        CREATE_FILE_LOCATIONS_TABLE,
        CREATE_UNPROCESSABLE_VIDEO_CANDIDATES_TABLE,
        CREATE_METADATA_SUGGESTIONS_TABLE,
        CREATE_METADATA_SUGGESTION_REJECTIONS_TABLE,
        CREATE_METADATA_SUGGESTION_MAPPINGS_TABLE,
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

    database
        .execute_batch(&migration_batch)
        .map_err(|error| error.to_string())?;
    add_scan_root_availability_column_if_missing(database)?;
    add_scan_root_inference_rule_columns_if_missing(database)?;
    add_metadata_suggestion_normalized_value_column_if_missing(database)?;
    add_failed_preview_strip_ignored_at_column_if_missing(database)?;
    add_video_favorite_column_if_missing(database)?;
    add_video_open_history_columns_if_missing(database)
}

fn add_scan_root_availability_column_if_missing(database: &Connection) -> Result<(), String> {
    if catalog_table_has_column(database, "scan_roots", "is_available")? {
        return Ok(());
    }

    database
        .execute(
            "ALTER TABLE scan_roots
             ADD COLUMN is_available INTEGER NOT NULL DEFAULT 1",
            [],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn add_scan_root_inference_rule_columns_if_missing(database: &Connection) -> Result<(), String> {
    let scan_root_inference_rule_columns = [
        (
            "suggest_tags_from_folder_names",
            "INTEGER NOT NULL DEFAULT 1".to_string(),
        ),
        (
            "suggest_tags_from_filename_brackets",
            "INTEGER NOT NULL DEFAULT 1".to_string(),
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
        if catalog_table_has_column(database, "scan_roots", column_name)? {
            continue;
        }

        database
            .execute(
                &format!("ALTER TABLE scan_roots ADD COLUMN {column_name} {column_definition}"),
                [],
            )
            .map_err(|error| error.to_string())?;
    }

    if catalog_table_has_column(database, "scan_roots", "suggest_tags_from_child_folders")? {
        database
            .execute(
                "UPDATE scan_roots
                 SET suggest_tags_from_folder_names = suggest_tags_from_child_folders",
                [],
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn add_metadata_suggestion_normalized_value_column_if_missing(
    database: &Connection,
) -> Result<(), String> {
    if catalog_table_has_column(
        database,
        "metadata_suggestions",
        "normalized_suggested_value",
    )? {
        return Ok(());
    }

    database
        .execute(
            "ALTER TABLE metadata_suggestions
             ADD COLUMN normalized_suggested_value TEXT NOT NULL DEFAULT ''",
            [],
        )
        .map_err(|error| error.to_string())?;
    database
        .execute(
            "UPDATE metadata_suggestions
             SET normalized_suggested_value = lower(suggested_value)
             WHERE normalized_suggested_value = ''",
            [],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn add_failed_preview_strip_ignored_at_column_if_missing(
    database: &Connection,
) -> Result<(), String> {
    if catalog_table_has_column(database, "failed_preview_strips", "ignored_at")? {
        return Ok(());
    }

    database
        .execute(
            "ALTER TABLE failed_preview_strips
             ADD COLUMN ignored_at TEXT",
            [],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn add_video_favorite_column_if_missing(database: &Connection) -> Result<(), String> {
    if catalog_table_has_column(database, "videos", "is_favorite")? {
        return Ok(());
    }

    database
        .execute(
            "ALTER TABLE videos
             ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0",
            [],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn add_video_open_history_columns_if_missing(database: &Connection) -> Result<(), String> {
    if !catalog_table_has_column(database, "videos", "last_opened_at")? {
        database
            .execute(
                "ALTER TABLE videos
                 ADD COLUMN last_opened_at TEXT",
                [],
            )
            .map_err(|error| error.to_string())?;
    }

    if !catalog_table_has_column(database, "videos", "open_count")? {
        database
            .execute(
                "ALTER TABLE videos
                 ADD COLUMN open_count INTEGER NOT NULL DEFAULT 0",
                [],
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

pub(super) fn catalog_table_has_column(
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
