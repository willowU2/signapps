// Enforce documentation on all public items (only during `cargo doc`, not clippy)
#![cfg_attr(doc, warn(missing_docs))]

//! # SignApps DB AI
//!
//! AI domain database models and repositories for the SignApps Platform.
//!
//! Contains models and repositories for:
//! - Conversations and messages (chat history)
//! - Document vectors (384-dim pgvector embeddings)
//! - Multimodal vectors (1024-dim SigLIP embeddings)
//! - Generated media (AI-produced images, audio, video)
//! - Knowledge graph entities, relations, communities (LightRAG)
//!
//! This is Phase 5 of the `signapps-db` bounded-context split.
//! See `docs/architecture/refactors/01-split-signapps-db.md`.

pub mod models;
pub mod repositories;

pub use models::conversation::*;
pub use models::document_vector::*;
pub use models::generated_media::*;
pub use models::kg::*;
pub use models::multimodal_vector::*;

pub use repositories::{
    ChunkInput, ConversationRepository, GeneratedMediaRepository, KgRepository,
    MultimodalVectorRepository, VectorRepository,
};
