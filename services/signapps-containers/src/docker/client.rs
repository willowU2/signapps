//! Docker client implementation using bollard.

use bollard::container::{
    Config, CreateContainerOptions, ListContainersOptions, LogOutput, LogsOptions,
    RemoveContainerOptions, RestartContainerOptions, StartContainerOptions, StatsOptions,
    StopContainerOptions,
};
use bollard::image::{CreateImageOptions, ListImagesOptions, RemoveImageOptions};
use bollard::network::{
    ConnectNetworkOptions, CreateNetworkOptions, ListNetworksOptions,
};
use bollard::volume::ListVolumesOptions;
use bollard::Docker;
use futures_util::StreamExt;
use signapps_common::{Error, Result};
use std::collections::HashMap;
use std::sync::Arc;

use super::types::*;

/// Docker client wrapper.
#[derive(Clone)]
pub struct DockerClient {
    docker: Arc<Docker>,
}

impl DockerClient {
    /// Create a new Docker client connecting to the local socket.
    pub fn new() -> Result<Self> {
        let docker = Docker::connect_with_local_defaults()
            .map_err(|e| Error::Docker(format!("Failed to connect to Docker: {}", e)))?;

        Ok(Self {
            docker: Arc::new(docker),
        })
    }

    /// Create a Docker client with custom socket path.
    pub fn with_socket(socket_path: &str) -> Result<Self> {
        let docker = Docker::connect_with_socket(socket_path, 120, bollard::API_DEFAULT_VERSION)
            .map_err(|e| Error::Docker(format!("Failed to connect to Docker: {}", e)))?;

        Ok(Self {
            docker: Arc::new(docker),
        })
    }

    /// Check if Docker is available.
    pub async fn ping(&self) -> Result<()> {
        self.docker
            .ping()
            .await
            .map_err(|e| Error::Docker(format!("Docker ping failed: {}", e)))?;
        Ok(())
    }

    /// Get Docker version info.
    pub async fn version(&self) -> Result<bollard::system::Version> {
        self.docker
            .version()
            .await
            .map_err(|e| Error::Docker(format!("Failed to get Docker version: {}", e)))
    }

    // =========================================================================
    // Container Operations
    // =========================================================================

    /// List all containers.
    pub async fn list_containers(&self, all: bool) -> Result<Vec<ContainerInfo>> {
        let options = ListContainersOptions::<String> {
            all,
            ..Default::default()
        };

        let containers = self
            .docker
            .list_containers(Some(options))
            .await
            .map_err(|e| Error::Docker(format!("Failed to list containers: {}", e)))?;

        let result = containers
            .into_iter()
            .map(|c| {
                let ports = c
                    .ports
                    .unwrap_or_default()
                    .into_iter()
                    .map(|p| PortInfo {
                        container_port: p.private_port,
                        host_port: p.public_port,
                        host_ip: p.ip,
                        protocol: p.typ.map(|t| t.to_string()).unwrap_or_default(),
                    })
                    .collect();

                let networks = c
                    .network_settings
                    .and_then(|ns| ns.networks)
                    .map(|n| n.keys().cloned().collect())
                    .unwrap_or_default();

                ContainerInfo {
                    id: c.id.unwrap_or_default(),
                    name: c
                        .names
                        .and_then(|n| n.first().cloned())
                        .map(|n| n.trim_start_matches('/').to_string())
                        .unwrap_or_default(),
                    image: c.image.unwrap_or_default(),
                    status: c.status.unwrap_or_default(),
                    state: c.state.unwrap_or_default(),
                    created: c.created.map(|t| t.to_string()).unwrap_or_default(),
                    ports,
                    labels: c.labels.unwrap_or_default(),
                    networks,
                }
            })
            .collect();

        Ok(result)
    }

