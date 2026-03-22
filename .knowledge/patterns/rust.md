# Patterns Rust Validés - Base de Connaissances

> Chaque pattern qui fonctionne est un pattern à réutiliser.

---

## Format d'une Entrée

```markdown
### [PAT-RUST-XXX] Titre du Pattern

**Date validation** : YYYY-MM-DD
**Commit source** : `abc123`
**Fichier exemple** : `path/to/file.rs`

**Contexte d'utilisation** :
[Quand utiliser ce pattern]

**Pattern** :
```rust
// Code du pattern
```

**Pourquoi ça marche** :
[Explication technique]

**Anti-pattern à éviter** :
```rust
// Ce qu'il ne faut PAS faire
```

**Tags** : #axum #handler #async
```

---

## Patterns par Catégorie

### Handlers Axum

#### [PAT-RUST-001] Handler CRUD standard

**Date validation** : 2026-03-21
**Commit source** : `3f03644`
**Fichier exemple** : `services/signapps-identity/src/handlers/auth.rs`

**Contexte d'utilisation** :
Tout endpoint HTTP dans un service Axum. Pattern utilise dans les 19 services.

**Pattern** :
```rust
use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result};
use signapps_db::repositories::UserRepository;
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(length(min = 1, message = "Username is required"))]
    pub username: String,
    #[validate(length(min = 1, message = "Password is required"))]
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub access_token: String,
    pub token_type: String,
}

#[tracing::instrument(skip(state, payload), fields(username = %payload.username))]
pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<LoginResponse>> {
    // 1. Validate input
    payload.validate().map_err(|e| Error::Validation(e.to_string()))?;

    // 2. Query database via repository
    let user = UserRepository::find_by_username(&state.pool, &payload.username)
        .await?
        .ok_or(Error::InvalidCredentials)?;

    // 3. Business logic + return
    Ok(Json(LoginResponse { /* ... */ }))
}
```

**Pourquoi ça marche** :
- `State(state)` extrait l'AppState (clone)
- `Json(payload)` deserialise automatiquement le body
- `Result<Json<T>>` retourne 200 avec JSON ou erreur via `Error::into_response()`
- `#[tracing::instrument]` avec `skip` evite de logger les secrets
- `validator::Validate` pour validation declarative

**Anti-pattern à éviter** :
```rust
// NE PAS faire : validation manuelle et unwrap
pub async fn login(body: String) -> String {
    let payload: LoginRequest = serde_json::from_str(&body).unwrap(); // Panic!
    // ...
}
```

**Tags** : #axum #handler #validator #tracing

---

#### [PAT-RUST-002] Router avec couches d'authentification

**Date validation** : 2026-03-21
**Commit source** : `3f03644`
**Fichier exemple** : `services/signapps-identity/src/main.rs`

**Contexte d'utilisation** :
Organisation du router principal d'un service avec separation public/protege/admin.

**Pattern** :
```rust
use axum::{middleware, Router, routing::{get, post, put, delete}};
use signapps_common::middleware::{
    auth_middleware, require_admin, tenant_context_middleware,
    logging_middleware, request_id_middleware,
};
use tower_http::cors::{Any, CorsLayer};

fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Public (no auth)
    let public_routes = Router::new()
        .route("/health", get(handlers::health::health_check))
        .route("/api/v1/auth/login", post(handlers::auth::login));

    // Protected (auth required)
    let protected_routes = Router::new()
        .route("/api/v1/auth/me", get(handlers::auth::me))
        .route("/api/v1/users/me", get(handlers::users::get_me))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Tenant-scoped (auth + tenant context)
    let tenant_routes = Router::new()
        .route("/api/v1/workspaces", get(handlers::tenants::list_workspaces))
        .layer(middleware::from_fn(tenant_context_middleware))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Admin (auth + admin role)
    let admin_routes = Router::new()
        .route("/api/v1/users", get(handlers::users::list))
        .layer(middleware::from_fn(require_admin))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::<AppState>,
        ));

    // Merge all + global middleware
    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .merge(tenant_routes)
        .merge(admin_routes)
        .layer(middleware::from_fn(logging_middleware))
        .layer(middleware::from_fn(request_id_middleware))
        .layer(cors)
        .with_state(state)
}
```

