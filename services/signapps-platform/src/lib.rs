//! Library surface of the SignApps Platform single-binary runtime.
//!
//! Exposes the declarative [`services::declare`] function so integration
//! tests can assert the service catalogue (name uniqueness, port uniqueness,
//! expected count) without spawning the binary.

pub mod services;
