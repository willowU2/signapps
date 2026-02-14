//! Runtime manager for SignApps Platform.
//!
//! Manages the lifecycle of PostgreSQL:
//! 1. If `DATABASE_URL` is set, use it directly
//! 2. Otherwise, detect native PostgreSQL installation
//! 3. If absent, use `postgresql_embedded` as a fallback

mod postgres;

pub use postgres::RuntimeManager;
