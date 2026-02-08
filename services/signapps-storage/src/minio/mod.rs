//! MinIO/S3 client abstraction.

pub mod client;
pub mod types;

pub use client::MinioClient;
pub use types::*;
