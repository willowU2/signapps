//! Hardware detection for GPU/CPU inference backends.

use serde::{Deserialize, Serialize};
use std::fmt;

/// GPU vendor.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum GpuVendor {
    Nvidia,
    Amd,
    Intel,
    Apple,
    Unknown,
}

/// Inference backend for AI models.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum InferenceBackend {
    Cuda { version: String },
    Rocm { version: String },
    Vulkan,
    Metal,
    Cpu,
}

impl fmt::Display for InferenceBackend {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Cuda { version } => write!(f, "CUDA {}", version),
            Self::Rocm { version } => write!(f, "ROCm {}", version),
            Self::Vulkan => write!(f, "Vulkan"),
            Self::Metal => write!(f, "Metal"),
            Self::Cpu => write!(f, "CPU"),
        }
    }
}

/// Info about a detected GPU.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuInfo {
    pub name: String,
    pub vendor: GpuVendor,
    pub vram_mb: u64,
}

/// Overall hardware profile for inference.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareProfile {
    pub gpus: Vec<GpuInfo>,
    pub preferred_backend: InferenceBackend,
    pub total_vram_mb: u64,
    pub cpu_cores: usize,
    pub system_ram_mb: u64,
}

impl HardwareProfile {
    /// Detect hardware capabilities.
    pub async fn detect() -> Self {
        let cpu_cores = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4);

        let system_ram_mb = get_system_ram_mb();

        // Check env override first
        if let Ok(backend) = std::env::var("GPU_BACKEND") {
            let forced = match backend.to_lowercase().as_str() {
                "cuda" => InferenceBackend::Cuda {
                    version: "auto".to_string(),
                },
                "rocm" => InferenceBackend::Rocm {
                    version: "auto".to_string(),
                },
                "vulkan" => InferenceBackend::Vulkan,
                "metal" => InferenceBackend::Metal,
                "cpu" => InferenceBackend::Cpu,
                _ => InferenceBackend::Cpu, // "auto" falls through
            };
            if forced != InferenceBackend::Cpu || backend == "cpu" {
                tracing::info!("GPU backend forced via GPU_BACKEND={}", backend);
                return Self {
                    gpus: vec![],
                    preferred_backend: forced,
                    total_vram_mb: 0,
                    cpu_cores,
                    system_ram_mb,
                };
            }
        }

        // Auto-detect
        let mut gpus = Vec::new();
        let mut preferred_backend = InferenceBackend::Cpu;
        let mut native_vendors = std::collections::HashSet::new();

        // Try NVIDIA
        if let Some((nvidia_gpus, cuda_version)) = detect_nvidia().await {
            for gpu in &nvidia_gpus {
                tracing::info!(
                    "Detected NVIDIA GPU: {} ({} MB VRAM)",
                    gpu.name,
                    gpu.vram_mb
                );
            }
            preferred_backend = InferenceBackend::Cuda {
                version: cuda_version,
            };
            gpus.extend(nvidia_gpus);
            native_vendors.insert(GpuVendor::Nvidia);
        }

        // Try AMD via rocm-smi
        if let Some((amd_gpus, rocm_version)) = detect_amd().await {
            for gpu in &amd_gpus {
                tracing::info!("Detected AMD GPU: {} ({} MB VRAM)", gpu.name, gpu.vram_mb);
            }
            if matches!(preferred_backend, InferenceBackend::Cpu) {
                preferred_backend = InferenceBackend::Rocm {
                    version: rocm_version,
                };
            }
            gpus.extend(amd_gpus);
            native_vendors.insert(GpuVendor::Amd);
        }

        // macOS Metal
        #[cfg(target_os = "macos")]
        if gpus.is_empty() {
            tracing::info!("macOS detected, using Metal backend");
            preferred_backend = InferenceBackend::Metal;
            gpus.push(GpuInfo {
                name: "Apple Silicon".to_string(),
                vendor: GpuVendor::Apple,
                vram_mb: system_ram_mb / 2, // Unified memory, estimate half
            });
            native_vendors.insert(GpuVendor::Apple);
        }

