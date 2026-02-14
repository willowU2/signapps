//! Runtime manager for SignApps Platform.
//!
//! Manages the lifecycle of PostgreSQL:
//! 1. If `DATABASE_URL` is set, use it directly
//! 2. Otherwise, detect native PostgreSQL installation
//! 3. If absent, use `postgresql_embedded` as a fallback
//!
//! Also provides hardware detection and AI model management.

mod postgres;
pub mod gpu;
pub mod models;

pub use gpu::{GpuInfo, GpuVendor, HardwareProfile, InferenceBackend, ModelTier};
pub use models::{ModelEntry, ModelError, ModelManager, ModelSource, ModelStatus, ModelType};
pub use postgres::RuntimeManager;
