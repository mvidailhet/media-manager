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

    pub fn pending_preview_strip_requests(
        &self,
        preview_cache_path: &Path,
        selected_scope_branches: Option<&[PreviewGenerationScopeBranch]>,
    ) -> Result<Vec<PreviewStripRequest>, String> {
        fs::create_dir_all(preview_cache_path).map_err(|error| error.to_string())?;
        self.remove_preview_strip_rows_without_cache_files()?;

        self.pending_preview_strips(selected_scope_branches)?
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
        selected_scope_branches: Option<&[PreviewGenerationScopeBranch]>,
    ) -> Result<Option<PreviewStripRequest>, String> {
        Ok(self
            .pending_preview_strip_requests(preview_cache_path, selected_scope_branches)?
            .into_iter()
            .next())
    }

    pub fn preview_strip_queue_counts(
        &self,
        selected_scope_branches: Option<&[PreviewGenerationScopeBranch]>,
    ) -> Result<PreviewStripQueueCounts, String> {
        self.remove_preview_strip_rows_without_cache_files()?;

        Ok(PreviewStripQueueCounts {
            pending_count: self.pending_preview_strips(selected_scope_branches)?.len() as i64,
            failed_count: self.failed_preview_strip_count()?,
        })
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

    fn pending_preview_strips(
        &self,
        selected_scope_branches: Option<&[PreviewGenerationScopeBranch]>,
    ) -> Result<Vec<PendingPreviewStrip>, String> {
        if selected_scope_branches == Some(&[]) {
            return Ok(Vec::new());
        }

        let mut statement = self
            .database
            .prepare(
                "SELECT videos.id,
                        videos.duration_milliseconds,
                        file_locations.path,
                        scan_roots.path
                 FROM videos
                 JOIN file_locations ON file_locations.video_id = videos.id
                 JOIN scan_roots ON scan_roots.id = file_locations.scan_root_id
                 LEFT JOIN preview_strips ON preview_strips.video_id = videos.id
                 LEFT JOIN failed_preview_strips ON failed_preview_strips.video_id = videos.id
                 WHERE preview_strips.id IS NULL
                   AND failed_preview_strips.id IS NULL
                   AND scan_roots.is_available = 1
                 ORDER BY videos.id, file_locations.path",
            )
            .map_err(|error| error.to_string())?;

        let eligible_file_locations = statement
            .query_map([], |row| {
                Ok(PendingPreviewStrip {
                    video_id: row.get(0)?,
                    duration_milliseconds: row.get(1)?,
                    video_path: row.get(2)?,
                    available_scan_root_path: row.get(3)?,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        let mut pending_preview_strips = Vec::new();
        let mut pending_video_ids = HashSet::new();

        for eligible_file_location in eligible_file_locations {
            if !preview_strip_is_inside_generation_scope(
                &eligible_file_location,
                selected_scope_branches,
            ) {
                continue;
            }

            if pending_video_ids.insert(eligible_file_location.video_id) {
                pending_preview_strips.push(eligible_file_location);
            }
        }

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

fn preview_strip_is_inside_generation_scope(
    pending_preview_strip: &PendingPreviewStrip,
    selected_scope_branches: Option<&[PreviewGenerationScopeBranch]>,
) -> bool {
    let Some(selected_scope_branches) = selected_scope_branches else {
        return true;
    };

    selected_scope_branches.iter().any(|scope_branch| {
        pending_preview_strip.available_scan_root_path == scope_branch.available_scan_root_path
            && path_is_inside_branch(&pending_preview_strip.video_path, &scope_branch.path)
    })
}

fn path_is_inside_branch(path: &str, branch_path: &str) -> bool {
    let normalized_path = normalized_folder_path(path);
    let normalized_branch_path = normalized_folder_path(branch_path);

    normalized_path == normalized_branch_path
        || normalized_path.starts_with(&format!("{normalized_branch_path}/"))
}

fn normalized_folder_path(path: &str) -> String {
    path.replace('\\', "/").trim_end_matches('/').to_string()
}