        // Fallback for Windows (iGPU, missing drivers, etc.)
        #[cfg(target_os = "windows")]
        if let Some(cim_gpus) = detect_windows_cim().await {
            for gpu in cim_gpus {
                // Skip if native tools already found this vendor's GPU accurately
                if native_vendors.contains(&gpu.vendor) {
                    continue;
                }

                tracing::info!(
                    "Detected Windows GPU (CIM): {} ({} MB VRAM)",
                    gpu.name,
                    gpu.vram_mb
                );

                if (gpu.vendor == GpuVendor::Amd || gpu.vendor == GpuVendor::Intel)
                    && matches!(preferred_backend, InferenceBackend::Cpu)
                {
                    preferred_backend = InferenceBackend::Vulkan;
                }

                gpus.push(gpu);
            }
        }

        let total_vram_mb = gpus.iter().map(|g| g.vram_mb).sum();

        if gpus.is_empty() {
            tracing::info!(
                "No GPU detected, using CPU backend ({} cores, {} MB RAM)",
                cpu_cores,
                system_ram_mb
            );
        }

        Self {
            gpus,
            preferred_backend,
            total_vram_mb,
            cpu_cores,
            system_ram_mb,
        }
    }

    /// Recommend model size tier based on available resources.
    pub fn recommend_tier(&self) -> ModelTier {
        if self.total_vram_mb >= 8000 {
            ModelTier::Large
        } else if self.total_vram_mb >= 4000 {
            ModelTier::Medium
        } else {
            ModelTier::Small
        }
    }
}

/// Model size recommendation tier.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ModelTier {
    /// >= 8 GB VRAM: large-v3, 8B-Q4
    Large,
    /// >= 4 GB VRAM: medium, 3B-Q4
    Medium,
    /// < 4 GB / CPU: base, 1B-Q8
    Small,
}

fn get_system_ram_mb() -> u64 {
    // Cross-platform: read from sysinfo
    #[cfg(target_os = "windows")]
    {
        // Use PowerShell to get Physical Memory as WMIC is deprecated
        let output = std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory",
            ])
            .output();
        if let Ok(out) = output {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                if let Ok(bytes) = line.trim().parse::<u64>() {
                    return bytes / (1024 * 1024);
                }
            }
        }
        16384 // fallback 16 GB
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(info) = std::fs::read_to_string("/proc/meminfo") {
            for line in info.lines() {
                if line.starts_with("MemTotal:") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if let Some(kb_str) = parts.get(1) {
                        if let Ok(kb) = kb_str.parse::<u64>() {
                            return kb / 1024;
                        }
                    }
                }
            }
        }
        16384
    }
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("sysctl")
            .arg("-n")
            .arg("hw.memsize")
            .output();
        if let Ok(out) = output {
            let text = String::from_utf8_lossy(&out.stdout);
            if let Ok(bytes) = text.trim().parse::<u64>() {
                return bytes / (1024 * 1024);
            }
        }
        16384
    }
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    {
        16384
    }
}

#[cfg(target_os = "windows")]
#[derive(serde::Deserialize)]
struct CimVideoController {
    #[serde(alias = "Name")]
    name: Option<String>,
    #[serde(alias = "AdapterRAM")]
    adapter_ram: Option<u64>,
}

