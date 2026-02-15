//! LlamaCpp provider - native GGUF inference via llama-cpp-2.

use async_trait::async_trait;
use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::LlamaModel;
use llama_cpp_2::sampling::LlamaSampler;
use llama_cpp_2::token::data_array::LlamaTokenDataArray;
use signapps_common::{Error, Result};
use signapps_runtime::{HardwareProfile, InferenceBackend, ModelManager};
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};

use super::providers::{LlmProvider, LlmProviderType};
use super::types::*;

/// Native LLM provider using llama.cpp via llama-cpp-2 bindings.
pub struct LlamaCppProvider {
    backend: Arc<LlamaBackend>,
    model: Arc<LlamaModel>,
    model_name: String,
    context_size: u32,
    gpu_layers: i32,
    #[allow(dead_code)]
    model_manager: Arc<ModelManager>,
}

impl LlamaCppProvider {
    /// Create a new LlamaCpp provider.
    pub async fn new(
        model_path: &str,
        model_manager: Arc<ModelManager>,
        hardware: &HardwareProfile,
    ) -> Result<Self> {
        let context_size: u32 = std::env::var("LLAMACPP_CONTEXT_SIZE")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(4096);

        // Auto-calculate GPU layers based on VRAM
        let gpu_layers = match std::env::var("LLAMACPP_GPU_LAYERS") {
            Ok(ref s) if s != "auto" => s.parse::<i32>().unwrap_or(0),
            _ => auto_gpu_layers(hardware),
        };

        let model_path_resolved = if std::path::Path::new(model_path).exists() {
            model_path.to_string()
        } else {
            // Try model manager
            model_manager
                .ensure_model(model_path)
                .await
                .map_err(|e| Error::Internal(format!("Model load failed: {}", e)))?
                .to_string_lossy()
                .to_string()
        };

        tracing::info!(
            "Loading GGUF model '{}' (ctx={}, gpu_layers={}, backend={})",
            model_path,
            context_size,
            gpu_layers,
            hardware.preferred_backend
        );

        let model_path_clone = model_path_resolved.clone();
        let model_name = model_path.to_string();

        let (backend, model) = tokio::task::spawn_blocking(move || {
            let backend = LlamaBackend::init()
                .map_err(|e| Error::Internal(format!("Backend init: {}", e)))?;

            let mut model_params = LlamaModelParams::default();
            model_params = model_params.with_n_gpu_layers(gpu_layers as u32);

            let model = LlamaModel::load_from_file(&backend, &model_path_clone, &model_params)
                .map_err(|e| Error::Internal(format!("Model load: {}", e)))?;

            Ok::<_, Error>((backend, model))
        })
        .await
        .map_err(|e| Error::Internal(format!("Task join error: {}", e)))??;

        tracing::info!("GGUF model loaded successfully");

        Ok(Self {
            backend: Arc::new(backend),
            model: Arc::new(model),
            model_name,
            context_size,
            gpu_layers,
            model_manager,
        })
    }
}

#[async_trait]
impl LlmProvider for LlamaCppProvider {
    fn provider_type(&self) -> LlmProviderType {
        LlmProviderType::LlamaCpp
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        let mut models = Vec::new();

        // Currently loaded model
        models.push(ModelInfo {
            id: self.model_name.clone(),
            object: "model".to_string(),
            owned_by: "llamacpp".to_string(),
        });

        // Add ready/available LLM models from model manager
        let local_llm_models = self
            .model_manager
            .list_models(Some(signapps_runtime::ModelType::Llm));
        for entry in local_llm_models {
            if entry.id != self.model_name {
                let status_str = match &entry.status {
                    signapps_runtime::ModelStatus::Ready
                    | signapps_runtime::ModelStatus::Loaded => "model",
                    signapps_runtime::ModelStatus::Available => "model.available",
                    _ => continue,
                };
                models.push(ModelInfo {
                    id: entry.id,
                    object: status_str.to_string(),
                    owned_by: "llamacpp".to_string(),
                });
            }
        }

        Ok(models)
    }

