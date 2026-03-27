use std::collections::HashMap;
use std::sync::Arc;

use anyhow::{anyhow, Result};
use tokio::sync::RwLock;
use tracing::info;

use crate::gateway::capability::{BackendInfo, BackendType, Capability, CapabilityInfo};
use crate::gateway::quality_advisor::{QualityAdvice, QualityAdvisor};
use crate::models::ModelOrchestrator;
use crate::workers::traits::AiWorker;

/// Routes AI requests to the best available worker for each capability.
///
/// Workers are registered per capability and selected based on health,
/// backend priority (Native > Http > Cloud), and quality scores.
pub struct GatewayRouter {
    workers: RwLock<HashMap<Capability, Vec<Arc<dyn AiWorker>>>>,
    orchestrator: Arc<ModelOrchestrator>,
    advisor: QualityAdvisor,
}

impl GatewayRouter {
    /// Create a new router backed by the given model orchestrator.
    pub fn new(orchestrator: Arc<ModelOrchestrator>) -> Self {
        Self {
            workers: RwLock::new(HashMap::new()),
            orchestrator,
            advisor: QualityAdvisor::new(),
        }
    }

    /// Register a worker. It will be added to the list for its capability.
    pub async fn register(&self, worker: Arc<dyn AiWorker>) {
        let cap = worker.capability();
        let backend = worker.backend_type();
        info!(
            "Registering {:?} worker for {:?} (quality={:.2})",
            backend,
            cap,
            worker.quality_score(),
        );
        let mut map = self.workers.write().await;
        map.entry(cap).or_default().push(worker);
    }

    /// Route a request to the best healthy worker for the given capability.
    ///
    /// Priority order: Native > Http > Cloud, unless a cloud worker's quality
    /// exceeds the best local worker's quality by more than 0.3.
    pub async fn route(&self, cap: Capability) -> Result<Arc<dyn AiWorker>> {
        let map = self.workers.read().await;
        let workers = map
            .get(&cap)
            .ok_or_else(|| anyhow!("No workers registered for {:?}", cap))?;

        if workers.is_empty() {
            return Err(anyhow!("No workers registered for {:?}", cap));
        }

        // Filter to healthy workers
        let mut healthy: Vec<Arc<dyn AiWorker>> = Vec::new();
        for w in workers {
            if w.health_check().await {
                healthy.push(Arc::clone(w));
            }
        }

        if healthy.is_empty() {
            return Err(anyhow!("No healthy workers available for {:?}", cap));
        }

        // Find the best local quality score (Native or Http)
        let best_local_quality = healthy
            .iter()
            .filter(|w| !matches!(w.backend_type(), BackendType::Cloud { .. }))
            .map(|w| w.quality_score())
            .fold(0.0_f32, f32::max);

        // Sort by priority: Native > Http > Cloud
        // But if a cloud worker's quality exceeds the best local by > 0.3,
        // it gets promoted above local workers.
        healthy.sort_by(|a, b| {
            let priority_a =
                backend_priority(&a.backend_type(), a.quality_score(), best_local_quality);
            let priority_b =
                backend_priority(&b.backend_type(), b.quality_score(), best_local_quality);
            // Lower priority number = better
            priority_a
                .partial_cmp(&priority_b)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        Ok(Arc::clone(&healthy[0]))
    }

    /// Get quality advice for a capability, comparing local vs cloud workers.
    pub async fn quality_advice(&self, cap: Capability) -> Option<QualityAdvice> {
        let map = self.workers.read().await;
        let workers = map.get(&cap)?;
        if workers.is_empty() {
            return None;
        }
        self.advisor.compare(cap, workers)
    }

    /// List all capabilities with detailed backend information.
    pub async fn list_capabilities(&self) -> Vec<CapabilityInfo> {
        let map = self.workers.read().await;
        let mut result = Vec::new();

        for cap in Capability::all() {
            let workers = match map.get(cap) {
                Some(ws) if !ws.is_empty() => ws,
                _ => continue,
            };

            let mut backends = Vec::new();
            let mut best_local_quality: f32 = 0.0;
            let mut best_cloud_quality: f32 = 0.0;
            let mut gpu_loaded = false;
            let mut max_vram: u64 = 0;
            let mut active_backend: Option<String> = None;

            for w in workers {
                let score = w.quality_score();
                let bt = w.backend_type();
                let available = w.health_check().await;

                let name = match &bt {
                    BackendType::Native => "native".to_string(),
                    BackendType::Http { url } => format!("http({})", url),
                    BackendType::Cloud { provider } => {
                        format!("cloud({})", provider)
                    },
                };

                match &bt {
                    BackendType::Cloud { .. } => {
                        if score > best_cloud_quality {
                            best_cloud_quality = score;
                        }
                    },
                    _ => {
                        if score > best_local_quality {
                            best_local_quality = score;
                        }
                    },
                }

                if w.is_loaded() {
                    gpu_loaded = true;
                    if active_backend.is_none() {
                        active_backend = Some(name.clone());
                    }
                }

                let vram = w.required_vram_mb();
                if vram > max_vram {
                    max_vram = vram;
                }

                backends.push(BackendInfo {
                    name,
                    backend_type: bt,
                    quality_score: score,
                    available,
                });
            }

            let upgrade_recommended = (best_cloud_quality - best_local_quality) > 0.3;

            result.push(CapabilityInfo {
                capability: *cap,
                available: backends.iter().any(|b| b.available),
                backends,
                active_backend,
                local_quality: best_local_quality,
                cloud_quality: best_cloud_quality,
                upgrade_recommended,
                gpu_loaded,
                vram_required_mb: max_vram,
            });
        }

        result
    }

    /// Returns a reference to the model orchestrator.
    pub fn orchestrator(&self) -> &Arc<ModelOrchestrator> {
        &self.orchestrator
    }
}

/// Returns a numeric priority for sorting. Lower = better.
///
/// Native = 0, Http = 1, Cloud = 2.
/// Exception: if a cloud worker's quality exceeds the best local quality by
/// more than 0.3, it gets priority 0 (promoted above local).
fn backend_priority(bt: &BackendType, quality: f32, best_local_quality: f32) -> f32 {
    match bt {
        BackendType::Native => 0.0,
        BackendType::Http { .. } => 1.0,
        BackendType::Cloud { .. } => {
            if (quality - best_local_quality) > 0.3 {
                // Cloud quality significantly better — promote it
                0.0
            } else {
                2.0
            }
        },
    }
}
