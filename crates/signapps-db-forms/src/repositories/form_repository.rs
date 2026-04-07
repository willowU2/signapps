use crate::models::{CreateForm, Form, FormResponse, SubmitResponse, UpdateForm};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for form operations.
pub struct FormRepository;

impl FormRepository {
    // ------------------------------------------------------------------------
    // FORMS
    // ------------------------------------------------------------------------

    pub async fn create(pool: &PgPool, owner_id: Uuid, data: CreateForm) -> Result<Form> {
        let created = sqlx::query_as::<_, Form>(
            r#"
            INSERT INTO forms.forms (title, description, owner_id, fields)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(&data.title)
        .bind(&data.description)
        .bind(owner_id)
        .bind(sqlx::types::Json(&data.fields))
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    pub async fn get_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Form>> {
        let form = sqlx::query_as::<_, Form>("SELECT * FROM forms.forms WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(form)
    }

    pub async fn list_by_owner(pool: &PgPool, owner_id: Uuid) -> Result<Vec<Form>> {
        let forms = sqlx::query_as::<_, Form>(
            "SELECT * FROM forms.forms WHERE owner_id = $1 ORDER BY created_at DESC",
        )
        .bind(owner_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(forms)
    }

    pub async fn list_all(pool: &PgPool) -> Result<Vec<Form>> {
        let forms = sqlx::query_as::<_, Form>("SELECT * FROM forms.forms ORDER BY created_at DESC")
            .fetch_all(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(forms)
    }

    pub async fn update(pool: &PgPool, id: Uuid, update: UpdateForm) -> Result<Form> {
        let updated = sqlx::query_as::<_, Form>(
            r#"
            UPDATE forms.forms
            SET title = COALESCE($2, title),
                description = COALESCE($3, description),
                fields = COALESCE($4, fields),
                is_published = COALESCE($5, is_published),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&update.title)
        .bind(&update.description)
        .bind(update.fields.as_ref().map(|f| sqlx::types::Json(f.clone())))
        .bind(update.is_published)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(updated)
    }

    pub async fn publish(pool: &PgPool, id: Uuid) -> Result<Form> {
        let updated = sqlx::query_as::<_, Form>(
            r#"
            UPDATE forms.forms
            SET is_published = TRUE,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(updated)
    }

    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM forms.forms WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    // ------------------------------------------------------------------------
    // RESPONSES
    // ------------------------------------------------------------------------

    pub async fn list_responses(pool: &PgPool, form_id: Uuid) -> Result<Vec<FormResponse>> {
        let responses = sqlx::query_as::<_, FormResponse>(
            "SELECT * FROM forms.form_responses WHERE form_id = $1 ORDER BY submitted_at DESC",
        )
        .bind(form_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(responses)
    }

    pub async fn submit_response(pool: &PgPool, data: SubmitResponse) -> Result<FormResponse> {
        let created = sqlx::query_as::<_, FormResponse>(
            r#"
            INSERT INTO forms.form_responses (form_id, respondent, answers)
            VALUES ($1, $2, $3)
            RETURNING *
            "#,
        )
        .bind(data.form_id)
        .bind(&data.respondent)
        .bind(sqlx::types::Json(&data.answers))
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }
}
