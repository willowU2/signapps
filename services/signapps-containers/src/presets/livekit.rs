//! LiveKit Server preset.
//!
//! LiveKit is the open-source WebRTC SFU that powers the Meet module.
//! The preset below mirrors what `scripts/start-livekit.ps1` spawns and
//! what the deployment docs describe so we have a single source of truth.
//!
//! Ports:
//! - `7880/tcp` — signaling (HTTP/WebSocket)
//! - `7881/tcp` — TCP WebRTC fallback
//! - `50000-60000/udp` — WebRTC media
//!
//! The `LIVEKIT_KEYS` env var MUST use the `key: secret` format (note the
//! space after the colon) — otherwise LiveKit refuses to boot.

use crate::docker::types::{ContainerConfig, PortMapping, RestartPolicy};

/// Default container name used when spawning the LiveKit preset.
pub const CONTAINER_NAME: &str = "signapps-livekit";

/// Docker image tag used by the preset.
pub const IMAGE: &str = "livekit/livekit-server:latest";

/// First UDP port in the WebRTC media range.
pub const UDP_PORT_START: u16 = 50_000;

/// Last UDP port in the WebRTC media range.
pub const UDP_PORT_END: u16 = 60_000;

/// Build the LiveKit [`ContainerConfig`] preset.
///
/// The returned config is ready to be passed to the Docker client. Callers
/// are responsible for supplying a real API key / secret pair — the
/// function refuses empty values to avoid shipping a container that would
/// fail to boot.
///
/// # Examples
///
/// ```ignore
/// use signapps_containers::presets::livekit;
///
/// let cfg = livekit::preset("signapps-meet", "a-32-char-random-secret-value-xx")
///     .expect("valid credentials");
/// assert_eq!(cfg.image, "livekit/livekit-server:latest");
/// ```
///
/// # Errors
///
/// Returns `Err` if `api_key` or `api_secret` is empty.
///
/// # Panics
///
/// Aucun panic possible — toutes les erreurs sont propagées via `Result`.
pub fn preset(api_key: &str, api_secret: &str) -> Result<ContainerConfig, &'static str> {
    if api_key.is_empty() {
        return Err("LiveKit API key must not be empty");
    }
    if api_secret.is_empty() {
        return Err("LiveKit API secret must not be empty");
    }

    // LiveKit expects the exact format "key: secret" (space after colon).
    let livekit_keys = format!("LIVEKIT_KEYS={api_key}: {api_secret}");

    let mut ports: Vec<PortMapping> = Vec::with_capacity(2 + (UDP_PORT_END - UDP_PORT_START + 1) as usize);
    ports.push(PortMapping {
        host: 7880,
        container: 7880,
        protocol: "tcp".to_string(),
        host_ip: None,
    });
    ports.push(PortMapping {
        host: 7881,
        container: 7881,
        protocol: "tcp".to_string(),
        host_ip: None,
    });
    for p in UDP_PORT_START..=UDP_PORT_END {
        ports.push(PortMapping {
            host: p,
            container: p,
            protocol: "udp".to_string(),
            host_ip: None,
        });
    }

    Ok(ContainerConfig {
        name: CONTAINER_NAME.to_string(),
        image: IMAGE.to_string(),
        cmd: None,
        env: Some(vec![livekit_keys]),
        ports: Some(ports),
        volumes: None,
        labels: None,
        restart_policy: Some(RestartPolicy::UnlessStopped),
        resources: None,
        network_mode: None,
        networks: None,
        hostname: None,
        working_dir: None,
        user: None,
        auto_update: Some(true),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preset_rejects_empty_credentials() {
        assert!(preset("", "secret").is_err());
        assert!(preset("key", "").is_err());
    }

    #[test]
    fn preset_builds_valid_config() {
        let cfg = preset("signapps-meet", "a-secret").expect("valid");
        assert_eq!(cfg.name, CONTAINER_NAME);
        assert_eq!(cfg.image, IMAGE);

        let env = cfg.env.expect("env set");
        assert_eq!(env.len(), 1);
        assert_eq!(env[0], "LIVEKIT_KEYS=signapps-meet: a-secret");

        let ports = cfg.ports.expect("ports set");
        // 2 TCP (7880, 7881) + 10001 UDP ports (50000..=60000 inclusive).
        assert_eq!(ports.len(), 2 + 10_001);
        assert!(ports.iter().any(|p| p.host == 7880 && p.protocol == "tcp"));
        assert!(ports.iter().any(|p| p.host == 7881 && p.protocol == "tcp"));
        assert!(ports
            .iter()
            .any(|p| p.host == UDP_PORT_START && p.protocol == "udp"));
        assert!(ports
            .iter()
            .any(|p| p.host == UDP_PORT_END && p.protocol == "udp"));
    }

    #[test]
    fn preset_has_auto_start_flag() {
        let cfg = preset("k", "s").expect("valid");
        assert_eq!(cfg.auto_update, Some(true));
        assert!(matches!(cfg.restart_policy, Some(RestartPolicy::UnlessStopped)));
    }
}
