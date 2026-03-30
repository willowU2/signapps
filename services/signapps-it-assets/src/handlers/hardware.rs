use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use signapps_db::DatabasePool;
use uuid::Uuid;

use crate::models::{CreateHardwareReq, HardwareAsset, UpdateHardwareReq};

#[tracing::instrument(skip_all)]
pub async fn list_hardware(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<HardwareAsset>>, (StatusCode, String)> {
    let assets =
        sqlx::query_as::<_, HardwareAsset>("SELECT * FROM it.hardware ORDER BY created_at DESC")
            .fetch_all(pool.inner())
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(assets))
}

#[tracing::instrument(skip_all)]
pub async fn get_hardware(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<Json<HardwareAsset>, (StatusCode, String)> {
    let asset = sqlx::query_as::<_, HardwareAsset>("SELECT * FROM it.hardware WHERE id = $1")
        .bind(id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Asset not found".to_string()))?;

    Ok(Json(asset))
}

#[tracing::instrument(skip_all)]
pub async fn create_hardware(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreateHardwareReq>,
) -> Result<(StatusCode, Json<HardwareAsset>), (StatusCode, String)> {
    let asset = sqlx::query_as::<_, HardwareAsset>(
        r#"
        INSERT INTO it.hardware (name, type, manufacturer, model, serial_number, purchase_date, warranty_expires, location, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        "#
    )
    .bind(payload.name)
    .bind(payload.asset_type)
    .bind(payload.manufacturer)
    .bind(payload.model)
    .bind(payload.serial_number)
    .bind(payload.purchase_date as Option<chrono::NaiveDate>)
    .bind(payload.warranty_expires as Option<chrono::NaiveDate>)
    .bind(payload.location)
    .bind(payload.notes as Option<String>)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((StatusCode::CREATED, Json(asset)))
}

#[tracing::instrument(skip_all)]
pub async fn update_hardware(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateHardwareReq>,
) -> Result<Json<HardwareAsset>, (StatusCode, String)> {
    // Check exists
    let _ = sqlx::query("SELECT id FROM it.hardware WHERE id = $1")
        .bind(id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Asset not found".to_string()))?;

    let asset = sqlx::query_as::<_, HardwareAsset>(
        r#"
        UPDATE it.hardware SET
            name = COALESCE($1, name),
            status = COALESCE($2, status),
            location = COALESCE($3, location),
            assigned_user_id = COALESCE($4, assigned_user_id),
            notes = COALESCE($5, notes),
            updated_at = NOW()
        WHERE id = $6
        RETURNING *
        "#,
    )
    .bind(payload.name)
    .bind(payload.status)
    .bind(payload.location)
    .bind(payload.assigned_user_id)
    .bind(payload.notes)
    .bind(id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(asset))
}

#[tracing::instrument(skip_all)]
pub async fn delete_hardware(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM it.hardware WHERE id = $1")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Asset not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