    async fn chat(
        &self,
        messages: Vec<ChatMessage>,
        _model: Option<&str>,
        max_tokens: Option<u32>,
        temperature: Option<f32>,
    ) -> Result<ChatResponse> {
        let max_tokens = max_tokens.unwrap_or(1024);
        let temperature = temperature.unwrap_or(0.7);
        let model = self.model.clone();
        let backend = self.backend.clone();
        let context_size = self.context_size;
        let model_name = self.model_name.clone();

        let result = tokio::task::spawn_blocking(move || {
            generate_response(
                &backend,
                &model,
                &messages,
                max_tokens,
                temperature,
                context_size,
            )
        })
        .await
        .map_err(|e| Error::Internal(format!("Task join error: {}", e)))??;

        Ok(ChatResponse {
            id: format!("llamacpp-{}", uuid::Uuid::new_v4()),
            object: "chat.completion".to_string(),
            created: chrono::Utc::now().timestamp(),
            model: model_name,
            choices: vec![ChatChoice {
                index: 0,
                message: ChatMessage::assistant(result),
                finish_reason: Some("stop".to_string()),
            }],
            usage: None,
        })
    }

    async fn chat_stream(
        &self,
        messages: Vec<ChatMessage>,
        _model: Option<&str>,
        max_tokens: Option<u32>,
        temperature: Option<f32>,
    ) -> Result<mpsc::Receiver<Result<String>>> {
        let max_tokens = max_tokens.unwrap_or(1024);
        let temperature = temperature.unwrap_or(0.7);
        let model = self.model.clone();
        let backend = self.backend.clone();
        let context_size = self.context_size;

        let (tx, rx) = mpsc::channel(100);

        tokio::task::spawn_blocking(move || {
            if let Err(e) = generate_response_streaming(
                &backend,
                &model,
                &messages,
                max_tokens,
                temperature,
                context_size,
                &tx,
            ) {
                let _ = tx.blocking_send(Err(e));
            }
        });

        Ok(rx)
    }

    async fn health_check(&self) -> Result<bool> {
        Ok(true)
    }
}

fn format_prompt(messages: &[ChatMessage]) -> String {
    // ChatML format
    let mut prompt = String::new();
    for msg in messages {
        let role = match msg.role {
            Role::System => "system",
            Role::User => "user",
            Role::Assistant => "assistant",
        };
        prompt.push_str(&format!(
            "<|im_start|>{}\n{}<|im_end|>\n",
            role, msg.content
        ));
    }
    prompt.push_str("<|im_start|>assistant\n");
    prompt
}

fn generate_response(
    _backend: &LlamaBackend,
    model: &LlamaModel,
    messages: &[ChatMessage],
    max_tokens: u32,
    temperature: f32,
    context_size: u32,
) -> Result<String> {
    let prompt = format_prompt(messages);

    let ctx_params =
        LlamaContextParams::default().with_n_ctx(std::num::NonZeroU32::new(context_size));
    let mut ctx = model
        .new_context(_backend, ctx_params)
        .map_err(|e| Error::Internal(format!("Context creation: {}", e)))?;

    let tokens = model
        .str_to_token(&prompt, llama_cpp_2::model::AddBos::Always)
        .map_err(|e| Error::Internal(format!("Tokenization: {}", e)))?;

    let mut batch = LlamaBatch::new(context_size as usize, 1);
    for (i, &token) in tokens.iter().enumerate() {
        let is_last = i == tokens.len() - 1;
        batch
            .add(token, i as i32, &[0], is_last)
            .map_err(|e| Error::Internal(format!("Batch add: {}", e)))?;
    }

    ctx.decode(&mut batch)
        .map_err(|e| Error::Internal(format!("Initial decode: {}", e)))?;

    let mut output = String::new();
    let mut n_cur = tokens.len() as i32;

    let mut sampler =
        LlamaSampler::chain_simple([LlamaSampler::temp(temperature), LlamaSampler::dist(42)]);

    for _ in 0..max_tokens {
        let token = sampler.sample(&ctx, -1);

        if model.is_eog_token(token) {
            break;
        }

        let piece = model
            .token_to_str(token, llama_cpp_2::model::Special::Tokenize)
            .map_err(|e| Error::Internal(format!("Token decode: {}", e)))?;

        // Stop at end-of-turn markers
        if piece.contains("<|im_end|>") || piece.contains("<|endoftext|>") {
            break;
        }

        output.push_str(&piece);

        batch.clear();
        batch
            .add(token, n_cur, &[0], true)
            .map_err(|e| Error::Internal(format!("Batch add: {}", e)))?;

        ctx.decode(&mut batch)
            .map_err(|e| Error::Internal(format!("Decode step: {}", e)))?;

        n_cur += 1;
    }

    Ok(output.trim().to_string())
}

