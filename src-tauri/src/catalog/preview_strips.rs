use super::*;

impl Catalog {
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
}
