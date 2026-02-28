---
name: db_migrations
description: How to manage SQLx database migrations in this project
---
# Database Migrations Workflow

1. **Tool**: The project uses `sqlx-cli`.
2. **Creating Migrations**: Use `sqlx migrate add -r <migration_name>` in the root directory to create a new reversible migration file. This will create `.up.sql` and `.down.sql` files in the `migrations/` folder.
3. **Applying Migrations**: The migrations are typically applied automatically on application startup, but you can manually apply them during dev using `sqlx migrate run`.
4. **Writing SQL**: 
   - Write standard PostgreSQL syntax.
   - For `.up.sql`, add `CREATE TABLE`, `ALTER TABLE`, etc.
   - For `.down.sql`, ensure you do the exact reverse operations (`DROP TABLE`, etc.) to rollback cleanly.
5. **Updating compile-time checks**: After modifying queries in Rust code that interact with the database, be sure to use `cargo sqlx prepare` if offline mode is configured, or ensure the dev database is running so `sqlx` macros can verify the queries.
