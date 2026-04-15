//! Docker API abstraction — supports local (unix socket / named pipe) and
//! remote (SSH shell-out) hosts.
//!
//! The legacy `DockerClient` is re-exported as `LocalDockerHost` for backward
//! compatibility with Phase 1-4 callers.

pub mod host;
pub mod local;
pub mod remote;

pub use host::DockerHost;
pub use local::DockerClient;
pub use local::LocalDockerHost;
