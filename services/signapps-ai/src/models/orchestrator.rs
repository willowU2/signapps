//! Model orchestrator for multi-GPU VRAM management with LRU eviction.
#![allow(dead_code)]

use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::Serialize;
use tokio::sync::Mutex;

use crate::gateway::Capability;
use signapps_runtime::{HardwareProfile, ModelManager};

/// Role assigned to a GPU.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum GpuRole {
    /// GPU 0: always keeps its models loaded (e.g. primary LLM).
    AlwaysOn,
    /// GPU 1+: models can be evicted via LRU when VRAM is needed.
    DynamicPool,
}

/// A model currently loaded on a GPU or in RAM.
#[derive(Debug, Clone, Serialize)]
pub struct LoadedModel {
    pub model_id: String,
    pub capability: Capability,
    pub vram_mb: u64,
    pub loaded_at: DateTime<Utc>,
    pub last_used: DateTime<Utc>,
}

/// State of a single GPU.
#[derive(Debug, Clone, Serialize)]
pub struct GpuState {
    pub id: usize,
    pub name: String,
    pub total_vram_mb: u64,
    pub used_vram_mb: u64,
    pub loaded_models: Vec<LoadedModel>,
    pub role: GpuRole,
}

impl GpuState {
    /// Returns the amount of free VRAM on this GPU in megabytes.
    pub fn free_vram_mb(&self) -> u64 {
        self.total_vram_mb.saturating_sub(self.used_vram_mb)
    }
}

/// Orchestrates model loading/unloading across multiple GPUs and RAM.
pub struct ModelOrchestrator {
    /// GPU states. GPU 0 = AlwaysOn, GPU 1+ = DynamicPool.
    gpus: Mutex<Vec<GpuState>>,
    /// CPU inference models keyed by model_id.
    ram_models: DashMap<String, LoadedModel>,
    /// Model manager from signapps-runtime for downloading/caching.
    model_manager: Arc<ModelManager>,
    /// Detected hardware profile.
    hardware: HardwareProfile,
}

impl ModelOrchestrator {
    /// Create a new orchestrator, initializing GPU states from the hardware profile.
    pub fn new(model_manager: Arc<ModelManager>, hardware: HardwareProfile) -> Self {
        let gpu_states: Vec<GpuState> = hardware
            .gpus
            .iter()
            .enumerate()
            .map(|(i, gpu)| GpuState {
                id: i,
                name: gpu.name.clone(),
                total_vram_mb: gpu.vram_mb,
                used_vram_mb: 0,
                loaded_models: Vec::new(),
                role: if i == 0 {
                    GpuRole::AlwaysOn
                } else {
                    GpuRole::DynamicPool
                },
            })
            .collect();

        tracing::info!(
            "ModelOrchestrator initialized with {} GPU(s), total VRAM: {} MB",
            gpu_states.len(),
            hardware.total_vram_mb,
        );

        Self {
            gpus: Mutex::new(gpu_states),
            ram_models: DashMap::new(),
            model_manager,
            hardware,
        }
    }

    /// Returns a snapshot of all GPU states.
    pub async fn gpu_status(&self) -> Vec<GpuState> {
        self.gpus.lock().await.clone()
    }

    /// Returns the total free VRAM across all GPUs.
    pub async fn total_free_vram(&self) -> u64 {
        self.gpus
            .lock()
            .await
            .iter()
            .map(|g| g.free_vram_mb())
            .sum()
    }

    /// Check whether a model is currently loaded on any GPU or in RAM.
    pub async fn is_model_loaded(&self, model_id: &str) -> bool {
        if self.ram_models.contains_key(model_id) {
            return true;
        }
        let gpus = self.gpus.lock().await;
        gpus.iter()
            .any(|g| g.loaded_models.iter().any(|m| m.model_id == model_id))
    }