**Pourquoi ça marche** :
- Middleware `.layer()` s'applique en ordre inverse (dernier ajoute = premier execute)
- `from_fn_with_state` donne acces a l'AppState dans le middleware auth
- Separation en 4 blocs (public, protected, tenant, admin) facilite la maintenance
- `.merge()` combine les routers sans conflit
- `.with_state(state)` en dernier transforme `Router<AppState>` en `Router<()>`

**Anti-pattern à éviter** :
```rust
// NE PAS faire : middleware auth sur routes publiques
Router::new()
    .route("/health", get(health))
    .route("/login", post(login))
    .layer(middleware::from_fn(auth_middleware)) // Bloque /health et /login !
```

**Tags** : #axum #router #middleware #cors #auth

---

### Repository Pattern

#### [PAT-RUST-003] Repository struct statique

**Date validation** : 2026-03-21
**Commit source** : `3f03644`
**Fichier exemple** : `crates/signapps-db/src/repositories/user_repository.rs`

**Contexte d'utilisation** :
Tout acces base de donnees dans les services. 22 repositories utilisent ce pattern.

**Pattern** :
```rust
use crate::models::{CreateUser, UpdateUser, User};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

pub struct UserRepository;

impl UserRepository {
    /// Find by ID (retourne Option)
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>("SELECT * FROM identity.users WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(user)
    }

    /// List with pagination
    pub async fn list(pool: &PgPool, limit: i64, offset: i64) -> Result<Vec<User>> {
        let users = sqlx::query_as::<_, User>(
            "SELECT * FROM identity.users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(users)
    }

    /// Create (retourne l'entite creee via RETURNING *)
    pub async fn create(pool: &PgPool, user: CreateUser) -> Result<User> {
        let created = sqlx::query_as::<_, User>(
            r#"INSERT INTO identity.users (username, email, password_hash)
               VALUES ($1, $2, $3) RETURNING *"#,
        )
        .bind(&user.username)
        .bind(&user.email)
        .bind(&user.password_hash)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }
}
```

**Pourquoi ça marche** :
- Struct vide = pas d'etat, methodes statiques avec `&PgPool` en parametre
- `sqlx::query_as::<_, Model>` pour mapping automatique avec `#[derive(sqlx::FromRow)]`
- `fetch_optional` pour find (retourne Option), `fetch_all` pour list, `fetch_one` pour create
- `RETURNING *` PostgreSQL pour recuperer l'entite complete apres INSERT
- Schemas PostgreSQL (ex: `identity.users`) pour l'isolation multi-tenant
- Erreurs mappees vers `Error::Database` de signapps-common

**Anti-pattern à éviter** :
```rust
// NE PAS faire : .unwrap() sur les requetes DB
let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
    .bind(id)
    .fetch_one(pool)
    .await
    .unwrap(); // Panic si row non trouvee !
```

**Tags** : #sqlx #repository #postgres #crud

---

### Error Handling

#### [PAT-RUST-004] Error enum RFC 7807 avec thiserror

**Date validation** : 2026-03-21
**Commit source** : `3f03644`
**Fichier exemple** : `crates/signapps-common/src/error.rs`

**Contexte d'utilisation** :
Gestion d'erreurs unifiee pour tous les services. L'enum `Error` est LE type d'erreur du projet.

**Pattern** :
```rust
use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Invalid credentials")]
    InvalidCredentials,
    #[error("Resource not found: {0}")]
    NotFound(String),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Database error: {0}")]
    Database(String),
    #[error(transparent)]
    Anyhow(#[from] anyhow::Error),
}

impl Error {
    pub fn status_code(&self) -> StatusCode {
        match self {
            Error::InvalidCredentials => StatusCode::UNAUTHORIZED,
            Error::NotFound(_) => StatusCode::NOT_FOUND,
            Error::Validation(_) => StatusCode::BAD_REQUEST,
            Error::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Error::Anyhow(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl IntoResponse for Error {
    fn into_response(self) -> Response {
        let status = self.status_code();
        let body = ProblemDetails::new(status, self.error_code(), self.title())
            .with_detail(self.to_string());
        (status, [("content-type", "application/problem+json")], Json(body)).into_response()
    }
}

// Conversions automatiques
impl From<sqlx::Error> for Error {
    fn from(err: sqlx::Error) -> Self {
        match &err {
            sqlx::Error::RowNotFound => Error::NotFound("Record not found".to_string()),
            sqlx::Error::Database(db_err) => match db_err.code().map(|c| c.as_ref()) {
                Some("23505") => Error::AlreadyExists("Record already exists".to_string()),
                Some("23503") => Error::BadRequest("Foreign key violation".to_string()),
                _ => Error::Database(err.to_string()),
            },
            _ => Error::Database(err.to_string()),
        }
    }
}
```

