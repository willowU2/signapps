---
name: rust_db_repository
description: Strictly CRUD Database Repository Pattern for Rust Backend
---
# Strictly CRUD Database Repository Pattern

To ensure 100% cohesion with the frontend UI, every entity repository MUST implement the standard 5 CRUD operations.

1. **Location**: `crates/signapps-db/src/repositories/[entity]_repository.rs`.
2. **Struct**: Define a unit struct: `pub struct [Entity]Repository;`

## Required Methods (The CRUD Standard)
Every repository MUST implement these exactly on the unit struct, accepting `pool: &PgPool` directly.

### 1. Read (List with Pagination)
```rust
pub async fn list(pool: &PgPool, limit: i64, offset: i64) -> Result<Vec<Entity>> { ... }
```
### 2. Read (Single by ID)
```rust
pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Entity>> { ... }
```
### 3. Create
```rust
pub async fn create(pool: &PgPool, payload: CreateEntity) -> Result<Entity> { ... }
```
### 4. Update
```rust
pub async fn update(pool: &PgPool, id: Uuid, payload: UpdateEntity) -> Result<Entity> { ... }
```
### 5. Delete
```rust
pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> { ... }
```

## Error Handling
Return `Result<T, signapps_common::Error>` wrapping `sqlx` errors. 
If an entity is not found during an update or delete, return `Error::NotFound`.
