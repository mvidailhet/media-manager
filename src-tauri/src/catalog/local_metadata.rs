use super::*;

impl Catalog {
    pub fn list_tags(&self) -> Result<Vec<CatalogTag>, String> {
        self.list_metadata_values("tags")
            .map(catalog_tags_from_values)
    }

    pub fn create_tag(&self, name: &str) -> Result<CatalogTag, String> {
        self.create_metadata_value("tags", name, "Tag")
            .map(catalog_tag_from_value)
    }

    pub fn update_tag(&self, tag_id: i64, name: &str) -> Result<CatalogTag, String> {
        self.update_metadata_value("tags", tag_id, name, "Tag")
            .map(catalog_tag_from_value)
    }

    pub fn delete_tag(&self, tag_id: i64) -> Result<(), String> {
        self.delete_metadata_value(
            "tags",
            "tag_videos",
            "tag_id",
            tag_id,
            "Attached Tags must be detached before deletion",
        )
    }

    pub fn list_performers(&self) -> Result<Vec<CatalogPerformer>, String> {
        self.list_metadata_values("performers")
            .map(catalog_performers_from_values)
    }

    pub fn create_performer(&self, name: &str) -> Result<CatalogPerformer, String> {
        self.create_metadata_value("performers", name, "Performer")
            .map(catalog_performer_from_value)
    }

    pub fn update_performer(
        &self,
        performer_id: i64,
        name: &str,
    ) -> Result<CatalogPerformer, String> {
        self.update_metadata_value("performers", performer_id, name, "Performer")
            .map(catalog_performer_from_value)
    }

    pub fn delete_performer(&self, performer_id: i64) -> Result<(), String> {
        self.delete_metadata_value(
            "performers",
            "performer_videos",
            "performer_id",
            performer_id,
            "Attached Performers must be detached before deletion",
        )
    }

    pub fn attach_tag_to_video(&self, tag_id: i64, video_id: i64) -> Result<(), String> {
        self.attach_metadata_to_video("tag_videos", "tag_id", tag_id, video_id)
    }

    pub fn detach_tag_from_video(&self, tag_id: i64, video_id: i64) -> Result<(), String> {
        self.detach_metadata_from_video("tags", "tag_videos", "tag_id", tag_id, video_id)
    }

    pub fn tags_for_video(&self, video_id: i64) -> Result<Vec<CatalogTag>, String> {
        self.metadata_values_for_video("tags", "tag_videos", "tag_id", video_id)
            .map(catalog_tags_from_values)
    }

    pub fn attach_performer_to_video(
        &self,
        performer_id: i64,
        video_id: i64,
    ) -> Result<(), String> {
        self.attach_metadata_to_video("performer_videos", "performer_id", performer_id, video_id)
    }

    pub fn detach_performer_from_video(
        &self,
        performer_id: i64,
        video_id: i64,
    ) -> Result<(), String> {
        self.detach_metadata_from_video(
            "performers",
            "performer_videos",
            "performer_id",
            performer_id,
            video_id,
        )
    }

    pub fn performers_for_video(&self, video_id: i64) -> Result<Vec<CatalogPerformer>, String> {
        self.metadata_values_for_video("performers", "performer_videos", "performer_id", video_id)
            .map(catalog_performers_from_values)
    }