**Pourquoi ça marche** :
- `thiserror` pour deriver `Display` et `Error` automatiquement
- `IntoResponse` permet a Axum de convertir `Error` en reponse HTTP
- RFC 7807 ProblemDetails donne un format JSON standard aux clients
- `From<sqlx::Error>` mappe les codes PostgreSQL (23505=unique, 23503=FK) en erreurs metier
- `#[from] anyhow::Error` comme catch-all pour les erreurs non-typees
- 27 variantes couvrent tous les cas : auth, LDAP, containers, storage, RAID, AI, etc.

**Anti-pattern à éviter** :
```rust
// NE PAS faire : String generique pour tout
pub async fn handler() -> Result<String, String> {
    // Perd le status code, le format, la traçabilite
}
```

**Tags** : #thiserror #error #rfc7807 #axum #IntoResponse

---

### Service Bootstrap

#### [PAT-RUST-005] Bootstrap unifie avec macro

**Date validation** : 2026-03-21
**Commit source** : `3f03644`
**Fichier exemple** : `crates/signapps-common/src/bootstrap.rs`

**Contexte d'utilisation** :
Initialisation standardisee d'un microservice. Utiliser pour tout nouveau service.

**Pattern** :
```rust
// Methode 1 : Macro bootstrap_service! (rapide)
use signapps_common::bootstrap_service;

bootstrap_service! {
    name: "signapps-myservice",
    port: 3020,
    init: |config, pool| {
        let state = MyAppState { pool, jwt_config: config.jwt_config() };
        create_router(state)
    }
}

// Methode 2 : Manuel (plus de controle)
use signapps_common::bootstrap::{init_tracing, load_env, ServiceConfig, middleware_stack, run_server};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("my_service");
    load_env();
    let config = ServiceConfig::from_env("signapps-myservice", 3020);
    config.log_startup();
    let pool = config.create_pool().await?;
    signapps_db::run_migrations(&pool).await.ok();

    let state = MyAppState { pool, jwt_config: config.jwt_config() };
    let router = middleware_stack(create_router(state));
    run_server(router, &config).await
}
```

**Pourquoi ça marche** :
- `ServiceConfig::from_env` lit DATABASE_URL, JWT_SECRET, SERVER_HOST, SERVER_PORT
- `init_tracing` configure tracing-subscriber avec EnvFilter (RUST_LOG override)
- `middleware_stack` ajoute request_id + logging + CORS
- `run_server` bind TcpListener + axum::serve
- La macro elimine le boilerplate pour les cas simples

**Tags** : #bootstrap #macro #tracing #config

---

### Middleware Auth

#### [PAT-RUST-006] Auth middleware avec AuthState trait

**Date validation** : 2026-03-21
**Commit source** : `3f03644`
**Fichier exemple** : `crates/signapps-common/src/middleware.rs`

**Contexte d'utilisation** :
Tout service qui necessite l'authentification JWT. Le trait `AuthState` doit etre implemente sur l'AppState du service.

**Pattern** :
```rust
// Dans le service : implementer AuthState
use signapps_common::middleware::AuthState;
use signapps_common::JwtConfig;

#[derive(Clone)]
struct AppState {
    pool: PgPool,
    jwt_config: JwtConfig,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

// Dans le router : appliquer le middleware
use signapps_common::middleware::{auth_middleware, tenant_context_middleware};

let protected = Router::new()
    .route("/api/v1/data", get(handler))
    .layer(middleware::from_fn(tenant_context_middleware))  // Apres auth
    .layer(middleware::from_fn_with_state(                  // Auth d'abord
        state.clone(),
        auth_middleware::<AppState>,
    ));

// Dans le handler : extraire les claims
use signapps_common::middleware::{RequestClaimsExt, TenantContext};

pub async fn handler(request: Request) -> Result<Json<Data>> {
    let claims = request.claims_required()?;       // -> &Claims
    let tenant_id = request.tenant_id_required()?; // -> Uuid
    // ...
}
```