    /// Get container by ID or name.
    pub async fn get_container(&self, id: &str) -> Result<ContainerInfo> {
        let inspect = self
            .docker
            .inspect_container(id, None)
            .await
            .map_err(|e| Error::Docker(format!("Container not found: {}", e)))?;

        let ports = inspect
            .network_settings
            .as_ref()
            .and_then(|ns| ns.ports.as_ref())
            .map(|ports| {
                ports
                    .iter()
                    .flat_map(|(key, bindings)| {
                        let parts: Vec<&str> = key.split('/').collect();
                        let container_port =
                            parts.first().and_then(|p| p.parse().ok()).unwrap_or(0);
                        let protocol = parts.get(1).map(|s| s.to_string()).unwrap_or_default();

                        bindings
                            .as_ref()
                            .map(|bs| {
                                bs.iter()
                                    .map(|b| PortInfo {
                                        container_port,
                                        host_port: b
                                            .host_port
                                            .as_ref()
                                            .and_then(|p| p.parse().ok()),
                                        host_ip: b.host_ip.clone(),
                                        protocol: protocol.clone(),
                                    })
                                    .collect::<Vec<_>>()
                            })
                            .unwrap_or_default()
                    })
                    .collect()
            })
            .unwrap_or_default();

        let networks = inspect
            .network_settings
            .as_ref()
            .and_then(|ns| ns.networks.as_ref())
            .map(|n| n.keys().cloned().collect())
            .unwrap_or_default();

        Ok(ContainerInfo {
            id: inspect.id.unwrap_or_default(),
            name: inspect
                .name
                .map(|n| n.trim_start_matches('/').to_string())
                .unwrap_or_default(),
            image: inspect
                .config
                .as_ref()
                .and_then(|c| c.image.clone())
                .unwrap_or_default(),
            status: inspect
                .state
                .as_ref()
                .and_then(|s| s.status.as_ref())
                .map(|s| format!("{:?}", s))
                .unwrap_or_default(),
            state: inspect
                .state
                .as_ref()
                .and_then(|s| s.status.as_ref())
                .map(|s| format!("{:?}", s))
                .unwrap_or_default(),
            created: inspect.created.unwrap_or_default(),
            ports,
            labels: inspect.config.and_then(|c| c.labels).unwrap_or_default(),
            networks,
        })
    }

    /// Create a new container.
    pub async fn create_container(&self, config: ContainerConfig) -> Result<String> {
        // Build port bindings
        let port_bindings = config.ports.as_ref().map(|ports| {
            let mut bindings = HashMap::new();
            for port in ports {
                let key = format!("{}/{}", port.container, port.protocol);
                let binding = bollard::service::PortBinding {
                    host_ip: port.host_ip.clone(),
                    host_port: Some(port.host.to_string()),
                };
                bindings.insert(key, Some(vec![binding]));
            }
            bindings
        });

        // Build exposed ports
        let exposed_ports = config.ports.as_ref().map(|ports| {
            let mut exposed = HashMap::new();
            for port in ports {
                let key = format!("{}/{}", port.container, port.protocol);
                exposed.insert(key, HashMap::new());
            }
            exposed
        });

        // Build volume bindings
        let binds = config.volumes.as_ref().map(|vols| {
            vols.iter()
                .map(|v| {
                    if v.read_only {
                        format!("{}:{}:ro", v.source, v.target)
                    } else {
                        format!("{}:{}", v.source, v.target)
                    }
                })
                .collect()
        });

        // Build resource limits
        let (memory, nano_cpus) = if let Some(ref res) = config.resources {
            (
                res.memory_mb.map(|m| m * 1024 * 1024),
                res.cpu_cores.map(|c| (c * 1_000_000_000.0) as i64),
            )
        } else {
            (None, None)
        };

        // Build restart policy
        let restart_policy = config.restart_policy.map(|rp| {
            let name = match rp {
                RestartPolicy::No => bollard::service::RestartPolicyNameEnum::NO,
                RestartPolicy::Always => bollard::service::RestartPolicyNameEnum::ALWAYS,
                RestartPolicy::OnFailure => bollard::service::RestartPolicyNameEnum::ON_FAILURE,
                RestartPolicy::UnlessStopped => {
                    bollard::service::RestartPolicyNameEnum::UNLESS_STOPPED
                },
            };
            bollard::service::RestartPolicy {
                name: Some(name),
                maximum_retry_count: None,
            }
        });

        // Build host config
        let host_config = bollard::service::HostConfig {
            binds,
            port_bindings,
            memory,
            nano_cpus,
            restart_policy,
            network_mode: config.network_mode,
            ..Default::default()
        };

        // Build container config
        let container_config = Config {
            image: Some(config.image.clone()),
            cmd: config.cmd,
            env: config.env,
            exposed_ports,
            labels: config.labels,
            hostname: config.hostname,
            working_dir: config.working_dir,
            user: config.user,
            host_config: Some(host_config),
            ..Default::default()
        };

        let options = CreateContainerOptions {
            name: config.name.as_str(),
            platform: None,
        };

        let response = self
            .docker
            .create_container(Some(options), container_config)
            .await
            .map_err(|e| Error::Docker(format!("Failed to create container: {}", e)))?;

        tracing::info!(container_id = %response.id, name = %config.name, "Container created");

        Ok(response.id)
    }

