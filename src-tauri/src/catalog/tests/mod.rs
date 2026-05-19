use crate::catalog::{
    Catalog, FailedPreviewStrip, PreviewStripRetryReason, VideoFileProbe, VideoProbe,
};
use rusqlite::{params, Connection};
use std::path::Path;

mod local_metadata;
mod metadata_suggestions;
mod migrations;
mod preview_strips;
mod scan_refresh;
mod videos;

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
                   AND tbl_name IN (
                        'metadata_suggestions',
                        'tags',
                        'performers',
                        'tag_videos',
                        'performer_videos'
                   )
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
                 WHERE accepted_at IS NULL
                   AND rejected_at IS NULL
                 ORDER BY source_path_segment, suggested_value",
        )
        .expect("metadata suggestion sources query prepares");

    statement
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .expect("metadata suggestion sources query runs")
        .collect::<Result<Vec<_>, _>>()
        .expect("metadata suggestion sources load")
}

fn auto_accepted_metadata_suggestions(
    database: &Connection,
) -> Vec<(String, String, String, String)> {
    let mut statement = database
        .prepare(
            "SELECT videos.title,
                        metadata_suggestions.source_path_segment,
                        metadata_suggestions.suggested_value,
                        metadata_suggestions.suggestion_kind
                 FROM metadata_suggestions
                 JOIN videos ON videos.id = metadata_suggestions.video_id
                 WHERE metadata_suggestions.accepted_at IS NOT NULL
                 ORDER BY videos.title,
                          metadata_suggestions.source_path_segment,
                          metadata_suggestions.suggested_value",
        )
        .expect("accepted metadata suggestions query prepares");

    statement
        .query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .expect("accepted metadata suggestions query runs")
        .collect::<Result<Vec<_>, _>>()
        .expect("accepted metadata suggestions load")
}

fn metadata_suggestion_mappings(database: &Connection) -> Vec<(String, String, String)> {
    let mut statement = database
        .prepare(
            "SELECT source_path_segment,
                        normalized_suggested_value,
                        suggestion_kind
                 FROM metadata_suggestion_mappings
                 ORDER BY source_path_segment,
                          normalized_suggested_value",
        )
        .expect("metadata suggestion mappings query prepares");

    statement
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .expect("metadata suggestion mappings query runs")
        .collect::<Result<Vec<_>, _>>()
        .expect("metadata suggestion mappings load")
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

impl crate::catalog::PreviewStripGenerator for FakePreviewStripGenerator {
    fn generate_preview_strip(
        &self,
        request: &crate::catalog::PreviewStripRequest,
    ) -> Result<crate::catalog::GeneratedPreviewStrip, String> {
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

        Ok(crate::catalog::GeneratedPreviewStrip {
            path: request.output_path.clone(),
            frame_count: request.frame_count,
            column_count: 5,
            row_count: 8,
        })
    }
}
