use super::*;

const MAXIMUM_DISPLAYED_UNPROCESSABLE_VIDEO_CANDIDATES: i64 = 20;

impl Catalog {
    #[cfg(test)]
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
        self.regenerate_unaccepted_metadata_suggestions(scan_root_id, scan_root_path)?;

        Ok(ScanRootRefreshSummary {
            scanned_video_count,
            unprocessable_candidate_count,
        })
    }

    pub fn refresh_scan_root_with_progress<P, C, E>(
        &self,
        scan_root_path: &str,
        video_file_probe: &P,
        video_extension_allowlist: &VideoExtensionAllowlist,
        should_cancel: C,
        mut on_progress: E,
    ) -> Result<ScanRootRefreshSummary, String>
    where
        P: VideoFileProbe,
        C: Fn() -> bool,
        E: FnMut(ScanRootRefreshProgress),
    {
        on_progress(ScanRootRefreshProgress {
            scan_root_path: scan_root_path.to_string(),
            status: ScanRootRefreshStatus::Discovery,
            processed_video_candidate_count: 0,
            total_video_candidate_count: None,
            scanned_video_count: 0,
            unprocessable_candidate_count: 0,
            message: None,
        });

        if let Some(refresh_summary) = self.refresh_scan_root_if_unreachable(scan_root_path)? {
            on_progress(ScanRootRefreshProgress {
                scan_root_path: scan_root_path.to_string(),
                status: ScanRootRefreshStatus::Complete,
                processed_video_candidate_count: 0,
                total_video_candidate_count: Some(0),
                scanned_video_count: refresh_summary.scanned_video_count,
                unprocessable_candidate_count: refresh_summary.unprocessable_candidate_count,
                message: None,
            });
            return Ok(refresh_summary);
        }

        let scan_root_id = self.scan_root_id(scan_root_path)?;
        self.mark_scan_root_availability(scan_root_id, true)?;
        let video_candidate_paths =
            discover_video_candidate_paths(Path::new(scan_root_path), video_extension_allowlist)?;
        let total_video_candidate_count = video_candidate_paths.len() as i64;
        let mut seen_video_candidate_paths = HashSet::new();
        let mut scanned_video_count = 0;
        let mut unprocessable_candidate_count = 0;

        on_progress(ScanRootRefreshProgress {
            scan_root_path: scan_root_path.to_string(),
            status: ScanRootRefreshStatus::Scanning,
            processed_video_candidate_count: 0,
            total_video_candidate_count: Some(total_video_candidate_count),
            scanned_video_count,
            unprocessable_candidate_count,
            message: None,
        });

        for video_candidate_path in video_candidate_paths {
            if should_cancel() {
                return Ok(cancel_scan_root_refresh(
                    scan_root_path,
                    seen_video_candidate_paths.len() as i64,
                    total_video_candidate_count,
                    scanned_video_count,
                    unprocessable_candidate_count,
                    &mut on_progress,
                ));
            }

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

            on_progress(ScanRootRefreshProgress {
                scan_root_path: scan_root_path.to_string(),
                status: ScanRootRefreshStatus::Scanning,
                processed_video_candidate_count: seen_video_candidate_paths.len() as i64,
                total_video_candidate_count: Some(total_video_candidate_count),
                scanned_video_count,
                unprocessable_candidate_count,
                message: None,
            });
        }

        if should_cancel() {
            return Ok(cancel_scan_root_refresh(
                scan_root_path,
                seen_video_candidate_paths.len() as i64,
                total_video_candidate_count,
                scanned_video_count,
                unprocessable_candidate_count,
                &mut on_progress,
            ));
        }

        self.remove_stale_scan_root_entries(scan_root_id, &seen_video_candidate_paths)?;
        on_progress(ScanRootRefreshProgress {
            scan_root_path: scan_root_path.to_string(),
            status: ScanRootRefreshStatus::MetadataSuggestionUpdate,
            processed_video_candidate_count: seen_video_candidate_paths.len() as i64,
            total_video_candidate_count: Some(total_video_candidate_count),
            scanned_video_count,
            unprocessable_candidate_count,
            message: None,
        });
        self.regenerate_unaccepted_metadata_suggestions(scan_root_id, scan_root_path)?;

        let refresh_summary = ScanRootRefreshSummary {
            scanned_video_count,
            unprocessable_candidate_count,
        };
        on_progress(ScanRootRefreshProgress {
            scan_root_path: scan_root_path.to_string(),
            status: ScanRootRefreshStatus::Complete,
            processed_video_candidate_count: seen_video_candidate_paths.len() as i64,
            total_video_candidate_count: Some(total_video_candidate_count),
            scanned_video_count,
            unprocessable_candidate_count,
            message: None,
        });

        Ok(refresh_summary)
    }

    #[cfg(test)]
    pub fn refresh_scan_root_until_cancelled<P: VideoFileProbe>(
        &self,
        scan_root_path: &str,
        video_file_probe: &P,
        video_extension_allowlist: &VideoExtensionAllowlist,
        processed_video_candidate_limit: i64,
    ) -> Result<ScanRootRefreshSummary, String> {
        let last_processed_video_candidate_count = std::cell::Cell::new(0);
        self.refresh_scan_root_with_progress(
            scan_root_path,
            video_file_probe,
            video_extension_allowlist,
            || last_processed_video_candidate_count.get() >= processed_video_candidate_limit,
            |progress| {
                last_processed_video_candidate_count.set(progress.processed_video_candidate_count);
            },
        )
    }

    #[cfg(test)]
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

    pub fn list_unprocessable_video_candidates_by_scan_root(
        &self,
    ) -> Result<Vec<UnprocessableVideoCandidateGroup>, String> {
        let mut statement = self
            .database
            .prepare(
                "SELECT scan_roots.path, unprocessable_video_candidates.path, reason, file_size_bytes
                 , candidate_count
                 FROM (
                     SELECT scan_root_id, path, reason, file_size_bytes,
                            COUNT(*) OVER (PARTITION BY scan_root_id) AS candidate_count,
                            ROW_NUMBER() OVER (PARTITION BY scan_root_id ORDER BY path) AS candidate_position
                     FROM unprocessable_video_candidates
                 ) AS unprocessable_video_candidates
                 INNER JOIN scan_roots ON scan_roots.id = unprocessable_video_candidates.scan_root_id
                 WHERE candidate_position <= ?1
                 ORDER BY scan_roots.path, unprocessable_video_candidates.path",
            )
            .map_err(|error| error.to_string())?;

        let candidate_rows = statement
            .query_map([MAXIMUM_DISPLAYED_UNPROCESSABLE_VIDEO_CANDIDATES], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(4)?,
                    UnprocessableVideoCandidate {
                        path: row.get(1)?,
                        reason: row.get(2)?,
                        file_size_bytes: row.get(3)?,
                    },
                ))
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        let mut candidate_groups = Vec::new();
        for (scan_root_path, candidate_count, candidate) in candidate_rows {
            if candidate_groups
                .last()
                .is_none_or(|candidate_group: &UnprocessableVideoCandidateGroup| {
                    candidate_group.scan_root_path != scan_root_path
                })
            {
                candidate_groups.push(UnprocessableVideoCandidateGroup {
                    scan_root_path: scan_root_path.clone(),
                    candidate_count,
                    candidates: Vec::new(),
                });
            }

            if let Some(candidate_group) = candidate_groups.last_mut() {
                candidate_group.candidates.push(candidate);
            }
        }

        Ok(candidate_groups)
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
}

fn cancel_scan_root_refresh<E>(
    scan_root_path: &str,
    processed_video_candidate_count: i64,
    total_video_candidate_count: i64,
    scanned_video_count: i64,
    unprocessable_candidate_count: i64,
    on_progress: &mut E,
) -> ScanRootRefreshSummary
where
    E: FnMut(ScanRootRefreshProgress),
{
    let refresh_summary = ScanRootRefreshSummary {
        scanned_video_count,
        unprocessable_candidate_count,
    };

    on_progress(ScanRootRefreshProgress {
        scan_root_path: scan_root_path.to_string(),
        status: ScanRootRefreshStatus::Cancelled,
        processed_video_candidate_count,
        total_video_candidate_count: Some(total_video_candidate_count),
        scanned_video_count,
        unprocessable_candidate_count,
        message: None,
    });

    refresh_summary
}
