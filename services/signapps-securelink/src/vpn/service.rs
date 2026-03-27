#![allow(dead_code)]
//! VPN mesh service management.

use crate::vpn::crypto::CryptoService;
use signapps_common::{Error, Result};
use signapps_db::models::{
    Device, FirewallConfig, FirewallRule, LighthouseConfig, ListenConfig, MeshConfig, PkiConfig,
    PunchyConfig,
};
use signapps_db::repositories::DeviceRepository;
use signapps_db::DatabasePool;
use std::collections::HashMap;
use tokio::fs;
use uuid::Uuid;

/// VPN mesh service for managing the overlay network.
#[derive(Clone)]
pub struct VpnService {
    pool: DatabasePool,
    crypto: CryptoService,
    config_path: String,
    network_prefix: String,
}

impl VpnService {
    /// Create a new VPN service.
    pub fn new(
        pool: DatabasePool,
        crypto: CryptoService,
        config_path: &str,
        network_prefix: &str,
    ) -> Self {
        Self {
            pool,
            crypto,
            config_path: config_path.to_string(),
            network_prefix: network_prefix.to_string(),
        }
    }

    /// Initialize the VPN CA.
    pub async fn init_ca(&self, name: &str) -> Result<()> {
        self.crypto.init_ca(name).await
    }

    /// Get the CA certificate.
    pub async fn get_ca_certificate(&self) -> Result<String> {
        self.crypto.get_ca_certificate().await
    }

    /// Enroll a new device into the mesh network.
    pub async fn enroll_device(
        &self,
        name: &str,
        nickname: Option<&str>,
        is_lighthouse: bool,
        is_relay: bool,
    ) -> Result<DeviceEnrollment> {
        let repo = DeviceRepository::new(&self.pool);

        // Check if device already exists
        if repo.find_by_name(name).await?.is_some() {
            return Err(Error::Validation(format!(
                "Device '{}' already exists",
                name
            )));
        }

        // Get next available IP
        let ip_address = repo.get_next_ip(&self.network_prefix).await?;

        // Generate certificate
        let certificate = self
            .crypto
            .sign_certificate(name, &ip_address, is_lighthouse)
            .await?;

        // Create device in database
        let create_device = signapps_db::models::CreateDevice {
            name: name.to_string(),
            nickname: nickname.map(|s| s.to_string()),
            is_lighthouse,
            is_relay,
        };

        let device = repo
            .create(&create_device, &certificate.public_key, &ip_address)
            .await?;

        // Generate mesh config for the device
        let config = self.generate_device_config(&device).await?;

        Ok(DeviceEnrollment {
            device,
            certificate: DeviceCertificate {
                ca: certificate.ca,
                cert: certificate.cert,
                key: certificate.key,
            },
            config,
        })
    }

    /// Generate mesh configuration for a device.
    pub async fn generate_device_config(&self, device: &Device) -> Result<MeshConfig> {
        let repo = DeviceRepository::new(&self.pool);

        // Get all lighthouses
        let lighthouses = repo.list_lighthouses().await?;

        // Build static host map (lighthouse mesh-IP -> public endpoint).
        //
        // The public address is resolved from the environment variable
        // `LIGHTHOUSE_PUBLIC_ADDR_<NAME>` (upper-cased device name, hyphens
        // replaced by underscores), e.g. `LIGHTHOUSE_PUBLIC_ADDR_LH1`.
        // Fallback: use the mesh IP on port 4242 (valid for LAN-only deployments).
        let mut static_host_map = HashMap::new();
        for lh in &lighthouses {
            if lh.id != device.id {
                let env_key = format!(
                    "LIGHTHOUSE_PUBLIC_ADDR_{}",
                    lh.name.to_uppercase().replace('-', "_")
                );
                let public_endpoint =
                    std::env::var(&env_key).unwrap_or_else(|_| format!("{}:4242", lh.ip_address));
                static_host_map.insert(lh.ip_address.clone(), vec![public_endpoint]);
            }
        }

        // Lighthouse config
        let lighthouse_config = if device.is_lighthouse {
            LighthouseConfig {
                am_lighthouse: true,
                serve_dns: true,
                dns: Some(signapps_db::models::DnsConfig {
                    host: "0.0.0.0".to_string(),
                    port: 53,
                }),
                interval: 60,
                hosts: vec![],
            }
        } else {
            LighthouseConfig {
                am_lighthouse: false,
                serve_dns: false,
                dns: None,
                interval: 60,
                hosts: lighthouses.iter().map(|lh| lh.ip_address.clone()).collect(),
            }
        };

        // Listen config
        let listen_config = ListenConfig {
            host: "0.0.0.0".to_string(),
            port: 4242,
        };

        // Punchy config for NAT traversal
        let punchy_config = PunchyConfig {
            punch: true,
            respond: true,
            delay: Some("1s".to_string()),
        };

        // Firewall rules
        let firewall_config = FirewallConfig {
            conntrack: signapps_db::models::ConntrackConfig {
                tcp_timeout: "12m".to_string(),
                udp_timeout: "3m".to_string(),
                default_timeout: "10m".to_string(),
            },
            outbound: vec![FirewallRule {
                port: "any".to_string(),
                proto: "any".to_string(),
                host: "any".to_string(),
                groups: None,
            }],
            inbound: vec![
                FirewallRule {
                    port: "any".to_string(),
                    proto: "icmp".to_string(),
                    host: "any".to_string(),
                    groups: None,
                },
                FirewallRule {
                    port: "22".to_string(),
                    proto: "tcp".to_string(),
                    host: "any".to_string(),
                    groups: None,
                },
            ],
        };

        Ok(MeshConfig {
            pki: PkiConfig {
                ca: format!("{}/ca.crt", self.config_path),
                cert: format!("{}/devices/{}.crt", self.config_path, device.name),
                key: format!("{}/devices/{}.key", self.config_path, device.name),
            },
            static_host_map,
            lighthouse: lighthouse_config,
            listen: listen_config,
            punchy: punchy_config,
            firewall: firewall_config,
        })
    }

