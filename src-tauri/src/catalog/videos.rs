use super::*;

impl Catalog {
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
}