    /// Ensure a model is downloaded and available locally.
    ///
    /// Delegates to [`ModelManager::ensure_model`] and converts the error.
    pub async fn ensure_model_available(&self, model_id: &str) -> Result<PathBuf> {
        self.model_manager
            .ensure_model(model_id)
            .await
            .map_err(|e| anyhow!("Failed to ensure model '{}': {}", model_id, e))
    }

    /// Register a model as loaded on a specific GPU.
    pub async fn register_gpu_model(
        &self,
        gpu_id: usize,
        model_id: &str,
        capability: Capability,
        vram_mb: u64,
    ) -> Result<()> {
        let mut gpus = self.gpus.lock().await;
        let gpu = gpus
            .get_mut(gpu_id)
            .ok_or_else(|| anyhow!("GPU {} not found", gpu_id))?;

        if gpu.free_vram_mb() < vram_mb {
            return Err(anyhow!(
                "Insufficient VRAM on GPU {}: need {} MB, have {} MB free",
                gpu_id,
                vram_mb,
                gpu.free_vram_mb()
            ));
        }

        let now = Utc::now();
        gpu.loaded_models.push(LoadedModel {
            model_id: model_id.to_string(),
            capability,
            vram_mb,
            loaded_at: now,
            last_used: now,
        });
        gpu.used_vram_mb += vram_mb;

        tracing::info!(
            "Registered model '{}' on GPU {} ({} MB VRAM, {} MB free)",
            model_id,
            gpu_id,
            vram_mb,
            gpu.free_vram_mb(),
        );

        Ok(())
    }

    /// Register a model as loaded in system RAM (CPU inference).
    pub fn register_ram_model(&self, model_id: &str, capability: Capability) {
        let now = Utc::now();
        self.ram_models.insert(
            model_id.to_string(),
            LoadedModel {
                model_id: model_id.to_string(),
                capability,
                vram_mb: 0,
                loaded_at: now,
                last_used: now,
            },
        );
        tracing::info!("Registered RAM model '{}'", model_id);
    }

    /// Unload a model from a specific GPU.
    pub async fn unload_gpu_model(&self, gpu_id: usize, model_id: &str) -> Result<()> {
        let mut gpus = self.gpus.lock().await;
        let gpu = gpus
            .get_mut(gpu_id)
            .ok_or_else(|| anyhow!("GPU {} not found", gpu_id))?;

        let idx = gpu
            .loaded_models
            .iter()
            .position(|m| m.model_id == model_id)
            .ok_or_else(|| anyhow!("Model '{}' not found on GPU {}", model_id, gpu_id))?;

        let model = gpu.loaded_models.remove(idx);
        gpu.used_vram_mb = gpu.used_vram_mb.saturating_sub(model.vram_mb);

        tracing::info!(
            "Unloaded model '{}' from GPU {} (freed {} MB, {} MB free now)",
            model_id,
            gpu_id,
            model.vram_mb,
            gpu.free_vram_mb(),
        );

        Ok(())
    }

    /// Find a GPU with enough free VRAM for the given requirement.
    ///
    /// Prefers DynamicPool GPUs over AlwaysOn so the primary GPU stays stable.
    pub async fn find_gpu_for(&self, vram_needed: u64) -> Option<usize> {
        let gpus = self.gpus.lock().await;

        // First pass: DynamicPool GPUs with enough free VRAM
        for gpu in gpus.iter() {
            if matches!(gpu.role, GpuRole::DynamicPool) && gpu.free_vram_mb() >= vram_needed {
                return Some(gpu.id);
            }
        }

        // Second pass: AlwaysOn GPU (GPU 0) if it has room
        for gpu in gpus.iter() {
            if matches!(gpu.role, GpuRole::AlwaysOn) && gpu.free_vram_mb() >= vram_needed {
                return Some(gpu.id);
            }
        }

        None
    }