    /// Start a container.
    pub async fn start_container(&self, id: &str) -> Result<()> {
        self.docker
            .start_container(id, None::<StartContainerOptions<String>>)
            .await
            .map_err(|e| Error::Docker(format!("Failed to start container: {}", e)))?;

        tracing::info!(container_id = %id, "Container started");
        Ok(())
    }

    /// Stop a container.
    pub async fn stop_container(&self, id: &str, timeout_secs: Option<i64>) -> Result<()> {
        let options = StopContainerOptions {
            t: timeout_secs.unwrap_or(10),
        };

        self.docker
            .stop_container(id, Some(options))
            .await
            .map_err(|e| Error::Docker(format!("Failed to stop container: {}", e)))?;

        tracing::info!(container_id = %id, "Container stopped");
        Ok(())
    }

    /// Restart a container.
    pub async fn restart_container(&self, id: &str, timeout_secs: Option<i64>) -> Result<()> {
        let options = RestartContainerOptions {
            t: timeout_secs.unwrap_or(10) as isize,
        };

        self.docker
            .restart_container(id, Some(options))
            .await
            .map_err(|e| Error::Docker(format!("Failed to restart container: {}", e)))?;

        tracing::info!(container_id = %id, "Container restarted");
        Ok(())
    }

    /// Remove a container.
    pub async fn remove_container(&self, id: &str, force: bool, volumes: bool) -> Result<()> {
        let options = RemoveContainerOptions {
            force,
            v: volumes,
            ..Default::default()
        };

        self.docker
            .remove_container(id, Some(options))
            .await
            .map_err(|e| Error::Docker(format!("Failed to remove container: {}", e)))?;

        tracing::info!(container_id = %id, "Container removed");
        Ok(())
    }

    /// Get container logs.
    pub async fn get_logs(&self, id: &str, tail: Option<usize>) -> Result<Vec<String>> {
        let options = LogsOptions::<String> {
            stdout: true,
            stderr: true,
            tail: tail
                .map(|t| t.to_string())
                .unwrap_or_else(|| "100".to_string()),
            ..Default::default()
        };

        let mut stream = self.docker.logs(id, Some(options));
        let mut logs = Vec::new();

        while let Some(result) = stream.next().await {
            match result {
                Ok(log) => {
                    let line = match log {
                        LogOutput::StdOut { message } => {
                            String::from_utf8_lossy(&message).to_string()
                        },
                        LogOutput::StdErr { message } => {
                            String::from_utf8_lossy(&message).to_string()
                        },
                        _ => continue,
                    };
                    logs.push(line);
                },
                Err(e) => {
                    tracing::warn!(error = %e, "Error reading log");
                    break;
                },
            }
        }

        Ok(logs)
    }

