//! System metrics collector using sysinfo.

use serde::Serialize;
use std::sync::Arc;
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, Networks, RefreshKind, System};
use tokio::sync::RwLock;

/// Metrics collector for system information.
#[derive(Clone)]
pub struct MetricsCollector {
    system: Arc<RwLock<System>>,
}

impl MetricsCollector {
    /// Create a new metrics collector.
    pub fn new() -> Self {
        let system = System::new_with_specifics(
            RefreshKind::new()
                .with_cpu(CpuRefreshKind::everything())
                .with_memory(MemoryRefreshKind::everything()),
        );

        Self {
            system: Arc::new(RwLock::new(system)),
        }
    }

    /// Refresh all system information.
    pub async fn refresh(&self) {
        let mut system = self.system.write().await;
        system.refresh_all();
    }

    /// Get CPU metrics.
    pub async fn get_cpu_metrics(&self) -> CpuMetrics {
        let mut system = self.system.write().await;
        system.refresh_cpu_usage();

        let cpus = system.cpus();
        let usage_per_cpu: Vec<f32> = cpus.iter().map(|cpu| cpu.cpu_usage()).collect();
        let total_usage = if !usage_per_cpu.is_empty() {
            usage_per_cpu.iter().sum::<f32>() / usage_per_cpu.len() as f32
        } else {
            0.0
        };

        CpuMetrics {
            count: cpus.len(),
            total_usage_percent: total_usage,
            usage_per_cpu,
            load_average: LoadAverage {
                one: System::load_average().one,
                five: System::load_average().five,
                fifteen: System::load_average().fifteen,
            },
        }
    }

    /// Get memory metrics.
    pub async fn get_memory_metrics(&self) -> MemoryMetrics {
        let mut system = self.system.write().await;
        system.refresh_memory();

        MemoryMetrics {
            total_bytes: system.total_memory(),
            used_bytes: system.used_memory(),
            free_bytes: system.free_memory(),
            available_bytes: system.available_memory(),
            swap_total_bytes: system.total_swap(),
            swap_used_bytes: system.used_swap(),
            usage_percent: (system.used_memory() as f64 / system.total_memory() as f64) * 100.0,
        }
    }

    /// Get disk metrics.
    pub async fn get_disk_metrics(&self) -> Vec<DiskMetrics> {
        let disks = Disks::new_with_refreshed_list();

        disks
            .iter()
            .map(|disk| {
                let total = disk.total_space();
                let available = disk.available_space();
                let used = total - available;

                DiskMetrics {
                    name: disk.name().to_string_lossy().to_string(),
                    mount_point: disk.mount_point().to_string_lossy().to_string(),
                    file_system: disk.file_system().to_string_lossy().to_string(),
                    total_bytes: total,
                    used_bytes: used,
                    available_bytes: available,
                    usage_percent: if total > 0 {
                        (used as f64 / total as f64) * 100.0
                    } else {
                        0.0
                    },
                    is_removable: disk.is_removable(),
                }
            })
            .collect()
    }

    /// Get network metrics.
    pub async fn get_network_metrics(&self) -> Vec<NetworkMetrics> {
        let networks = Networks::new_with_refreshed_list();

        networks
            .iter()
            .map(|(name, data)| NetworkMetrics {
                name: name.clone(),
                received_bytes: data.total_received(),
                transmitted_bytes: data.total_transmitted(),
                received_packets: data.total_packets_received(),
                transmitted_packets: data.total_packets_transmitted(),
                errors_in: data.total_errors_on_received(),
                errors_out: data.total_errors_on_transmitted(),
            })
            .collect()
    }

    /// Get all system metrics.
    pub async fn get_all_metrics(&self) -> SystemMetrics {
        self.refresh().await;

        SystemMetrics {
            hostname: System::host_name().unwrap_or_else(|| "unknown".to_string()),
            os_name: System::name().unwrap_or_else(|| "unknown".to_string()),
            os_version: System::os_version().unwrap_or_else(|| "unknown".to_string()),
            kernel_version: System::kernel_version().unwrap_or_else(|| "unknown".to_string()),
            uptime_seconds: System::uptime(),
            boot_time: System::boot_time(),
            cpu: self.get_cpu_metrics().await,
            memory: self.get_memory_metrics().await,
            disks: self.get_disk_metrics().await,
            networks: self.get_network_metrics().await,
        }
    }
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}

/// System metrics aggregate.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct SystemMetrics {
    pub hostname: String,
    pub os_name: String,
    pub os_version: String,
    pub kernel_version: String,
    pub uptime_seconds: u64,
    pub boot_time: u64,
    pub cpu: CpuMetrics,
    pub memory: MemoryMetrics,
    pub disks: Vec<DiskMetrics>,
    pub networks: Vec<NetworkMetrics>,
}

/// CPU metrics.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct CpuMetrics {
    pub count: usize,
    pub total_usage_percent: f32,
    pub usage_per_cpu: Vec<f32>,
    pub load_average: LoadAverage,
}

/// Load average.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct LoadAverage {
    pub one: f64,
    pub five: f64,
    pub fifteen: f64,
}

/// Memory metrics.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct MemoryMetrics {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub available_bytes: u64,
    pub swap_total_bytes: u64,
    pub swap_used_bytes: u64,
    pub usage_percent: f64,
}

/// Disk metrics.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct DiskMetrics {
    pub name: String,
    pub mount_point: String,
    pub file_system: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub usage_percent: f64,
    pub is_removable: bool,
}

/// Network interface metrics.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct NetworkMetrics {
    pub name: String,
    pub received_bytes: u64,
    pub transmitted_bytes: u64,
    pub received_packets: u64,
    pub transmitted_packets: u64,
    pub errors_in: u64,
    pub errors_out: u64,
}
