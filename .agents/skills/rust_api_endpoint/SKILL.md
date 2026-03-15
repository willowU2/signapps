---
name: rust_api_endpoint
description: Strictly CRUD Rust Axum API Endpoints Pattern
---
# Strictly CRUD API Endpoints Pattern

To align perfectly with the frontend "Data Table & Sheet" UI, every Axum router for an entity MUST strictly expose the 5 standard CRUD endpoints.

1. **Location**: Add handlers in `services/*/src/handlers/[entity].rs`.

## DTOs Standardization
- **ListQuery**: `limit` and `offset` (Option<i64> defaults to 50/0).
- **Create[Entity]Request**: Used for POST.
- **Update[Entity]Request**: Used for PUT/PATCH.
- **[Entity]Response**: Returned by GET, POST, PUT.

## Required Axum Handlers Map

### 1. GET `/` (List)
```rust
pub async fn list(
    State(pool): State<PgPool>,
    Query(query): Query<ListQuery>
) -> Result<Json<Vec<EntityResponse>>>
```

### 2. GET `/:id` (Read Single)
```rust
pub async fn get_by_id(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>
) -> Result<Json<EntityResponse>>
```

### 3. POST `/` (Create)
```rust
pub async fn create(
    State(pool): State<PgPool>,
    Json(payload): Json<CreateEntityRequest>
) -> Result<Json<EntityResponse>>
```

### 4. PUT `/:id` (Update)
```rust
pub async fn update(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateEntityRequest>
) -> Result<Json<EntityResponse>>
```

### 5. DELETE `/:id` (Delete)
```rust
pub async fn delete(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>
) -> Result<StatusCode>
```

## Security Rule
ALWAYS inject `Extension(claims): Extension<Claims>` if the route requires authentication, and validate RBAC permissions before calling the Repository.