    /// Get container stats snapshot.
    pub async fn get_stats(&self, id: &str) -> Result<ContainerStats> {
        let options = StatsOptions {
            stream: false,
            one_shot: true,
        };

        let mut stream = self.docker.stats(id, Some(options));

        if let Some(result) = stream.next().await {
            let stats = result.map_err(|e| Error::Docker(format!("Failed to get stats: {}", e)))?;

            // Calculate CPU percentage
            let cpu_delta = stats.cpu_stats.cpu_usage.total_usage as f64
                - stats.precpu_stats.cpu_usage.total_usage as f64;
            let system_delta = stats.cpu_stats.system_cpu_usage.unwrap_or(0) as f64
                - stats.precpu_stats.system_cpu_usage.unwrap_or(0) as f64;
            let cpu_count = stats.cpu_stats.online_cpus.unwrap_or(1) as f64;
            let cpu_percent = if system_delta > 0.0 {
                (cpu_delta / system_delta) * cpu_count * 100.0
            } else {
                0.0
            };

            // Memory stats
            let memory_usage = stats.memory_stats.usage.unwrap_or(0) as f64 / 1024.0 / 1024.0;
            let memory_limit = stats.memory_stats.limit.unwrap_or(1) as f64 / 1024.0 / 1024.0;
            let memory_percent = (memory_usage / memory_limit) * 100.0;

            // Network stats
            let (network_rx, network_tx) = stats
                .networks
                .as_ref()
                .map(|nets| {
                    nets.values().fold((0u64, 0u64), |(rx, tx), net| {
                        (rx + net.rx_bytes, tx + net.tx_bytes)
                    })
                })
                .unwrap_or((0, 0));

            // Block I/O
            let (block_read, block_write) = stats
                .blkio_stats
                .io_service_bytes_recursive
                .as_ref()
                .map(|ios| {
                    ios.iter()
                        .fold((0u64, 0u64), |(r, w), io| match io.op.as_str() {
                            "read" | "Read" => (r + io.value, w),
                            "write" | "Write" => (r, w + io.value),
                            _ => (r, w),
                        })
                })
                .unwrap_or((0, 0));

            return Ok(ContainerStats {
                container_id: id.to_string(),
                cpu_percent,
                memory_usage_mb: memory_usage,
                memory_limit_mb: memory_limit,
                memory_percent,
                network_rx_bytes: network_rx,
                network_tx_bytes: network_tx,
                block_read_bytes: block_read,
                block_write_bytes: block_write,
                pids: stats.pids_stats.current.unwrap_or(0),
                timestamp: chrono::Utc::now().to_rfc3339(),
            });
        }

        Err(Error::Docker("No stats available".to_string()))
    }

    // =========================================================================
    // Image Operations
    // =========================================================================

    /// List all images.
    pub async fn list_images(&self) -> Result<Vec<ImageInfo>> {
        let options = ListImagesOptions::<String> {
            all: false,
            ..Default::default()
        };

        let images = self
            .docker
            .list_images(Some(options))
            .await
            .map_err(|e| Error::Docker(format!("Failed to list images: {}", e)))?;

        let result = images
            .into_iter()
            .map(|i| ImageInfo {
                id: i.id,
                repo_tags: i.repo_tags,
                size_mb: i.size as f64 / 1024.0 / 1024.0,
                created: i.created.to_string(),
            })
            .collect();

        Ok(result)
    }

    /// Pull an image.
    pub async fn pull_image(&self, image: &str) -> Result<()> {
        let options = CreateImageOptions {
            from_image: image,
            ..Default::default()
        };

        let mut stream = self.docker.create_image(Some(options), None, None);

        while let Some(result) = stream.next().await {
            match result {
                Ok(info) => {
                    if let Some(status) = info.status {
                        tracing::debug!(image = %image, status = %status, "Pull progress");
                    }
                },
                Err(e) => {
                    return Err(Error::Docker(format!("Failed to pull image: {}", e)));
                },
            }
        }

        tracing::info!(image = %image, "Image pulled");
        Ok(())
    }