    /// Evict the least-recently-used model(s) from DynamicPool GPUs to free
    /// at least `vram_needed` MB.
    ///
    /// Returns the GPU ID that now has enough free VRAM.
    pub async fn evict_lru_from_pool(&self, vram_needed: u64) -> Result<usize> {
        let mut gpus = self.gpus.lock().await;

        // Collect all (gpu_id, model_index, last_used) from DynamicPool GPUs
        let mut candidates: Vec<(usize, usize, DateTime<Utc>, u64)> = Vec::new();
        for gpu in gpus.iter() {
            if matches!(gpu.role, GpuRole::DynamicPool) {
                for (idx, model) in gpu.loaded_models.iter().enumerate() {
                    candidates.push((gpu.id, idx, model.last_used, model.vram_mb));
                }
            }
        }

        if candidates.is_empty() {
            return Err(anyhow!(
                "No models in DynamicPool to evict (need {} MB)",
                vram_needed
            ));
        }

        // Sort by last_used ascending (oldest first = least recently used)
        candidates.sort_by_key(|(_, _, last_used, _)| *last_used);

        // Try to find a single GPU where evictions can free enough space
        // Strategy: prefer the GPU that needs the fewest evictions
        let pool_gpus: Vec<usize> = gpus
            .iter()
            .filter(|g| matches!(g.role, GpuRole::DynamicPool))
            .map(|g| g.id)
            .collect();

        for &gpu_id in &pool_gpus {
            let gpu = &gpus[gpu_id];
            let total_recoverable: u64 = gpu.loaded_models.iter().map(|m| m.vram_mb).sum();
            if gpu.free_vram_mb() + total_recoverable >= vram_needed {
                // This GPU can satisfy the request after evictions
                let mut freed = gpu.free_vram_mb();
                let mut to_evict: Vec<usize> = Vec::new();

                // Get models on this GPU sorted by last_used (LRU first)
                let mut gpu_models: Vec<(usize, DateTime<Utc>, u64)> = gpu
                    .loaded_models
                    .iter()
                    .enumerate()
                    .map(|(i, m)| (i, m.last_used, m.vram_mb))
                    .collect();
                gpu_models.sort_by_key(|(_, last_used, _)| *last_used);

                for (idx, _, model_vram) in &gpu_models {
                    if freed >= vram_needed {
                        break;
                    }
                    to_evict.push(*idx);
                    freed += model_vram;
                }

                if freed >= vram_needed {
                    // Evict in reverse index order to preserve indices
                    to_evict.sort_unstable_by(|a, b| b.cmp(a));
                    let gpu = &mut gpus[gpu_id];
                    for idx in to_evict {
                        let model = gpu.loaded_models.remove(idx);
                        gpu.used_vram_mb = gpu.used_vram_mb.saturating_sub(model.vram_mb);
                        tracing::info!(
                            "LRU evicted model '{}' from GPU {} (freed {} MB)",
                            model.model_id,
                            gpu_id,
                            model.vram_mb,
                        );
                    }
                    return Ok(gpu_id);
                }
            }
        }

        Err(anyhow!(
            "Cannot free {} MB of VRAM from DynamicPool GPUs",
            vram_needed
        ))
    }

    /// Update the `last_used` timestamp for a model (GPU or RAM).
    pub async fn touch_model(&self, model_id: &str) {
        let now = Utc::now();

        // Check RAM models first
        if let Some(mut entry) = self.ram_models.get_mut(model_id) {
            entry.last_used = now;
            return;
        }

        // Check GPU models
        let mut gpus = self.gpus.lock().await;
        for gpu in gpus.iter_mut() {
            if let Some(model) = gpu
                .loaded_models
                .iter_mut()
                .find(|m| m.model_id == model_id)
            {
                model.last_used = now;
                return;
            }
        }
    }

    /// Returns a reference to the detected hardware profile.
    pub fn hardware(&self) -> &HardwareProfile {
        &self.hardware
    }

    /// Returns a reference to the underlying model manager.
    pub fn model_manager(&self) -> &Arc<ModelManager> {
        &self.model_manager
    }
}
