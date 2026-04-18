//! CellFormatRepository -- CRUD for `content.cell_formats` and
//! `content.sheet_metadata`.

use crate::models::cell_format::{CellFormat, SheetMetadata, UpsertCellFormat, UpsertSheetMetadata};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for cell format overrides and sheet metadata.
pub struct CellFormatRepository;

impl CellFormatRepository {
    // ========================================================================
    // Cell Formats
    // ========================================================================

    /// Upsert a cell format override.
    ///
    /// Inserts a new format or updates the existing one for the given
    /// (document, sheet, cell) combination.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure or constraint violations.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn upsert_format(
        pool: &PgPool,
        document_id: Uuid,
        sheet_index: i32,
        input: UpsertCellFormat,
    ) -> Result<CellFormat> {
        let row = sqlx::query_as::<_, CellFormat>(
            r#"INSERT INTO content.cell_formats
                (document_id, sheet_index, cell_ref, style_id, format_override, conditional_rules)
               VALUES ($1, $2, $3, $4, COALESCE($5, '{}'), COALESCE($6, '[]'))
               ON CONFLICT (document_id, sheet_index, cell_ref) DO UPDATE SET
                style_id = COALESCE($4, content.cell_formats.style_id),
                format_override = COALESCE($5, content.cell_formats.format_override),
                conditional_rules = COALESCE($6, content.cell_formats.conditional_rules),
                updated_at = NOW()
               RETURNING *"#,
        )
        .bind(document_id)
        .bind(sheet_index)
        .bind(&input.cell_ref)
        .bind(input.style_id)
        .bind(&input.format_override)
        .bind(&input.conditional_rules)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(row)
    }

    /// List all cell formats for a specific sheet in a document.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn get_formats(
        pool: &PgPool,
        document_id: Uuid,
        sheet_index: i32,
    ) -> Result<Vec<CellFormat>> {
        let rows = sqlx::query_as::<_, CellFormat>(
            r#"SELECT * FROM content.cell_formats
               WHERE document_id = $1 AND sheet_index = $2
               ORDER BY cell_ref"#,
        )
        .bind(document_id)
        .bind(sheet_index)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(rows)
    }

    /// Delete a cell format override for a specific cell.
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no format exists for the cell.
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn delete_format(
        pool: &PgPool,
        document_id: Uuid,
        sheet_index: i32,
        cell_ref: &str,
    ) -> Result<()> {
        let result = sqlx::query(
            r#"DELETE FROM content.cell_formats
               WHERE document_id = $1 AND sheet_index = $2 AND cell_ref = $3"#,
        )
        .bind(document_id)
        .bind(sheet_index)
        .bind(cell_ref)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(Error::NotFound(format!(
                "CellFormat {cell_ref} in sheet {sheet_index}"
            )));
        }
        Ok(())
    }

    // ========================================================================
    // Sheet Metadata
    // ========================================================================

    /// Get metadata for a specific sheet.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn get_sheet_metadata(
        pool: &PgPool,
        document_id: Uuid,
        sheet_index: i32,
    ) -> Result<Option<SheetMetadata>> {
        let row = sqlx::query_as::<_, SheetMetadata>(
            r#"SELECT * FROM content.sheet_metadata
               WHERE document_id = $1 AND sheet_index = $2"#,
        )
        .bind(document_id)
        .bind(sheet_index)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(row)
    }

    /// Upsert sheet metadata.
    ///
    /// Creates or updates the metadata for the given (document, sheet) pair.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn upsert_sheet_metadata(
        pool: &PgPool,
        document_id: Uuid,
        sheet_index: i32,
        input: UpsertSheetMetadata,
    ) -> Result<SheetMetadata> {
        let row = sqlx::query_as::<_, SheetMetadata>(
            r#"INSERT INTO content.sheet_metadata
                (document_id, sheet_index, sheet_name, frozen_rows, frozen_cols,
                 col_widths, row_heights, sort_config, filter_config)
               VALUES ($1, $2, COALESCE($3, 'Sheet1'), COALESCE($4, 0), COALESCE($5, 0),
                       COALESCE($6, '{}'), COALESCE($7, '{}'), COALESCE($8, '[]'), COALESCE($9, '[]'))
               ON CONFLICT (document_id, sheet_index) DO UPDATE SET
                sheet_name = COALESCE($3, content.sheet_metadata.sheet_name),
                frozen_rows = COALESCE($4, content.sheet_metadata.frozen_rows),
                frozen_cols = COALESCE($5, content.sheet_metadata.frozen_cols),
                col_widths = COALESCE($6, content.sheet_metadata.col_widths),
                row_heights = COALESCE($7, content.sheet_metadata.row_heights),
                sort_config = COALESCE($8, content.sheet_metadata.sort_config),
                filter_config = COALESCE($9, content.sheet_metadata.filter_config),
                updated_at = NOW()
               RETURNING *"#,
        )
        .bind(document_id)
        .bind(sheet_index)
        .bind(&input.sheet_name)
        .bind(input.frozen_rows)
        .bind(input.frozen_cols)
        .bind(&input.col_widths)
        .bind(&input.row_heights)
        .bind(&input.sort_config)
        .bind(&input.filter_config)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(row)
    }
}