    /// Get exposed ports from a Docker image.
    pub async fn get_image_exposed_ports(&self, image: &str) -> Result<Vec<(u16, String)>> {
        let inspect = self
            .docker
            .inspect_image(image)
            .await
            .map_err(|e| Error::Docker(format!("Failed to inspect image: {}", e)))?;

        let ports = inspect
            .config
            .and_then(|c| c.exposed_ports)
            .map(|exposed| {
                exposed
                    .keys()
                    .filter_map(|key| {
                        let parts: Vec<&str> = key.split('/').collect();
                        let port = parts.first()?.parse::<u16>().ok()?;
                        let proto = parts.get(1).unwrap_or(&"tcp").to_string();
                        Some((port, proto))
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(ports)
    }

    /// Get all host ports currently in use by running containers.
    pub async fn get_used_host_ports(&self) -> Result<std::collections::HashSet<u16>> {
        let containers = self.list_containers(true).await?;
        let mut used = std::collections::HashSet::new();
        for c in &containers {
            for p in &c.ports {
                if let Some(hp) = p.host_port {
                    used.insert(hp);
                }
            }
        }
        Ok(used)
    }

    /// Remove an image.
    pub async fn remove_image(&self, id: &str, force: bool) -> Result<()> {
        let options = RemoveImageOptions {
            force,
            ..Default::default()
        };

        self.docker
            .remove_image(id, Some(options), None)
            .await
            .map_err(|e| Error::Docker(format!("Failed to remove image: {}", e)))?;

        tracing::info!(image_id = %id, "Image removed");
        Ok(())
    }

    // =========================================================================
    // Network Operations
    // =========================================================================

    /// List all networks.
    pub async fn list_networks(&self) -> Result<Vec<NetworkInfo>> {
        let options = ListNetworksOptions::<String>::default();

        let networks = self
            .docker
            .list_networks(Some(options))
            .await
            .map_err(|e| Error::Docker(format!("Failed to list networks: {}", e)))?;

        let result = networks
            .into_iter()
            .map(|n| NetworkInfo {
                id: n.id.unwrap_or_default(),
                name: n.name.unwrap_or_default(),
                driver: n.driver.unwrap_or_default(),
                scope: n.scope.unwrap_or_default(),
                internal: n.internal.unwrap_or(false),
                containers: n
                    .containers
                    .map(|c| c.keys().cloned().collect())
                    .unwrap_or_default(),
            })
            .collect();

        Ok(result)
    }

    /// Create a Docker network with bridge driver.
    pub async fn create_network(&self, name: &str) -> Result<String> {
        let config = CreateNetworkOptions {
            name: name.to_string(),
            driver: "bridge".to_string(),
            ..Default::default()
        };

        let response = self
            .docker
            .create_network(config)
            .await
            .map_err(|e| Error::Docker(format!("Failed to create network: {}", e)))?;

        let id = response.id.unwrap_or_default();
        tracing::info!(network = %name, network_id = %id, "Network created");
        Ok(id)
    }

    /// Connect a container to a network.
    pub async fn connect_network(&self, container_id: &str, network: &str) -> Result<()> {
        let config = ConnectNetworkOptions {
            container: container_id.to_string(),
            ..Default::default()
        };

        self.docker
            .connect_network(network, config)
            .await
            .map_err(|e| {
                Error::Docker(format!(
                    "Failed to connect container {} to network {}: {}",
                    container_id, network, e
                ))
            })?;

        tracing::info!(
            container_id = %container_id, network = %network,
            "Container connected to network"
        );
        Ok(())
    }

    /// Remove a Docker network.
    pub async fn remove_network(&self, name: &str) -> Result<()> {
        self.docker
            .remove_network(name)
            .await
            .map_err(|e| Error::Docker(format!("Failed to remove network: {}", e)))?;

        tracing::info!(network = %name, "Network removed");
        Ok(())
    }

    // =========================================================================
    // Volume Operations
    // =========================================================================

    /// List all volumes.
    pub async fn list_volumes(&self) -> Result<Vec<VolumeInfo>> {
        let options = ListVolumesOptions::<String>::default();

        let response = self
            .docker
            .list_volumes(Some(options))
            .await
            .map_err(|e| Error::Docker(format!("Failed to list volumes: {}", e)))?;

        let result = response
            .volumes
            .unwrap_or_default()
            .into_iter()
            .map(|v| VolumeInfo {
                name: v.name,
                driver: v.driver,
                mountpoint: v.mountpoint,
                created_at: v.created_at,
                labels: v.labels,
            })
            .collect();

        Ok(result)
    }
}

impl Default for DockerClient {
    fn default() -> Self {
        Self::new().expect("Failed to create Docker client")
    }
}
