use super::*;

impl Catalog {
    pub fn list_metadata_suggestion_groups(&self) -> Result<Vec<MetadataSuggestionGroup>, String> {
        let mut statement = self
            .database
            .prepare(
                "SELECT metadata_suggestions.suggested_value,
                        lower(metadata_suggestions.suggested_value),
                        metadata_suggestions.suggestion_kind,
                        scan_roots.path,
                        metadata_suggestions.source_path_segment,
                        metadata_suggestions.video_id,
                        videos.title,
                        file_locations.path,
                        scan_roots.suggest_tags_from_child_folders,
                        scan_roots.ignored_folder_names,
                        scan_roots.ignored_exact_year_start,
                        scan_roots.ignored_exact_year_end
                 FROM metadata_suggestions
                 JOIN scan_roots ON scan_roots.id = metadata_suggestions.scan_root_id
                 JOIN videos ON videos.id = metadata_suggestions.video_id
                 JOIN file_locations
                   ON file_locations.video_id = metadata_suggestions.video_id
                  AND file_locations.scan_root_id = metadata_suggestions.scan_root_id
                 WHERE metadata_suggestions.accepted_at IS NULL
                   AND metadata_suggestions.rejected_at IS NULL
                 ORDER BY lower(metadata_suggestions.suggested_value),
                          metadata_suggestions.suggestion_kind,
                          scan_roots.path,
                          metadata_suggestions.source_path_segment,
                          videos.title,
                          metadata_suggestions.suggested_value,
                          metadata_suggestions.video_id",
            )
            .map_err(|error| error.to_string())?;

        let suggestion_rows = statement
            .query_map([], |row| {
                Ok(MetadataSuggestionRow {
                    suggested_value: row.get(0)?,
                    normalized_suggested_value: row.get(1)?,
                    suggestion_kind: row.get(2)?,
                    scan_root_path: row.get(3)?,
                    source_path_segment: row.get(4)?,
                    video_id: row.get(5)?,
                    title: row.get(6)?,
                    file_location_path: row.get(7)?,
                    inference_rules: ScanRootInferenceRules {
                        suggest_tags_from_child_folders: row.get::<_, i64>(8)? == 1,
                        ignored_folder_names: ignored_folder_names_from_json(row.get(9)?)?,
                        ignored_exact_year_range: ExactYearRange {
                            start_year: row.get(10)?,
                            end_year: row.get(11)?,
                        },
                    },
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(group_metadata_suggestions(suggestion_rows))
    }

    pub fn accept_metadata_suggestion_for_videos(
        &self,
        scan_root_path: &str,
        suggested_value: &str,
        source_path_segment: &str,
        suggestion_kind: &str,
        accepted_metadata_kind: Option<&str>,
        accepted_value: Option<&str>,
        video_ids: &[i64],
    ) -> Result<(), String> {
        if video_ids.is_empty() {
            return Err("Select at least one Video to accept".to_string());
        }

        self.reject_unknown_suggestion_kind(suggestion_kind)?;
        let metadata_kind = accepted_metadata_kind.unwrap_or(suggestion_kind);
        self.reject_unknown_suggestion_kind(metadata_kind)?;
        let scan_root_id = self.scan_root_id(scan_root_path)?;
        self.reject_videos_without_pending_metadata_suggestions(
            scan_root_id,
            suggested_value,
            source_path_segment,
            suggestion_kind,
            video_ids,
        )?;

        let transaction = self
            .database
            .unchecked_transaction()
            .map_err(|error| error.to_string())?;
        let metadata_value_name = accepted_value.unwrap_or(suggested_value);
        let metadata_value_id =
            metadata_value_id_for_suggestion(&transaction, metadata_kind, metadata_value_name)?;
        let suggestion_mapping = AcceptedMetadataSuggestionMapping::new(
            scan_root_id,
            suggested_value,
            suggestion_kind,
            metadata_kind,
            metadata_value_id,
        )?;

        for video_id in video_ids {
            attach_metadata_suggestion_to_video(
                &transaction,
                metadata_kind,
                metadata_value_id,
                *video_id,
            )?;
            let source_path_segments = pending_metadata_suggestion_source_path_segments(
                &transaction,
                scan_root_id,
                *video_id,
                suggested_value,
                source_path_segment,
                suggestion_kind,
            )?;
            for source_path_segment in source_path_segments {
                remember_metadata_suggestion_mapping(
                    &transaction,
                    &suggestion_mapping,
                    &source_path_segment,
                )?;
            }
            transaction
                .execute(
                    "UPDATE metadata_suggestions
                     SET accepted_at = CURRENT_TIMESTAMP,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE scan_root_id = ?1
                       AND video_id = ?2
                       AND lower(suggested_value) = lower(?3)
                       AND source_path_segment = ?4
                       AND suggestion_kind = ?5
                       AND accepted_at IS NULL
                       AND rejected_at IS NULL",
                    params![
                        scan_root_id,
                        video_id,
                        suggested_value,
                        source_path_segment,
                        suggestion_kind
                    ],
                )
                .map_err(|error| error.to_string())?;
        }

        transaction.commit().map_err(|error| error.to_string())
    }

    pub fn reject_metadata_suggestion_source(
        &self,
        scan_root_path: &str,
        source_path_segment: &str,
        suggested_value: &str,
        suggestion_kind: &str,
    ) -> Result<(), String> {
        self.reject_unknown_suggestion_kind(suggestion_kind)?;
        let scan_root_id = self.scan_root_id(scan_root_path)?;
        let metadata_name = normalized_metadata_input(suggested_value)?;
        let transaction = self
            .database
            .unchecked_transaction()
            .map_err(|error| error.to_string())?;

        transaction
            .execute(
                "INSERT INTO metadata_suggestion_rejections (
                    scan_root_id,
                    source_path_segment,
                    normalized_suggested_value,
                    suggestion_kind
                 )
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT (
                    scan_root_id,
                    source_path_segment,
                    normalized_suggested_value,
                    suggestion_kind
                 )
                 DO UPDATE SET updated_at = CURRENT_TIMESTAMP",
                params![
                    scan_root_id,
                    source_path_segment,
                    metadata_name.normalized_name,
                    suggestion_kind
                ],
            )
            .map_err(|error| error.to_string())?;

        transaction
            .execute(
                "UPDATE metadata_suggestions
                 SET rejected_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE scan_root_id = ?1
                   AND source_path_segment = ?2
                   AND lower(suggested_value) = lower(?3)
                   AND suggestion_kind = ?4
                   AND accepted_at IS NULL
                   AND rejected_at IS NULL",
                params![
                    scan_root_id,
                    source_path_segment,
                    suggested_value,
                    suggestion_kind
                ],
            )
            .map_err(|error| error.to_string())?;

        transaction.commit().map_err(|error| error.to_string())
    }

    fn reject_unknown_suggestion_kind(&self, suggestion_kind: &str) -> Result<(), String> {
        match suggestion_kind {
            "tag" | "performer" => Ok(()),
            _ => Err("Metadata Suggestion kind is not supported".to_string()),
        }
    }

    fn reject_videos_without_pending_metadata_suggestions(
        &self,
        scan_root_id: i64,
        suggested_value: &str,
        source_path_segment: &str,
        suggestion_kind: &str,
        video_ids: &[i64],
    ) -> Result<(), String> {
        let requested_video_ids = video_ids.iter().copied().collect::<HashSet<_>>();

        if requested_video_ids.len() != video_ids.len() {
            return Err("Selected Videos must be unique".to_string());
        }

        for video_id in video_ids {
            let has_pending_suggestion = self
                .database
                .query_row(
                    "SELECT 1
                     FROM metadata_suggestions
                     WHERE scan_root_id = ?1
                       AND video_id = ?2
                       AND lower(suggested_value) = lower(?3)
                       AND source_path_segment = ?4
                       AND suggestion_kind = ?5
                       AND accepted_at IS NULL
                       AND rejected_at IS NULL
                     LIMIT 1",
                    params![
                        scan_root_id,
                        video_id,
                        suggested_value,
                        source_path_segment,
                        suggestion_kind
                    ],
                    |_| Ok(()),
                )
                .optional()
                .map_err(|error| error.to_string())?
                .is_some();

            if !has_pending_suggestion {
                return Err("Selected Videos must have pending Metadata Suggestions".to_string());
            }
        }

        Ok(())
    }

    pub(super) fn regenerate_unaccepted_metadata_suggestions(
        &self,
        scan_root_id: i64,
        scan_root_path: &str,
    ) -> Result<(), String> {
        let scan_root = self.scan_root(scan_root_path)?;
        let file_locations = self.file_locations_for_metadata_inference(scan_root_id)?;
        let transaction = self
            .database
            .unchecked_transaction()
            .map_err(|error| error.to_string())?;

        transaction
            .execute(
                "DELETE FROM metadata_suggestions
                 WHERE scan_root_id = ?1
                   AND accepted_at IS NULL
                   AND rejected_at IS NULL",
                params![scan_root_id],
            )
            .map_err(|error| error.to_string())?;

        let video_count_by_folder = video_count_by_folder(&file_locations);

        for (video_id, video_path) in file_locations {
            for folder_segment in metadata_suggestion_segments(
                scan_root_path,
                &video_path,
                &scan_root.inference_rules,
            ) {
                if is_single_video_leaf_folder_suggestion(
                    &video_path,
                    &folder_segment,
                    &video_count_by_folder,
                ) {
                    continue;
                }

                let suggested_value = metadata_suggestion_display_value(&folder_segment);
                let has_source_rejection = transaction
                    .query_row(
                        "SELECT 1
                         FROM metadata_suggestion_rejections
                         WHERE scan_root_id = ?1
                           AND source_path_segment = ?2
                           AND normalized_suggested_value = lower(?3)
                           AND suggestion_kind = 'tag'
                         LIMIT 1",
                        params![scan_root_id, folder_segment, suggested_value],
                        |_| Ok(()),
                    )
                    .optional()
                    .map_err(|error| error.to_string())?
                    .is_some();

                if has_source_rejection {
                    continue;
                }

                if let Some(suggestion_mapping) = mapped_metadata_suggestion(
                    &transaction,
                    scan_root_id,
                    &folder_segment,
                    &suggested_value,
                    "tag",
                )? {
                    attach_mapped_metadata_suggestion_to_video(
                        &transaction,
                        &suggestion_mapping,
                        video_id,
                    )?;
                    transaction
                        .execute(
                            "INSERT INTO metadata_suggestions (
                                scan_root_id,
                                video_id,
                                source_path_segment,
                                suggested_value,
                                suggestion_kind,
                                accepted_at
                             )
                             VALUES (?1, ?2, ?3, ?4, 'tag', CURRENT_TIMESTAMP)
                             ON CONFLICT(scan_root_id, video_id, source_path_segment, suggestion_kind)
                             DO UPDATE SET
                                suggested_value = excluded.suggested_value,
                                accepted_at = CURRENT_TIMESTAMP,
                                rejected_at = NULL,
                                updated_at = CURRENT_TIMESTAMP",
                            params![scan_root_id, video_id, folder_segment, suggested_value],
                        )
                        .map_err(|error| error.to_string())?;
                    continue;
                }

                transaction
                    .execute(
                        "INSERT INTO metadata_suggestions (
                            scan_root_id,
                            video_id,
                            source_path_segment,
                            suggested_value,
                            suggestion_kind
                         )
                         VALUES (?1, ?2, ?3, ?4, 'tag')
                         ON CONFLICT(scan_root_id, video_id, source_path_segment, suggestion_kind)
                         DO UPDATE SET
                            suggested_value = excluded.suggested_value,
                            updated_at = CURRENT_TIMESTAMP",
                        params![scan_root_id, video_id, folder_segment, suggested_value],
                    )
                    .map_err(|error| error.to_string())?;
            }
        }

        transaction.commit().map_err(|error| error.to_string())
    }

    fn file_locations_for_metadata_inference(
        &self,
        scan_root_id: i64,
    ) -> Result<Vec<(i64, String)>, String> {
        let mut statement = self
            .database
            .prepare(
                "SELECT video_id, path
                 FROM file_locations
                 WHERE scan_root_id = ?1
                 ORDER BY path",
            )
            .map_err(|error| error.to_string())?;

        let file_locations = statement
            .query_map(params![scan_root_id], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(file_locations)
    }
}

fn video_count_by_folder(file_locations: &[(i64, String)]) -> HashMap<PathBuf, usize> {
    let mut video_count_by_folder = HashMap::new();

    for (_, video_path) in file_locations {
        if let Some(video_folder) = Path::new(video_path).parent() {
            let video_count = video_count_by_folder
                .entry(video_folder.to_path_buf())
                .or_insert(0);
            *video_count += 1;
        }
    }

    video_count_by_folder
}

fn is_single_video_leaf_folder_suggestion(
    video_path: &str,
    source_path_segment: &str,
    video_count_by_folder: &HashMap<PathBuf, usize>,
) -> bool {
    let video_folder = match Path::new(video_path).parent() {
        Some(video_folder) => video_folder,
        None => return false,
    };
    let folder_name = match video_folder.file_name().and_then(|name| name.to_str()) {
        Some(folder_name) => folder_name,
        None => return false,
    };

    folder_name == source_path_segment
        && video_count_by_folder
            .get(video_folder)
            .copied()
            .unwrap_or_default()
            == 1
}