    fn list_metadata_values(&self, table_name: &str) -> Result<Vec<CatalogMetadataValue>, String> {
        let query = format!(
            "SELECT id, name
             FROM {table_name}
             ORDER BY normalized_name"
        );
        let mut statement = self
            .database
            .prepare(&query)
            .map_err(|error| error.to_string())?;

        let metadata_values = statement
            .query_map([], |row| {
                Ok(CatalogMetadataValue {
                    id: row.get(0)?,
                    name: row.get(1)?,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(metadata_values)
    }

    fn create_metadata_value(
        &self,
        table_name: &str,
        name: &str,
        metadata_type_name: &str,
    ) -> Result<CatalogMetadataValue, String> {
        let metadata_name = normalized_metadata_input(name)?;
        let duplicate_error = format!("{metadata_type_name} already exists");
        self.reject_duplicate_metadata_name(
            table_name,
            &metadata_name.normalized_name,
            None,
            &duplicate_error,
        )?;
        let query = format!(
            "INSERT INTO {table_name} (name, normalized_name)
             VALUES (?1, ?2)"
        );
        self.database
            .execute(
                &query,
                params![metadata_name.display_name, metadata_name.normalized_name],
            )
            .map_err(|error| error.to_string())?;
        let metadata_id = self.database.last_insert_rowid();

        self.metadata_value_by_id(table_name, metadata_id, metadata_type_name)
    }

    fn update_metadata_value(
        &self,
        table_name: &str,
        metadata_id: i64,
        name: &str,
        metadata_type_name: &str,
    ) -> Result<CatalogMetadataValue, String> {
        let metadata_name = normalized_metadata_input(name)?;
        let duplicate_error = format!("{metadata_type_name} already exists");
        self.reject_duplicate_metadata_name(
            table_name,
            &metadata_name.normalized_name,
            Some(metadata_id),
            &duplicate_error,
        )?;
        let query = format!(
            "UPDATE {table_name}
             SET name = ?1,
                 normalized_name = ?2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?3"
        );
        self.database
            .execute(
                &query,
                params![
                    metadata_name.display_name,
                    metadata_name.normalized_name,
                    metadata_id
                ],
            )
            .map_err(|error| error.to_string())?;

        self.metadata_value_by_id(table_name, metadata_id, metadata_type_name)
    }

    fn delete_metadata_value(
        &self,
        table_name: &str,
        link_table_name: &str,
        metadata_id_column: &str,
        metadata_id: i64,
        attached_metadata_error: &str,
    ) -> Result<(), String> {
        self.reject_attached_metadata(
            link_table_name,
            metadata_id_column,
            metadata_id,
            attached_metadata_error,
        )?;
        let query = format!(
            "DELETE FROM {table_name}
             WHERE id = ?1"
        );
        self.database
            .execute(&query, params![metadata_id])
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    fn reject_attached_metadata(
        &self,
        link_table_name: &str,
        metadata_id_column: &str,
        metadata_id: i64,
        attached_metadata_error: &str,
    ) -> Result<(), String> {
        let query = format!(
            "SELECT 1
             FROM {link_table_name}
             WHERE {metadata_id_column} = ?1
             LIMIT 1"
        );
        let has_attached_video = self
            .database
            .query_row(&query, params![metadata_id], |_| Ok(()))
            .optional()
            .map_err(|error| error.to_string())?
            .is_some();

        if has_attached_video {
            Err(attached_metadata_error.to_string())
        } else {
            Ok(())
        }
    }

    fn attach_metadata_to_video(
        &self,
        table_name: &str,
        metadata_id_column: &str,
        metadata_id: i64,
        video_id: i64,
    ) -> Result<(), String> {
        let query = format!(
            "INSERT OR IGNORE INTO {table_name} ({metadata_id_column}, video_id)
             VALUES (?1, ?2)"
        );
        self.database
            .execute(&query, params![metadata_id, video_id])
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    fn detach_metadata_from_video(
        &self,
        metadata_table_name: &str,
        table_name: &str,
        metadata_id_column: &str,
        metadata_id: i64,
        video_id: i64,
    ) -> Result<(), String> {
        let query = format!(
            "DELETE FROM {table_name}
             WHERE {metadata_id_column} = ?1
               AND video_id = ?2"
        );
        self.database
            .execute(&query, params![metadata_id, video_id])
            .map_err(|error| error.to_string())?;
        self.delete_metadata_value_if_unused(
            metadata_table_name,
            table_name,
            metadata_id_column,
            metadata_id,
        )?;

        Ok(())
    }

    fn delete_metadata_value_if_unused(
        &self,
        metadata_table_name: &str,
        link_table_name: &str,
        metadata_id_column: &str,
        metadata_id: i64,
    ) -> Result<(), String> {
        let query = format!(
            "DELETE FROM {metadata_table_name}
             WHERE id = ?1
               AND NOT EXISTS (
                   SELECT 1
                   FROM {link_table_name}
                   WHERE {link_table_name}.{metadata_id_column} = ?1
               )"
        );
        self.database
            .execute(&query, params![metadata_id])
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    fn metadata_values_for_video(
        &self,
        metadata_table_name: &str,
        link_table_name: &str,
        metadata_id_column: &str,
        video_id: i64,
    ) -> Result<Vec<CatalogMetadataValue>, String> {
        let query = format!(
            "SELECT {metadata_table_name}.id, {metadata_table_name}.name
             FROM {metadata_table_name}
             JOIN {link_table_name}
               ON {link_table_name}.{metadata_id_column} = {metadata_table_name}.id
             WHERE {link_table_name}.video_id = ?1
             ORDER BY {metadata_table_name}.normalized_name"
        );
        let mut statement = self
            .database
            .prepare(&query)
            .map_err(|error| error.to_string())?;

        let metadata_values = statement
            .query_map(params![video_id], |row| {
                Ok(CatalogMetadataValue {
                    id: row.get(0)?,
                    name: row.get(1)?,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(metadata_values)
    }

    fn metadata_value_by_id(
        &self,
        table_name: &str,
        metadata_id: i64,
        metadata_type_name: &str,
    ) -> Result<CatalogMetadataValue, String> {
        let query = format!(
            "SELECT id, name
             FROM {table_name}
             WHERE id = ?1"
        );
        self.database
            .query_row(&query, params![metadata_id], |row| {
                Ok(CatalogMetadataValue {
                    id: row.get(0)?,
                    name: row.get(1)?,
                })
            })
            .optional()
            .map_err(|error| error.to_string())?
            .ok_or_else(|| format!("{metadata_type_name} is not in the Catalog"))
    }

    fn reject_duplicate_metadata_name(
        &self,
        table_name: &str,
        normalized_name: &str,
        ignored_metadata_id: Option<i64>,
        duplicate_error: &str,
    ) -> Result<(), String> {
        let query = format!(
            "SELECT id
             FROM {table_name}
             WHERE normalized_name = ?1"
        );
        let existing_metadata_id = self
            .database
            .query_row(&query, params![normalized_name], |row| row.get::<_, i64>(0))
            .optional()
            .map_err(|error| error.to_string())?;
        let is_duplicate = existing_metadata_id
            .filter(|existing_metadata_id| Some(*existing_metadata_id) != ignored_metadata_id)
            .is_some();

        if is_duplicate {
            Err(duplicate_error.to_string())
        } else {
            Ok(())
        }
    }
}
