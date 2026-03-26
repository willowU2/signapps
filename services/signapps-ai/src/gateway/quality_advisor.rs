use serde::Serialize;

use super::capability::Capability;

#[derive(Debug, Clone, Serialize)]
pub struct QualityAdvice {
    pub capability: Capability,
    pub local_quality: f32,
    pub cloud_quality: f32,
    pub recommendation: String,
    pub cloud_provider: Option<String>,
}

pub struct QualityAdvisor;
