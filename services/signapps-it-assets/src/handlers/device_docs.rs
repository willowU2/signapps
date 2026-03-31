// #11 Per-device documentation
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_db::DatabasePool;
use uuid::Uuid;

fn internal_err(e: impl std::fmt::Display) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DeviceDoc {
    pub id: Uuid,
    pub hardware_id: Uuid,
    pub title: String,
    pub content: Option<String>,
    pub doc_type: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDocReq {
    pub title: String,
    pub content: Option<String>,
    pub doc_type: Option<String>,
    pub created_by: Option<Uuid>,
}

/// GET /api/v1/it-assets/hardware/:hw_id/docs
#[tracing::instrument(skip_all)]
pub async fn list_device_docs(
    State(pool): State<DatabasePool>,
    Path(hw_id): Path<Uuid>,
) -> Result<Json<Vec<DeviceDoc>>, (StatusCode, String)> {
    let docs = sqlx::query_as::<_, DeviceDoc>(
        r#"SELECT id, hardware_id, title, content, doc_type, created_by, created_at, updated_at
           FROM it.device_documentation WHERE hardware_id = $1 ORDER BY created_at DESC"#,
    )
    .bind(hw_id)
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok(Json(docs))
}

/// POST /api/v1/it-assets/hardware/:hw_id/docs
#[tracing::instrument(skip_all)]
pub async fn create_device_doc(
    State(pool): State<DatabasePool>,
    Path(hw_id): Path<Uuid>,
    Json(payload): Json<CreateDocReq>,
) -> Result<(StatusCode, Json<DeviceDoc>), (StatusCode, String)> {
    if payload.title.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Title cannot be empty".to_string()));
    }

    let doc = sqlx::query_as::<_, DeviceDoc>(
        r#"INSERT INTO it.device_documentation (hardware_id, title, content, doc_type, created_by)
           VALUES ($1,$2,$3,$4,$5)
           RETURNING id, hardware_id, title, content, doc_type, created_by, created_at, updated_at"#,
    )
    .bind(hw_id)
    .bind(&payload.title)
    .bind(&payload.content)
    .bind(payload.doc_type.as_deref().unwrap_or("note"))
    .bind(payload.created_by)
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok((StatusCode::CREATED, Json(doc)))
}
