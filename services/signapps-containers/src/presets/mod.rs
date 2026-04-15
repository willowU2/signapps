//! Predefined container presets for first-party SignApps services.
//!
//! A preset is a ready-to-use [`ContainerConfig`] blueprint for a container
//! that the platform itself operates (e.g. LiveKit for the Meet module). The
//! intent is to keep a single source of truth for these containers rather
//! than duplicating their wiring across scripts, runtime helpers and
//! documentation.
//!
//! Presets are plain data — callers are free to feed them to the existing
//! Docker client to create/start the container.

// Presets are introduced ahead of the wiring in the Meet module; silence
// dead-code warnings until the first caller lands.
#[allow(dead_code)]
pub mod livekit;
