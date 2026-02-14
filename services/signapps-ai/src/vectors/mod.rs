//! Vector database service using pgvector (PostgreSQL).

pub mod client;
pub mod types;

pub use client::VectorService;
pub use types::*;
