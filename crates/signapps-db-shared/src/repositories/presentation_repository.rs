//! PresentationRepository -- CRUD for `content.presentations`,
//! `content.slide_layouts`, and `content.slides`.

use crate::models::presentation::{
    CreatePresentation, CreateSlide, Presentation, Slide, SlideLayout, UpdateSlide,
};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for presentations, slide layouts, and slides.
pub struct PresentationRepository;

impl PresentationRepository {
    // ========================================================================
    // Presentations
    // ========================================================================

    /// Create a new presentation and seed its default layouts.
    ///
    /// Inserts a row into `content.presentations` and then calls
    /// `content.seed_default_layouts()` to populate the standard layout set.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure or constraint violations.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn create_presentation(
        pool: &PgPool,
        tenant_id: Uuid,
        document_id: Uuid,
        input: CreatePresentation,
    ) -> Result<Presentation> {
        let row = sqlx::query_as::<_, Presentation>(
            r#"INSERT INTO content.presentations
                (tenant_id, document_id, title, theme, slide_width, slide_height)
               VALUES ($1, $2, COALESCE($3, 'Untitled Presentation'),
                       COALESCE($4, '{}'), COALESCE($5, 960), COALESCE($6, 540))
               RETURNING *"#,
        )
        .bind(tenant_id)
        .bind(document_id)
        .bind(&input.title)
        .bind(&input.theme)
        .bind(input.slide_width)
        .bind(input.slide_height)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

        // Seed default layouts for the new presentation
        sqlx::query("SELECT content.seed_default_layouts($1)")
            .bind(row.id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(row)
    }

    /// Get a presentation by its associated document ID.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn get_presentation(
        pool: &PgPool,
        document_id: Uuid,
    ) -> Result<Option<Presentation>> {
        let row = sqlx::query_as::<_, Presentation>(
            "SELECT * FROM content.presentations WHERE document_id = $1",
        )
        .bind(document_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(row)
    }

    // ========================================================================
    // Slide Layouts
    // ========================================================================

    /// List all layouts for a presentation, ordered by `sort_order`.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn list_layouts(
        pool: &PgPool,
        presentation_id: Uuid,
    ) -> Result<Vec<SlideLayout>> {
        let rows = sqlx::query_as::<_, SlideLayout>(
            r#"SELECT * FROM content.slide_layouts
               WHERE presentation_id = $1
               ORDER BY sort_order"#,
        )
        .bind(presentation_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(rows)
    }

    // ========================================================================
    // Slides
    // ========================================================================

    /// List all slides for a presentation, ordered by `sort_order`.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn list_slides(
        pool: &PgPool,
        presentation_id: Uuid,
    ) -> Result<Vec<Slide>> {
        let rows = sqlx::query_as::<_, Slide>(
            r#"SELECT * FROM content.slides
               WHERE presentation_id = $1
               ORDER BY sort_order"#,
        )
        .bind(presentation_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(rows)
    }

    /// Get a single slide by ID.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn get_slide(pool: &PgPool, slide_id: Uuid) -> Result<Option<Slide>> {
        let row = sqlx::query_as::<_, Slide>(
            "SELECT * FROM content.slides WHERE id = $1",
        )
        .bind(slide_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(row)
    }

    /// Create a new slide in a presentation.
    ///
    /// If `sort_order` is not provided, the slide is appended at the end
    /// (max existing sort_order + 1).
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure or constraint violations.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn create_slide(
        pool: &PgPool,
        presentation_id: Uuid,
        input: CreateSlide,
    ) -> Result<Slide> {
        let row = sqlx::query_as::<_, Slide>(
            r#"INSERT INTO content.slides
                (presentation_id, layout_id, sort_order, elements, speaker_notes)
               VALUES (
                $1, $2,
                COALESCE($3, (SELECT COALESCE(MAX(sort_order), -1) + 1
                              FROM content.slides WHERE presentation_id = $1)),
                COALESCE($4, '[]'),
                COALESCE($5, '')
               )
               RETURNING *"#,
        )
        .bind(presentation_id)
        .bind(input.layout_id)
        .bind(input.sort_order)
        .bind(&input.elements)
        .bind(&input.speaker_notes)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(row)
    }

    /// Update an existing slide.
    ///
    /// Only provided (non-`None`) fields are updated; others keep their
    /// current values.
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no slide with the given ID exists.
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn update_slide(
        pool: &PgPool,
        slide_id: Uuid,
        input: UpdateSlide,
    ) -> Result<Slide> {
        let row = sqlx::query_as::<_, Slide>(
            r#"UPDATE content.slides SET
                layout_id = COALESCE($2, layout_id),
                sort_order = COALESCE($3, sort_order),
                elements = COALESCE($4, elements),
                speaker_notes = COALESCE($5, speaker_notes),
                transition_type = COALESCE($6, transition_type),
                transition_duration = COALESCE($7, transition_duration),
                is_hidden = COALESCE($8, is_hidden),
                updated_at = NOW()
               WHERE id = $1
               RETURNING *"#,
        )
        .bind(slide_id)
        .bind(input.layout_id)
        .bind(input.sort_order)
        .bind(&input.elements)
        .bind(&input.speaker_notes)
        .bind(&input.transition_type)
        .bind(input.transition_duration)
        .bind(input.is_hidden)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            if e.to_string().contains("no rows") {
                Error::NotFound(format!("Slide {slide_id}"))
            } else {
                Error::Database(e.to_string())
            }
        })?;
        Ok(row)
    }

    /// Delete a slide by ID.
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no slide with the given ID exists.
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn delete_slide(pool: &PgPool, slide_id: Uuid) -> Result<()> {
        let result = sqlx::query("DELETE FROM content.slides WHERE id = $1")
            .bind(slide_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(Error::NotFound(format!("Slide {slide_id}")));
        }
        Ok(())
    }

    /// Reorder slides by applying sort_order from the position in the given ID list.
    ///
    /// Each slide ID in `slide_ids` receives a `sort_order` equal to its
    /// zero-based index in the vector. Slides not in the list keep their
    /// current order.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    ///
    /// # Panics
    ///
    /// No panics possible -- all errors are propagated via `Result`.
    pub async fn reorder_slides(
        pool: &PgPool,
        presentation_id: Uuid,
        slide_ids: Vec<Uuid>,
    ) -> Result<()> {
        for (idx, slide_id) in slide_ids.iter().enumerate() {
            sqlx::query(
                r#"UPDATE content.slides
                   SET sort_order = $1, updated_at = NOW()
                   WHERE id = $2 AND presentation_id = $3"#,
            )
            .bind(idx as i32)
            .bind(slide_id)
            .bind(presentation_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        }
        Ok(())
    }
}
