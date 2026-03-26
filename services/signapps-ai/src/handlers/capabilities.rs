//! Capability listing and quality advice endpoints.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};

use crate::gateway::{Capability, CapabilityInfo, QualityAdvice};
use crate::AppState;

/// Parse a capability name string into a `Capability` enum variant.
fn parse_capability(s: &str) -> Result<Capability, (StatusCode, String)> {
    match s.to_lowercase().as_str() {
        "llm" => Ok(Capability::Llm),
        "vision" => Ok(Capability::Vision),
        "image_gen" | "imagegen" => Ok(Capability::ImageGen),
        "video_gen" | "videogen" => Ok(Capability::VideoGen),
        "video_understand" | "videounderstand" => Ok(Capability::VideoUnderstand),
        "audio_gen" | "audiogen" => Ok(Capability::AudioGen),
        "rerank" => Ok(Capability::Rerank),
        "doc_parse" | "docparse" => Ok(Capability::DocParse),
        "text_embed" | "textembed" => Ok(Capability::TextEmbed),
        "multimodal_embed" | "multimodalembed" => Ok(Capability::MultimodalEmbed),
        _ => Err((
            StatusCode::BAD_REQUEST,
            format!(
                "Unknown capability '{}'. Valid values: llm, vision, image_gen, \
                 video_gen, video_understand, audio_gen, rerank, doc_parse, \
                 text_embed, multimodal_embed",
                s
            ),
        )),
    }
}

/// List all registered capabilities with backend information.
pub async fn list_capabilities(
    State(state): State<AppState>,
) -> Result<Json<Vec<CapabilityInfo>>, (StatusCode, String)> {
    let gateway = state.gateway.as_ref().ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        "Gateway not initialized".to_string(),
    ))?;

    let capabilities = gateway.list_capabilities().await;
    Ok(Json(capabilities))
}

/// Get quality advice for a specific capability (local vs cloud comparison).
pub async fn get_capability_advice(
    State(state): State<AppState>,
    Path(cap_name): Path<String>,
) -> Result<Json<QualityAdvice>, (StatusCode, String)> {
    let gateway = state.gateway.as_ref().ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        "Gateway not initialized".to_string(),
    ))?;

    let cap = parse_capability(&cap_name)?;

    let advice = gateway.quality_advice(cap).await.ok_or((
        StatusCode::NOT_FOUND,
        format!(
            "No workers registered for capability '{}'",
            cap.display_name()
        ),
    ))?;

    Ok(Json(advice))
}