**Pourquoi ça marche** :
- `AuthState` trait permet au middleware d'acceder au JwtConfig de n'importe quel AppState
- Le middleware verifie le JWT (header Authorization OU cookie access_token)
- `Claims` et `TenantContext` sont injectes via `request.extensions_mut().insert()`
- `RequestClaimsExt` trait fournit des methodes helper sur `Request<Body>`
- Ordre des layers important : auth en dernier (execute en premier)

**Tags** : #middleware #auth #jwt #tenant #rbac

---

### SQLx Mutations

#### [PAT-RUST-007] Mutations sqlx::query! avec rows_affected

**Date validation** : 2026-03-22
**Commit source** : `pending`
**Fichier exemple** : `crates/signapps-db/src/repositories/storage_tier2_repository.rs`

**Contexte d'utilisation** :
Toute mutation SQL (DELETE, UPDATE sans RETURNING) utilisant `sqlx::query!` où l'on veut
acceder au nombre de lignes affectees via `.rows_affected()`.

**Pattern** :
```rust
use signapps_common::PgQueryResult;
use sqlx::PgPool;
use uuid::Uuid;

pub async fn delete_item(pool: &PgPool, id: Uuid, user_id: Uuid) -> Result<u64, sqlx::Error> {
    let result: PgQueryResult = sqlx::query!(
        r#"
        DELETE FROM schema.table
        WHERE id = $1 AND user_id = $2
        "#,
        id,
        user_id
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

// Variante : booleen (l'entite existait-elle ?)
pub async fn exists_and_delete(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result: PgQueryResult = sqlx::query!(
        "DELETE FROM schema.table WHERE id = $1",
        id
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}
```

**Pourquoi ça marche** :
- `sqlx::query!` retourne un type opaque ; sans annotation, rustc emet E0282 "type annotations needed"
- `PgQueryResult` est le type concret retourne par `.execute()` sur PostgreSQL
- L'alias `signapps_common::PgQueryResult` (= `sqlx::postgres::PgQueryResult`) evite le path verbeux
- Ne pas confondre avec `sqlx::query_as!` (retourne des structs) ou `sqlx::query!(...).fetch_*` (rows)

**Anti-pattern à éviter** :
```rust
// NE PAS faire : type non annote avec sqlx::query!
let result = sqlx::query!("DELETE FROM table WHERE id = $1", id)
    .execute(pool)
    .await?;
// -> error[E0282]: type annotations needed, type must be known at this point

// NE PAS faire : path verbeux sqlx::postgres::PgQueryResult
let result: sqlx::postgres::PgQueryResult = sqlx::query!(...).execute(pool).await?;
// -> utiliser signapps_common::PgQueryResult a la place
```

**Tags** : #sqlx #query #delete #update #rows_affected #type-inference

---

### Testing Patterns

*Aucun pattern enregistré. A enrichir lors des prochaines sessions de tests.*

---

## Patterns les Plus Utilisés

| Pattern | Utilisations | Dernière |
|---------|--------------|----------|
| Handler CRUD standard (PAT-RUST-001) | 19 services | 2026-03-21 |
| Router avec auth layers (PAT-RUST-002) | 19 services | 2026-03-21 |
| Repository struct statique (PAT-RUST-003) | 22 repositories | 2026-03-21 |
| Error RFC 7807 (PAT-RUST-004) | Tous les fichiers | 2026-03-21 |
| Bootstrap service (PAT-RUST-005) | 19 services | 2026-03-21 |
| Auth middleware trait (PAT-RUST-006) | 19 services | 2026-03-21 |
| SQLx mutation rows_affected (PAT-RUST-007) | signapps-common/PgQueryResult | 2026-03-22 |

---

## Statistiques

| Métrique | Valeur |
|----------|--------|
| Total patterns | 7 |
| Patterns handler | 2 |
| Patterns repository | 2 |
| Patterns error | 1 |
| Patterns bootstrap | 1 |
| Patterns middleware | 1 |

---

*Ce fichier est enrichi automatiquement via l'analyse des `git log` après chaque commit réussi.*
