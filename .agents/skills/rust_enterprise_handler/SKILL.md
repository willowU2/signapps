---
name: rust_enterprise_handler
description: Template complet pour créer un handler Rust conforme aux standards enterprise (tracing, utoipa, AppError, tests)
---
# Rust Enterprise Handler Skill

Template pour créer un handler Axum conforme à TOUTES les directives enterprise en une seule passe.

## Quand Utiliser

- Création d'un nouveau handler REST
- Ajout d'un endpoint à un service existant
- Refactoring d'un handler legacy vers les standards enterprise

## Template Complet

Chaque handler DOIT suivre ce template. Pas d'exceptions.

### 1. Le fichier handler (`handlers/<entity>.rs`)

```rust
//! Handlers pour la gestion des [Entity].
//!
//! Endpoints REST CRUD avec documentation OpenAPI intégrée.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tracing::instrument;
use uuid::Uuid;

use signapps_common::{AppError, Claims};
use signapps_db::repositories::EntityRepository;

// ─────────────────────────── DTOs ───────────────────────────

/// Paramètres de requête pour la pagination.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListQuery {
    /// Nombre maximum de résultats (défaut: 50)
    #[param(default = 50)]
    pub limit: Option<i64>,
    /// Offset pour la pagination (défaut: 0)
    #[param(default = 0)]
    pub offset: Option<i64>,
}

/// Corps de requête pour la création.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateEntityRequest {
    /// Nom de l'entité
    pub name: String,
}

/// Corps de requête pour la mise à jour.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateEntityRequest {
    /// Nouveau nom (optionnel)
    pub name: Option<String>,
}

/// Réponse contenant l'entité.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct EntityResponse {
    /// Identifiant unique
    pub id: Uuid,
    /// Nom de l'entité
    pub name: String,
    /// Date de création (ISO 8601)
    pub created_at: String,
}

// ─────────────────────────── Handlers ───────────────────────

/// Liste toutes les entités avec pagination.
#[utoipa::path(
    get,
    path = "/api/v1/entities",
    params(ListQuery),
    responses(
        (status = 200, description = "Liste des entités", body = Vec<EntityResponse>),
        (status = 401, description = "Non authentifié"),
    ),
    security(("bearer" = [])),
    tag = "Entities"
)]
#[instrument(skip(pool, _claims), fields(user_id = %_claims.sub))]
pub async fn list(
    State(pool): State<PgPool>,
    _claims: Claims,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<EntityResponse>>, AppError> {
    let limit = query.limit.unwrap_or(50);
    let offset = query.offset.unwrap_or(0);

    let entities = EntityRepository::list(&pool, limit, offset)
        .await
        .map_err(|e| AppError::internal(format!("Failed to list entities: {e}")))?;

    let response: Vec<EntityResponse> = entities.into_iter().map(Into::into).collect();
    Ok(Json(response))
}

/// Récupère une entité par son ID.
#[utoipa::path(
    get,
    path = "/api/v1/entities/{id}",
    params(("id" = Uuid, Path, description = "ID de l'entité")),
    responses(
        (status = 200, description = "Entité trouvée", body = EntityResponse),
        (status = 404, description = "Entité non trouvée"),
        (status = 401, description = "Non authentifié"),
    ),
    security(("bearer" = [])),
    tag = "Entities"
)]
#[instrument(skip(pool, _claims), fields(user_id = %_claims.sub, entity_id = %id))]
pub async fn get_by_id(
    State(pool): State<PgPool>,
    _claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<Json<EntityResponse>, AppError> {
    let entity = EntityRepository::get_by_id(&pool, id)
        .await
        .map_err(|e| AppError::internal(format!("DB error: {e}")))?
        .ok_or_else(|| AppError::not_found("Entity not found"))?;

    Ok(Json(entity.into()))
}

/// Crée une nouvelle entité.
#[utoipa::path(
    post,
    path = "/api/v1/entities",
    request_body = CreateEntityRequest,
    responses(
        (status = 201, description = "Entité créée", body = EntityResponse),
        (status = 400, description = "Données invalides", body = AppError),
        (status = 401, description = "Non authentifié"),
    ),
    security(("bearer" = [])),
    tag = "Entities"
)]
#[instrument(skip(pool, claims, input), fields(user_id = %claims.sub))]
pub async fn create(
    State(pool): State<PgPool>,
    claims: Claims,
    Json(input): Json<CreateEntityRequest>,
) -> Result<(StatusCode, Json<EntityResponse>), AppError> {
    let entity = EntityRepository::create(&pool, claims.sub, &input)
        .await
        .map_err(|e| AppError::internal(format!("Failed to create entity: {e}")))?;

    Ok((StatusCode::CREATED, Json(entity.into())))
}

/// Met à jour une entité existante.
#[utoipa::path(
    put,
    path = "/api/v1/entities/{id}",
    params(("id" = Uuid, Path, description = "ID de l'entité")),
    request_body = UpdateEntityRequest,
    responses(
        (status = 200, description = "Entité mise à jour", body = EntityResponse),
        (status = 404, description = "Entité non trouvée"),
        (status = 401, description = "Non authentifié"),
    ),
    security(("bearer" = [])),
    tag = "Entities"
)]
#[instrument(skip(pool, _claims, input), fields(user_id = %_claims.sub, entity_id = %id))]
pub async fn update(
    State(pool): State<PgPool>,
    _claims: Claims,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateEntityRequest>,
) -> Result<Json<EntityResponse>, AppError> {
    let entity = EntityRepository::update(&pool, id, &input)
        .await
        .map_err(|e| AppError::internal(format!("Failed to update entity: {e}")))?;

    Ok(Json(entity.into()))
}

/// Supprime une entité.
#[utoipa::path(
    delete,
    path = "/api/v1/entities/{id}",
    params(("id" = Uuid, Path, description = "ID de l'entité")),
    responses(
        (status = 204, description = "Entité supprimée"),
        (status = 404, description = "Entité non trouvée"),
        (status = 401, description = "Non authentifié"),
    ),
    security(("bearer" = [])),
    tag = "Entities"
)]
#[instrument(skip(pool, _claims), fields(user_id = %_claims.sub, entity_id = %id))]
pub async fn delete(
    State(pool): State<PgPool>,
    _claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    EntityRepository::delete(&pool, id)
        .await
        .map_err(|e| AppError::internal(format!("Failed to delete entity: {e}")))?;

    Ok(StatusCode::NO_CONTENT)
}

// ─────────────────────────── Tests ──────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_list_query_defaults() {
        let query = ListQuery { limit: None, offset: None };
        assert_eq!(query.limit.unwrap_or(50), 50);
        assert_eq!(query.offset.unwrap_or(0), 0);
    }
}
```

