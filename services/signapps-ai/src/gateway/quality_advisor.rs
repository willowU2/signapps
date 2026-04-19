use std::sync::Arc;

use serde::Serialize;

use super::capability::{BackendType, Capability};
use crate::workers::traits::AiWorker;

/// Advice comparing local vs cloud quality for a capability.
#[derive(Debug, Clone, Serialize)]
pub struct QualityAdvice {
    pub capability: Capability,
    pub local_quality: f32,
    pub cloud_quality: f32,
    pub gap: f32,
    pub recommendation: String,
    pub cloud_provider: Option<String>,
}

/// Compares local and cloud worker quality to advise on optimal routing.
#[derive(Default)]
pub struct QualityAdvisor;

impl QualityAdvisor {
    /// Create a new advisor.
    pub fn new() -> Self {
        Self
    }

    /// Compare local and cloud workers for a capability, returning advice
    /// on whether cloud is recommended.
    ///
    /// Returns `None` if there are no workers to compare.
    pub fn compare(&self, cap: Capability, workers: &[Arc<dyn AiWorker>]) -> Option<QualityAdvice> {
        if workers.is_empty() {
            return None;
        }

        let mut best_local: f32 = 0.0;
        let mut best_cloud: f32 = 0.0;
        let mut best_cloud_provider: Option<String> = None;

        for w in workers {
            let score = w.quality_score();
            match w.backend_type() {
                BackendType::Cloud { ref provider } => {
                    if score > best_cloud {
                        best_cloud = score;
                        best_cloud_provider = Some(provider.clone());
                    }
                },
                BackendType::Native | BackendType::Http { .. } => {
                    if score > best_local {
                        best_local = score;
                    }
                },
            }
        }

        // If there are no cloud workers and no local workers with scores,
        // still return advice with what we have.
        let gap = best_cloud - best_local;

        let recommendation = if gap > 0.3 {
            format!(
                "Cloud recommended for {} — cloud quality ({:.2}) significantly \
                 exceeds local ({:.2}), gap = {:.2}",
                cap.display_name(),
                best_cloud,
                best_local,
                gap,
            )
        } else if gap > 0.1 {
            format!(
                "Local quality is good for {} — local ({:.2}) vs cloud ({:.2}), \
                 gap = {:.2}. Consider cloud for best results.",
                cap.display_name(),
                best_local,
                best_cloud,
                gap,
            )
        } else {
            format!(
                "Local quality is excellent for {} — local ({:.2}) vs cloud ({:.2}), \
                 gap = {:.2}. No upgrade needed.",
                cap.display_name(),
                best_local,
                best_cloud,
                gap,
            )
        };

        Some(QualityAdvice {
            capability: cap,
            local_quality: best_local,
            cloud_quality: best_cloud,
            gap,
            recommendation,
            cloud_provider: best_cloud_provider,
        })
    }
}
