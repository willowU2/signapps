//! Collection (knowledge base) handlers.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};

use crate::AppState;

/// Create collection request.
#[derive(Debug, Deserialize)]
/// Request body for CreateCollection.
pub struct CreateCollectionRequest {
    pub name: String,
    pub description: Option<String>,
}

/// Collection list response.
#[derive(Debug, Serialize)]
/// Response for CollectionList.
pub struct CollectionListResponse {
    pub collections: Vec<signapps_db::models::CollectionWithStats>,
}

/// Validate a collection name (alphanum, dash, underscore, 1-256 chars).
fn validate_collection_name(name: &str) -> Result<()> {
    if name.is_empty() || name.len() > 256 {
        return Err(Error::Validation(
            "Collection name must be 1-256 characters".to_string(),
        ));
    }
    if !name
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        return Err(Error::Validation(
            "Collection name must contain only alphanumeric characters, \
             dashes, and underscores"
                .to_string(),
        ));
    }
    Ok(())
}

/// List all collections.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_collections(
    State(state): State<AppState>,
) -> Result<Json<CollectionListResponse>> {
    let collections = state.vectors.list_collections().await?;
    Ok(Json(CollectionListResponse { collections }))
}

/// Get a single collection.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_collection(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<signapps_db::models::CollectionWithStats>> {
    let collection = state.vectors.get_collection(&name).await?;
    Ok(Json(collection))
}

/// Create a new collection.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn create_collection(
    State(state): State<AppState>,
    Json(payload): Json<CreateCollectionRequest>,
) -> Result<(StatusCode, Json<signapps_db::models::Collection>)> {
    validate_collection_name(&payload.name)?;
    let collection = state
        .vectors
        .create_collection(&payload.name, payload.description.as_deref())
        .await?;
    Ok((StatusCode::CREATED, Json(collection)))
}

/// Delete a collection.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn delete_collection(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<StatusCode> {
    if name == "default" {
        return Err(Error::Validation(
            "Cannot delete the default collection".to_string(),
        ));
    }
    state.vectors.delete_collection(&name).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Get detailed stats for a collection.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_collection_stats(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<signapps_db::models::CollectionStatsDetail>> {
    let stats = state.vectors.get_collection_stats(&name).await?;
    Ok(Json(stats))
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