#[cfg(target_os = "windows")]
async fn detect_windows_cim() -> Option<Vec<GpuInfo>> {
    let output = tokio::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json -Compress",
        ])
        .output()
        .await
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut controllers: Vec<CimVideoController> = Vec::new();

    if let Ok(parsed) = serde_json::from_str::<Vec<CimVideoController>>(&stdout) {
        controllers = parsed;
    } else if let Ok(single) = serde_json::from_str::<CimVideoController>(&stdout) {
        controllers.push(single);
    }

    let system_ram_mb = get_system_ram_mb();
    let mut gpus = Vec::new();
    for ctrl in controllers {
        if let Some(name) = ctrl.name {
            let name_lower = name.to_lowercase();
            let vendor = if name_lower.contains("amd") || name_lower.contains("radeon") {
                GpuVendor::Amd
            } else if name_lower.contains("nvidia") || name_lower.contains("geforce") {
                GpuVendor::Nvidia
            } else if name_lower.contains("intel") {
                GpuVendor::Intel
            } else {
                GpuVendor::Unknown
            };

            let mut vram_mb = ctrl.adapter_ram.unwrap_or(0) / (1024 * 1024);
            let mut display_name = name.clone();

            // Windows WMI misreports modern GPU memory strictly at 4293918720 bytes (4095 MB limit on uint32)
            // If it's an APU or Intel iGPU integrated graphics, the OS apportions shared RAM memory dynamically
            let is_igpu = (vram_mb == 4095 || vram_mb == 4096)
                && (name_lower.contains("integrated")
                    || name_lower.contains("radeon graphics")
                    || name_lower.contains("uhd")
                    || name_lower.contains("iris")
                    || vendor == GpuVendor::Intel);

            if is_igpu {
                // Assign full system RAM for calculation purposes as shared GPUs can span flexibly
                vram_mb = system_ram_mb;
                display_name = format!("{} (iGPU)", name);
            } else if vram_mb == 4095 || vram_mb == 4096 {
                // It's a dedicated GPU that exceeds the WMI 32-bit limit (4GB).
                // Without native CLI tools (nvidia-smi/rocm-smi), we can't reliably know the exact VRAM.
                // But for enterprise AMD AI PRO cards like the R9700, they carry exactly 32 GB.
                if name_lower.contains("r9700")
                    || name_lower.contains("w7900")
                    || name_lower.contains("pro")
                {
                    vram_mb = 32768; // 32 GB
                } else {
                    vram_mb = 8192; // Generic fallback for >4GB
                }
            }

            gpus.push(GpuInfo {
                name: display_name,
                vendor,
                vram_mb,
            });
        }
    }

    if gpus.is_empty() {
        None
    } else {
        Some(gpus)
    }
}

async fn detect_nvidia() -> Option<(Vec<GpuInfo>, String)> {
    let mut command_name = "nvidia-smi".to_string();

    #[cfg(target_os = "windows")]
    {
        // On Windows, nvidia-smi might not be in PATH. Test if it exists at the default location.
        let default_path =
            std::path::Path::new("C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe");
        if default_path.exists() {
            command_name = default_path.to_string_lossy().to_string();
        }
    }

    let output = tokio::process::Command::new(&command_name)
        .args([
            "--query-gpu=name,memory.total",
            "--format=csv,noheader,nounits",
        ])
        .output()
        .await
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut gpus = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
        if parts.len() >= 2 {
            let name = parts[0].to_string();
            let vram_mb = parts[1].parse::<u64>().unwrap_or(0);
            gpus.push(GpuInfo {
                name,
                vendor: GpuVendor::Nvidia,
                vram_mb,
            });
        }
    }

    if gpus.is_empty() {
        return None;
    }

    // Get CUDA version
    let cuda_version = tokio::process::Command::new(&command_name)
        .args(["--query-gpu=driver_version", "--format=csv,noheader"])
        .output()
        .await
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    Some((gpus, cuda_version))
}

async fn detect_amd() -> Option<(Vec<GpuInfo>, String)> {
    let output = tokio::process::Command::new("rocm-smi")
        .args(["--showproductname", "--csv"])
        .output()
        .await
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut gpus = Vec::new();

    for line in stdout.lines().skip(1) {
        // Skip header
        let name = line
            .split(',')
            .next()
            .unwrap_or("AMD GPU")
            .trim()
            .to_string();
        if !name.is_empty() {
            gpus.push(GpuInfo {
                name,
                vendor: GpuVendor::Amd,
                vram_mb: 8192, // rocm-smi vram parsing is complex, default 8 GB
            });
        }
    }

    // Try to get VRAM info separately
    if let Ok(vram_output) = tokio::process::Command::new("rocm-smi")
        .args(["--showmeminfo", "vram", "--csv"])
        .output()
        .await
    {
        let vram_text = String::from_utf8_lossy(&vram_output.stdout);
        for (i, line) in vram_text.lines().skip(1).enumerate() {
            if let Some(gpu) = gpus.get_mut(i) {
                // Parse total VRAM in bytes, convert to MB
                if let Some(total_str) = line.split(',').nth(1) {
                    if let Ok(bytes) = total_str.trim().parse::<u64>() {
                        gpu.vram_mb = bytes / (1024 * 1024);
                    }
                }
            }
        }
    }

    if gpus.is_empty() {
        return None;
    }

    let rocm_version = tokio::process::Command::new("rocm-smi")
        .arg("--showversion")
        .output()
        .await
        .ok()
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .next()
                .unwrap_or("unknown")
                .to_string()
        })
        .unwrap_or_else(|| "unknown".to_string());

    Some((gpus, rocm_version))
}
