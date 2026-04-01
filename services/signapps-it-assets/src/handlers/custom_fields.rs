// CF1-CF3: Custom field definitions and values per device
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use signapps_db::DatabasePool;
use uuid::Uuid;

fn internal_err(e: impl std::fmt::Display) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}

// ─── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct CustomFieldDef {
    pub id: Uuid,
    pub name: String,
    pub field_type: String,
    pub options: Value,
    pub required: bool,
    pub sort_order: i32,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateFieldDefReq {
    pub name: String,
    pub field_type: Option<String>,
    pub options: Option<Value>,
    pub required: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateFieldDefReq {
    pub name: Option<String>,
    pub field_type: Option<String>,
    pub options: Option<Value>,
    pub required: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow, utoipa::ToSchema)]
#[allow(dead_code)]
pub struct CustomFieldValue {
    pub id: Uuid,
    pub definition_id: Uuid,
    pub hardware_id: Uuid,
    pub value: Option<String>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct HardwareCustomFields {
    pub definition: CustomFieldDef,
    pub value: Option<String>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct SetFieldValueReq {
    pub value: Option<String>,
}

// ─── CF1: Definition CRUD ────────────────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/custom-fields/definitions",
    responses(
        (status = 200, description = "Custom field definitions list", body = Vec<CustomFieldDef>),
    ),
    security(("bearer" = [])),
    tag = "CustomFields"
)]
#[tracing::instrument(skip_all)]
pub async fn list_field_defs(
    State(pool): State<DatabasePool>,
) -> Result<Json<Vec<CustomFieldDef>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, CustomFieldDef>(
        "SELECT id, name, field_type, options, required, sort_order FROM it.custom_field_definitions ORDER BY sort_order, name",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

#[utoipa::path(
    post,
    path = "/api/v1/it-assets/custom-fields/definitions",
    request_body = CreateFieldDefReq,
    responses(
        (status = 201, description = "Field definition created", body = CustomFieldDef),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "CustomFields"
)]
#[tracing::instrument(skip_all)]
pub async fn create_field_def(
    State(pool): State<DatabasePool>,
    Json(payload): Json<CreateFieldDefReq>,
) -> Result<(StatusCode, Json<CustomFieldDef>), (StatusCode, String)> {
    let row = sqlx::query_as::<_, CustomFieldDef>(
        r#"
        INSERT INTO it.custom_field_definitions (name, field_type, options, required, sort_order)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, field_type, options, required, sort_order
        "#,
    )
    .bind(&payload.name)
    .bind(payload.field_type.as_deref().unwrap_or("text"))
    .bind(payload.options.unwrap_or(Value::Array(vec![])))
    .bind(payload.required.unwrap_or(false))
    .bind(payload.sort_order.unwrap_or(0))
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok((StatusCode::CREATED, Json(row)))
}

#[utoipa::path(
    put,
    path = "/api/v1/it-assets/custom-fields/definitions/{id}",
    params(("id" = uuid::Uuid, Path, description = "Field definition UUID")),
    request_body = UpdateFieldDefReq,
    responses(
        (status = 200, description = "Field definition updated", body = CustomFieldDef),
        (status = 404, description = "Field definition not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "CustomFields"
)]
#[tracing::instrument(skip_all)]
pub async fn update_field_def(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateFieldDefReq>,
) -> Result<Json<CustomFieldDef>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, CustomFieldDef>(
        r#"
        UPDATE it.custom_field_definitions
        SET name       = COALESCE($2, name),
            field_type = COALESCE($3, field_type),
            options    = COALESCE($4, options),
            required   = COALESCE($5, required),
            sort_order = COALESCE($6, sort_order)
        WHERE id = $1
        RETURNING id, name, field_type, options, required, sort_order
        "#,
    )
    .bind(id)
    .bind(&payload.name)
    .bind(&payload.field_type)
    .bind(&payload.options)
    .bind(payload.required)
    .bind(payload.sort_order)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((
        StatusCode::NOT_FOUND,
        "Field definition not found".to_string(),
    ))?;
    Ok(Json(row))
}

#[utoipa::path(
    delete,
    path = "/api/v1/it-assets/custom-fields/definitions/{id}",
    params(("id" = uuid::Uuid, Path, description = "Field definition UUID")),
    responses(
        (status = 204, description = "Field definition deleted"),
        (status = 404, description = "Field definition not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "CustomFields"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_field_def(
    State(pool): State<DatabasePool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM it.custom_field_definitions WHERE id = $1")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            "Field definition not found".to_string(),
        ));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ─── CF2: Values per hardware ────────────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/it-assets/hardware/{hardware_id}/custom-fields",
    params(("hardware_id" = uuid::Uuid, Path, description = "Hardware UUID")),
    responses(
        (status = 200, description = "Hardware custom fields", body = Vec<HardwareCustomFields>),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "CustomFields"
)]
#[tracing::instrument(skip_all)]
pub async fn get_hardware_fields(
    State(pool): State<DatabasePool>,
    Path(hardware_id): Path<Uuid>,
) -> Result<Json<Vec<HardwareCustomFields>>, (StatusCode, String)> {
    // Return all definitions with their values for the given hardware
    let defs = sqlx::query_as::<_, CustomFieldDef>(
        "SELECT id, name, field_type, options, required, sort_order FROM it.custom_field_definitions ORDER BY sort_order, name",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    let mut result = Vec::new();
    for def in defs {
        let val: Option<String> = sqlx::query_scalar(
            "SELECT value FROM it.custom_field_values WHERE definition_id = $1 AND hardware_id = $2",
        )
        .bind(def.id)
        .bind(hardware_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(internal_err)?
        .flatten();

        result.push(HardwareCustomFields {
            definition: def,
            value: val,
        });
    }
    Ok(Json(result))
}

#[utoipa::path(
    put,
    path = "/api/v1/it-assets/hardware/{hardware_id}/custom-fields/{definition_id}",
    params(
        ("hardware_id" = uuid::Uuid, Path, description = "Hardware UUID"),
        ("definition_id" = uuid::Uuid, Path, description = "Field definition UUID"),
    ),
    request_body = SetFieldValueReq,
    responses(
        (status = 204, description = "Field value set"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "CustomFields"
)]
#[tracing::instrument(skip_all)]
pub async fn set_field_value(
    State(pool): State<DatabasePool>,
    Path((hardware_id, definition_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<SetFieldValueReq>,
) -> Result<StatusCode, (StatusCode, String)> {
    sqlx::query(
        r#"
        INSERT INTO it.custom_field_values (definition_id, hardware_id, value)
        VALUES ($1, $2, $3)
        ON CONFLICT (definition_id, hardware_id)
        DO UPDATE SET value = EXCLUDED.value
        "#,
    )
    .bind(definition_id)
    .bind(hardware_id)
    .bind(&payload.value)
    .execute(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
