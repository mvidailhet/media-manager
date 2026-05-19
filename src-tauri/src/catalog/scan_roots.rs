use super::*;

impl Catalog {
    pub fn add_scan_root(&self, scan_root_path: &Path) -> Result<ScanRoot, String> {
        let canonical_scan_root_path =
            canonical_scan_root_path(scan_root_path).map_err(|error| error.to_string())?;
        let scan_root = ScanRoot {
            inference_rules: ScanRootInferenceRules::default(),
            is_available: true,
            last_scan_completed_at: None,
            path: canonical_scan_root_path.to_string_lossy().into_owned(),
        };

        self.reject_overlapping_scan_root(&canonical_scan_root_path)?;
        self.database
            .execute(
                "INSERT INTO scan_roots (path, drive_identity) VALUES (?1, NULL)",
                params![scan_root.path],
            )
            .map_err(|error| error.to_string())?;

        Ok(scan_root)
    }

    pub fn list_scan_roots(&self) -> Result<Vec<ScanRoot>, String> {
        let mut statement = self
            .database
            .prepare(
                "SELECT path,
                        is_available,
                        suggest_tags_from_folder_names,
                        suggest_tags_from_filename_brackets,
                        ignored_folder_names,
                        ignored_exact_year_start,
                        ignored_exact_year_end,
                        last_scan_completed_at
                 FROM scan_roots
                 ORDER BY path",
            )
            .map_err(|error| error.to_string())?;

        let scan_roots = statement
            .query_map([], |row| {
                Ok(ScanRoot {
                    path: row.get(0)?,
                    is_available: row.get::<_, i64>(1)? == 1,
                    last_scan_completed_at: row.get(7)?,
                    inference_rules: scan_root_inference_rules_from_row(row)?,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(scan_roots)
    }

    pub fn check_scan_root_availability(&self, scan_root_path: &str) -> Result<ScanRoot, String> {
        let scan_root_id = self.scan_root_id(scan_root_path)?;
        let is_available = Path::new(scan_root_path).is_dir();

        self.mark_scan_root_availability(scan_root_id, is_available)?;
        self.scan_root(scan_root_path)
    }

    pub fn update_scan_root_inference_rules(
        &self,
        scan_root_path: &str,
        inference_rules: ScanRootInferenceRules,
    ) -> Result<ScanRoot, String> {
        let inference_rules = validated_inference_rules(inference_rules)?;
        let ignored_folder_names = serde_json::to_string(&inference_rules.ignored_folder_names)
            .map_err(|error| error.to_string())?;
        let updated_scan_root_count = self
            .database
            .execute(
                "UPDATE scan_roots
                 SET suggest_tags_from_folder_names = ?1,
                     suggest_tags_from_filename_brackets = ?2,
                     ignored_folder_names = ?3,
                     ignored_exact_year_start = ?4,
                     ignored_exact_year_end = ?5,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE path = ?6",
                params![
                    i64::from(inference_rules.suggest_tags_from_folder_names),
                    i64::from(inference_rules.suggest_tags_from_filename_brackets),
                    ignored_folder_names,
                    inference_rules.ignored_exact_year_range.start_year,
                    inference_rules.ignored_exact_year_range.end_year,
                    scan_root_path,
                ],
            )
            .map_err(|error| error.to_string())?;
        if updated_scan_root_count == 0 {
            return Err("Scan Root is not in the Catalog".to_string());
        }
        self.regenerate_unaccepted_metadata_suggestions(
            self.scan_root_id(scan_root_path)?,
            scan_root_path,
        )?;

        self.scan_root(scan_root_path)
    }

    pub fn remove_scan_root_preserving_missing_videos(
        &self,
        scan_root_path: &str,
    ) -> Result<(), String> {
        self.database
            .execute(
                "DELETE FROM scan_roots
                 WHERE path = ?1",
                params![scan_root_path],
            )
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    pub fn remove_scan_root_forgetting_catalog_videos(
        &self,
        scan_root_path: &str,
    ) -> Result<(), String> {
        let transaction = self
            .database
            .unchecked_transaction()
            .map_err(|error| error.to_string())?;
        transaction
            .execute(
                "DELETE FROM file_locations
                 WHERE scan_root_id IN (
                    SELECT id
                    FROM scan_roots
                    WHERE path = ?1
                 )",
                params![scan_root_path],
            )
            .map_err(|error| error.to_string())?;
        transaction
            .execute(
                "DELETE FROM videos
                 WHERE NOT EXISTS (
                    SELECT 1
                    FROM file_locations
                    WHERE file_locations.video_id = videos.id
                 )",
                [],
            )
            .map_err(|error| error.to_string())?;
        transaction
            .execute(
                "DELETE FROM scan_roots
                 WHERE path = ?1",
                params![scan_root_path],
            )
            .map_err(|error| error.to_string())?;
        transaction.commit().map_err(|error| error.to_string())
    }

    fn reject_overlapping_scan_root(&self, candidate_path: &Path) -> Result<(), String> {
        let scan_roots = self.list_scan_roots()?;
        let has_overlap = scan_roots.iter().any(|scan_root| {
            let existing_path = Path::new(&scan_root.path);

            candidate_path.starts_with(existing_path) || existing_path.starts_with(candidate_path)
        });

        if has_overlap {
            Err("Scan Root overlaps with an existing Scan Root".to_string())
        } else {
            Ok(())
        }
    }

    pub(super) fn scan_root_id(&self, scan_root_path: &str) -> Result<i64, String> {
        self.database
            .query_row(
                "SELECT id FROM scan_roots WHERE path = ?1",
                params![scan_root_path],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "Scan Root is not in the Catalog".to_string())
    }

    pub(super) fn scan_root(&self, scan_root_path: &str) -> Result<ScanRoot, String> {
        self.database
            .query_row(
                "SELECT path,
                        is_available,
                        suggest_tags_from_folder_names,
                        suggest_tags_from_filename_brackets,
                        ignored_folder_names,
                        ignored_exact_year_start,
                        ignored_exact_year_end,
                        last_scan_completed_at
                 FROM scan_roots
                 WHERE path = ?1",
                params![scan_root_path],
                |row| {
                    Ok(ScanRoot {
                        path: row.get(0)?,
                        is_available: row.get::<_, i64>(1)? == 1,
                        last_scan_completed_at: row.get(7)?,
                        inference_rules: scan_root_inference_rules_from_row(row)?,
                    })
                },
            )
            .optional()
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "Scan Root is not in the Catalog".to_string())
    }

    pub(super) fn mark_scan_root_availability(
        &self,
        scan_root_id: i64,
        is_available: bool,
    ) -> Result<(), String> {
        self.database
            .execute(
                "UPDATE scan_roots
                 SET is_available = ?1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?2",
                params![i64::from(is_available), scan_root_id],
            )
            .map_err(|error| error.to_string())?;

        Ok(())
    }
}
