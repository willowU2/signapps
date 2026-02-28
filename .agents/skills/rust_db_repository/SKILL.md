---
name: rust_db_repository
description: How to implement a database repository in Rust
---
# Database Repository Pattern

1. **Location**: `crates/signapps-db/src/repositories/[entity]_repository.rs`.
2. **Struct**: Define a unit struct: `pub struct EntityRepository;`
3. **Methods**: Implemented on the unit struct, accepting `pool: &PgPool` directly.
   ```rust
   impl EntityRepository {
       pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Entity>> {
           // sqlx logic here
       }
       pub async fn create(pool: &PgPool, payload: CreateEntity) -> Result<Entity> {
           // sqlx logic here
       }
   }
   ```
4. **Naming conventions**: `find_*`, `list_*` (for pagination use `limit` and `offset`), `create_*`, `update_*`, `delete_*`.
5. **Error Handling**: Return `Result<T, Error>` wrapping `sqlx` errors mapped to `signapps_common::Error`.