    /// Get device by ID.
    pub async fn get_device(&self, id: Uuid) -> Result<Option<Device>> {
        let repo = DeviceRepository::new(&self.pool);
        repo.find(id).await
    }

    /// Get device by name.
    pub async fn get_device_by_name(&self, name: &str) -> Result<Option<Device>> {
        let repo = DeviceRepository::new(&self.pool);
        repo.find_by_name(name).await
    }

    /// List all devices.
    pub async fn list_devices(&self) -> Result<Vec<Device>> {
        let repo = DeviceRepository::new(&self.pool);
        repo.list().await
    }

    /// List active (non-blocked) devices.
    pub async fn list_active_devices(&self) -> Result<Vec<Device>> {
        let repo = DeviceRepository::new(&self.pool);
        repo.list_active().await
    }

    /// Block a device.
    pub async fn block_device(&self, id: Uuid) -> Result<Device> {
        let repo = DeviceRepository::new(&self.pool);
        repo.block(id).await
    }

    /// Unblock a device.
    pub async fn unblock_device(&self, id: Uuid) -> Result<Device> {
        let repo = DeviceRepository::new(&self.pool);
        repo.unblock(id).await
    }

    /// Delete a device.
    pub async fn delete_device(&self, id: Uuid) -> Result<()> {
        let repo = DeviceRepository::new(&self.pool);
        repo.delete(id).await
    }

    /// Update device last seen timestamp.
    pub async fn update_device_heartbeat(&self, id: Uuid) -> Result<()> {
        let repo = DeviceRepository::new(&self.pool);
        repo.update_last_seen(id).await
    }

    /// Get VPN network status.
    pub async fn get_network_status(&self) -> Result<NetworkStatus> {
        let repo = DeviceRepository::new(&self.pool);

        let total_devices = repo.count().await?;
        let active_devices = repo.count_active().await?;
        let lighthouses = repo.list_lighthouses().await?;

        Ok(NetworkStatus {
            total_devices,
            active_devices,
            lighthouse_count: lighthouses.len() as i64,
            network_prefix: self.network_prefix.clone(),
            healthy: !lighthouses.is_empty(),
        })
    }

    /// Regenerate configuration for all devices.
    pub async fn regenerate_all_configs(&self) -> Result<()> {
        let devices = self.list_active_devices().await?;

        // Ensure config directory exists
        let devices_dir = format!("{}/devices", self.config_path);
        fs::create_dir_all(&devices_dir).await?;

        for device in devices {
            let config = self.generate_device_config(&device).await?;
            let config_yaml = serde_yaml::to_string(&config)
                .map_err(|e| Error::Internal(format!("Failed to serialize config: {}", e)))?;

            let config_path = format!("{}/{}.yaml", devices_dir, device.name);
            fs::write(&config_path, config_yaml).await?;

            tracing::info!("Regenerated config for device: {}", device.name);
        }

        Ok(())
    }
}

/// Device enrollment result.
#[derive(Debug, Clone, serde::Serialize)]
pub struct DeviceEnrollment {
    pub device: Device,
    pub certificate: DeviceCertificate,
    pub config: MeshConfig,
}

/// Device certificate bundle.
#[derive(Debug, Clone, serde::Serialize)]
pub struct DeviceCertificate {
    pub ca: String,
    pub cert: String,
    pub key: String,
}

/// Network status information.
#[derive(Debug, Clone, serde::Serialize)]
pub struct NetworkStatus {
    pub total_devices: i64,
    pub active_devices: i64,
    pub lighthouse_count: i64,
    pub network_prefix: String,
    pub healthy: bool,
}