### 2. Enregistrement des routes (`main.rs`)

```rust
use handlers::entities;

// Dans le router :
.route("/api/v1/entities", get(entities::list).post(entities::create))
.route("/api/v1/entities/:id", get(entities::get_by_id).put(entities::update).delete(entities::delete))
```

### 3. Module declaration (`handlers/mod.rs`)

```rust
pub mod entities;
```

## Checklist du Handler Enterprise

- [ ] `#[instrument(skip(pool, claims))]` sur CHAQUE fn publique
- [ ] `#[utoipa::path(...)]` sur CHAQUE endpoint
- [ ] Tous les DTOs dérivent `utoipa::ToSchema` ou `utoipa::IntoParams`
- [ ] `///` rustdoc sur chaque struct, enum, et champ public
- [ ] Retourne `Result<_, AppError>` — jamais de `.unwrap()`
- [ ] `.map_err()` avec message contextuel sur chaque `.await`
- [ ] `#[cfg(test)] mod tests` avec au moins un test
- [ ] Route enregistrée dans `main.rs`
- [ ] `pub mod` dans `handlers/mod.rs`

## Anti-Patterns à Éviter

```rust
// ❌ Handler sans instrument
pub async fn list(pool: State<PgPool>) -> Json<Vec<Entity>> { ... }

// ❌ unwrap dans un handler
let entity = repo.get(id).await.unwrap();

// ❌ Pas de utoipa
pub async fn create(Json(input): Json<CreateInput>) -> ... { ... }

// ❌ String pour les erreurs au lieu d'AppError
pub async fn get() -> Result<Json<Entity>, String> { ... }

// ❌ Pas de skip sur les champs sensibles
#[instrument] // Va logger le pool et le token JWT !
pub async fn handler(pool: State<PgPool>, claims: Claims) -> ... { ... }
```

## Liens

- CLAUDE.md : "Gouvernance et Qualité" + "Structure pour nouvelle fonctionnalité"
- Skills liés : `enterprise_code_review`, `observability_tracing`, `rust_api_endpoint`
- Dépendances : `utoipa`, `tracing`, `signapps-common::AppError`
