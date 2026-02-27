use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use postgres_types::ToSql;
use signapps_db::DbPool;
use uuid::Uuid;

use crate::models::{CreateHardwareReq, HardwareAsset, UpdateHardwareReq};

pub async fn list_hardware(
    State(pool): State<DbPool>,
) -> Result<Json<Vec<HardwareAsset>>, (StatusCode, String)> {
    let assets = sqlx::query_as!(
        HardwareAsset,
        "SELECT * FROM it.hardware ORDER BY created_at DESC"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(assets))
}

pub async fn get_hardware(
    State(pool): State<DbPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<HardwareAsset>, (StatusCode, String)> {
    let asset = sqlx::query_as!(HardwareAsset, "SELECT * FROM it.hardware WHERE id = $1", id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Asset not found".to_string()))?;

    Ok(Json(asset))
}

pub async fn create_hardware(
    State(pool): State<DbPool>,
    Json(payload): Json<CreateHardwareReq>,
) -> Result<(StatusCode, Json<HardwareAsset>), (StatusCode, String)> {
    let asset = sqlx::query_as!(
        HardwareAsset,
        r#"
        INSERT INTO it.hardware (name, type, manufacturer, model, serial_number, purchase_date, warranty_expires, location, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        "#,
        payload.name,
        payload.asset_type,
        payload.manufacturer,
        payload.model,
        payload.serial_number,
        payload.purchase_date as Option<chrono::NaiveDate>,
        payload.warranty_expires as Option<chrono::NaiveDate>,
        payload.location,
        payload.notes as Option<String>
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((StatusCode::CREATED, Json(asset)))
}