fn generate_response_streaming(
    _backend: &LlamaBackend,
    model: &LlamaModel,
    messages: &[ChatMessage],
    max_tokens: u32,
    temperature: f32,
    context_size: u32,
    tx: &mpsc::Sender<Result<String>>,
) -> Result<()> {
    let prompt = format_prompt(messages);

    let ctx_params =
        LlamaContextParams::default().with_n_ctx(std::num::NonZeroU32::new(context_size));
    let mut ctx = model
        .new_context(_backend, ctx_params)
        .map_err(|e| Error::Internal(format!("Context creation: {}", e)))?;

    let tokens = model
        .str_to_token(&prompt, llama_cpp_2::model::AddBos::Always)
        .map_err(|e| Error::Internal(format!("Tokenization: {}", e)))?;

    let mut batch = LlamaBatch::new(context_size as usize, 1);
    for (i, &token) in tokens.iter().enumerate() {
        let is_last = i == tokens.len() - 1;
        batch
            .add(token, i as i32, &[0], is_last)
            .map_err(|e| Error::Internal(format!("Batch add: {}", e)))?;
    }

    ctx.decode(&mut batch)
        .map_err(|e| Error::Internal(format!("Initial decode: {}", e)))?;

    let mut n_cur = tokens.len() as i32;

    let mut sampler =
        LlamaSampler::chain_simple([LlamaSampler::temp(temperature), LlamaSampler::dist(42)]);

    for _ in 0..max_tokens {
        let token = sampler.sample(&ctx, -1);

        if model.is_eog_token(token) {
            break;
        }

        let piece = model
            .token_to_str(token, llama_cpp_2::model::Special::Tokenize)
            .map_err(|e| Error::Internal(format!("Token decode: {}", e)))?;

        if piece.contains("<|im_end|>") || piece.contains("<|endoftext|>") {
            break;
        }

        if tx.blocking_send(Ok(piece)).is_err() {
            break; // Receiver dropped
        }

        batch.clear();
        batch
            .add(token, n_cur, &[0], true)
            .map_err(|e| Error::Internal(format!("Batch add: {}", e)))?;

        ctx.decode(&mut batch)
            .map_err(|e| Error::Internal(format!("Decode step: {}", e)))?;

        n_cur += 1;
    }

    Ok(())
}

fn auto_gpu_layers(hardware: &HardwareProfile) -> i32 {
    match &hardware.preferred_backend {
        InferenceBackend::Cpu => 0,
        _ => {
            // Estimate: ~100 MB per layer for 7B, more layers for more VRAM
            if hardware.total_vram_mb >= 8000 {
                99 // All layers
            } else if hardware.total_vram_mb >= 4000 {
                32
            } else if hardware.total_vram_mb >= 2000 {
                16
            } else {
                0
            }
        },
    }
}
