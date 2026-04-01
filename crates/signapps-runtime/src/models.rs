//! Model manager for downloading and caching AI models.

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::AsyncWriteExt;

use crate::gpu::{HardwareProfile, ModelTier};

/// Types of AI models.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ModelType {
    /// Speech-to-text transcription model.
    Stt,
    /// Text-to-speech synthesis model.
    Tts,
    /// Optical character recognition model.
    Ocr,
    /// Large language model.
    Llm,
    /// Text embedding model.
    Embeddings,
}

impl ModelType {
    /// Returns the subdirectory name used for caching models of this type.
    pub fn subdir(&self) -> &'static str {
        match self {
            Self::Stt => "stt",
            Self::Tts => "tts",
            Self::Ocr => "ocr",
            Self::Llm => "llm",
            Self::Embeddings => "embeddings",
        }
    }
}

/// Where a model comes from.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ModelSource {
    /// Download from a Hugging Face repository.
    HuggingFace {
        /// Hugging Face repository identifier (e.g. `"username/repo"`).
        repo_id: String,
        /// Filename within the repository to fetch.
        filename: String,
    },
    /// Download from an arbitrary HTTP URL.
    Url {
        /// Full URL to the model file.
        url: String,
    },
    /// Use a model already present on the local filesystem.
    LocalPath {
        /// Absolute or relative path to the model file.
        path: PathBuf,
    },
}

/// Model download/load status.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ModelStatus {
    /// Model is available for download but not yet fetched.
    Available,
    /// Model is currently downloading.
    Downloading {
        /// Download progress as a fraction in `[0.0, 1.0]`.
        progress: f32,
    },
    /// Model has been downloaded and is ready to load.
    Ready,
    /// Model is loaded into memory and ready for inference.
    Loaded,
    /// An error occurred during download or loading.
    Error {
        /// Human-readable error description.
        message: String,
    },
}

/// A model entry in the registry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelEntry {
    /// Unique identifier for the model (e.g. `"whisper-base"`).
    pub id: String,
    /// Category of AI task this model performs.
    pub model_type: ModelType,
    /// Where to obtain the model file.
    pub source: ModelSource,
    /// Expected file size in bytes (0 if unknown).
    pub size_bytes: u64,
    /// Current download / load status.
    pub status: ModelStatus,
    /// Absolute path to the cached model file once downloaded.
    pub local_path: Option<PathBuf>,
    /// Minimum VRAM in megabytes recommended to run this model.
    pub recommended_vram_mb: u64,
    /// Short human-readable description of the model.
    pub description: String,
}

/// Manages model downloads, caching, and selection.
#[derive(Clone)]
pub struct ModelManager {
    cache_dir: PathBuf,
    registry: Arc<DashMap<String, ModelEntry>>,
    client: reqwest::Client,
}

impl ModelManager {
    /// Create a new model manager.
    pub fn new(cache_dir: Option<PathBuf>) -> Self {
        let cache_dir = cache_dir.unwrap_or_else(|| {
            std::env::var("MODELS_DIR")
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from("./data/models"))
        });

        let manager = Self {
            cache_dir: cache_dir.clone(),
            registry: Arc::new(DashMap::new()),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(3600))
                .build()
                .expect("Failed to build HTTP client"),
        };

        // Register known models
        manager.register_builtin_models();

        // Check which models are already downloaded
        manager.scan_local_models();

        tracing::info!("Model manager initialized at {}", cache_dir.display());
        manager
    }

    /// Ensure a model is downloaded and return its local path.
    pub async fn ensure_model(&self, model_id: &str) -> Result<PathBuf, ModelError> {
        let entry = self
            .registry
            .get(model_id)
            .map(|e| e.value().clone())
            .ok_or_else(|| ModelError::NotFound(model_id.to_string()))?;

        // Already downloaded?
        if let Some(ref path) = entry.local_path {
            if path.exists() {
                return Ok(path.clone());
            }
        }

        // Check if already on disk (might have been downloaded outside)
        let expected_path = self.model_path(&entry);
        if expected_path.exists() {
            self.registry.alter(model_id, |_, mut e| {
                e.local_path = Some(expected_path.clone());
                e.status = ModelStatus::Ready;
                e
            });
            return Ok(expected_path);
        }

        // Download
        self.download_model(model_id).await?;

        self.registry
            .get(model_id)
            .and_then(|e| e.local_path.clone())
            .ok_or_else(|| ModelError::DownloadFailed("Download completed but path not set".into()))
    }

    /// Download a model.
    pub async fn download_model(&self, model_id: &str) -> Result<PathBuf, ModelError> {
        let entry = self
            .registry
            .get(model_id)
            .map(|e| e.value().clone())
            .ok_or_else(|| ModelError::NotFound(model_id.to_string()))?;

        let dest_path = self.model_path(&entry);

        // Create parent directories
        if let Some(parent) = dest_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| ModelError::IoError(format!("Failed to create directory: {}", e)))?;
        }

        // Update status
        self.registry.alter(model_id, |_, mut e| {
            e.status = ModelStatus::Downloading { progress: 0.0 };
            e
        });

        let url = match &entry.source {
            ModelSource::HuggingFace { repo_id, filename } => {
                format!(
                    "https://huggingface.co/{}/resolve/main/{}",
                    repo_id, filename
                )
            },
            ModelSource::Url { url } => url.clone(),
            ModelSource::LocalPath { path } => {
                // Just copy or symlink
                if path.exists() {
                    tokio::fs::copy(path, &dest_path)
                        .await
                        .map_err(|e| ModelError::IoError(format!("Failed to copy model: {}", e)))?;
                    self.registry.alter(model_id, |_, mut e| {
                        e.local_path = Some(dest_path.clone());
                        e.status = ModelStatus::Ready;
                        e
                    });
                    return Ok(dest_path);
                }
                return Err(ModelError::NotFound(format!(
                    "Local path not found: {}",
                    path.display()
                )));
            },
        };

        tracing::info!("Downloading model '{}' from {}", model_id, url);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| ModelError::DownloadFailed(format!("HTTP request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(ModelError::DownloadFailed(format!(
                "HTTP {}: {}",
                response.status(),
                url
            )));
        }

        let total_size = response.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;
        let mut file = tokio::fs::File::create(&dest_path)
            .await
            .map_err(|e| ModelError::IoError(format!("Failed to create file: {}", e)))?;

        let mut stream = response.bytes_stream();
        use futures_util::StreamExt;
        while let Some(chunk) = stream.next().await {
            let chunk = chunk
                .map_err(|e| ModelError::DownloadFailed(format!("Download stream error: {}", e)))?;
            file.write_all(&chunk)
                .await
                .map_err(|e| ModelError::IoError(format!("Write error: {}", e)))?;
            downloaded += chunk.len() as u64;

            if total_size > 0 {
                let progress = (downloaded as f32 / total_size as f32).min(1.0);
                let model_id_owned = model_id.to_string();
                self.registry.alter(&model_id_owned, |_, mut e| {
                    e.status = ModelStatus::Downloading { progress };
                    e
                });
            }
        }

        file.flush()
            .await
            .map_err(|e| ModelError::IoError(format!("Flush error: {}", e)))?;

        tracing::info!("Model '{}' downloaded ({} bytes)", model_id, downloaded);

        self.registry.alter(model_id, |_, mut e| {
            e.local_path = Some(dest_path.clone());
            e.status = ModelStatus::Ready;
            e
        });

        Ok(dest_path)
    }

    /// List models of a given type.
    pub fn list_models(&self, model_type: Option<ModelType>) -> Vec<ModelEntry> {
        self.registry
            .iter()
            .filter(|e| model_type.map_or(true, |t| e.model_type == t))
            .map(|e| e.value().clone())
            .collect()
    }

    /// Dynamically search HuggingFace for GGUF models.
    pub async fn search_huggingface(&self, query: &str) -> Result<Vec<ModelEntry>, ModelError> {
        let safe_query = urlencoding::encode(query);
        let url = format!(
            "https://huggingface.co/api/models?search={}&filter=gguf&sort=downloads&direction=-1&limit=15",
            safe_query
        );

        let response =
            self.client.get(&url).send().await.map_err(|e| {
                ModelError::IoError(format!("Failed to reach HuggingFace API: {}", e))
            })?;

        if !response.status().is_success() {
            return Err(ModelError::IoError(format!(
                "HF API returned {}",
                response.status()
            )));
        }

        let json_array: Vec<Value> = response.json().await.unwrap_or_default();
        let mut dynamic_models = Vec::new();

        for item in json_array {
            if let Some(repo_id) = item.get("id").and_then(|v| v.as_str()) {
                let downloads = item.get("downloads").and_then(|v| v.as_u64()).unwrap_or(0);
                let description = format!(
                    "Modèle GGUF communautaire dynamique ({} téléchargements)",
                    downloads
                );

                // Estimate that community dynamically found models require moderate VRAM (e.g., 5GB assuming ~7B Q4)
                // In a perfect world we would query the HF Tree API for each to find the exact .gguf size,
                // but for real-time search responsiveness over 15 results, a default assumption is safer immediately.
                let mut vram_estimate = 5000;
                let mut size_estimate = 4_500_000_000;

                // Simple heuristic on the model name
                let name_lower = repo_id.to_lowercase();
                if name_lower.contains("1.5b")
                    || name_lower.contains("0.5b")
                    || name_lower.contains("1b")
                {
                    vram_estimate = 2000;
                    size_estimate = 1_500_000_000;
                } else if name_lower.contains("3b") || name_lower.contains("4b") {
                    vram_estimate = 3500;
                    size_estimate = 2_500_000_000;
                } else if name_lower.contains("14b")
                    || name_lower.contains("12b")
                    || name_lower.contains("13b")
                {
                    vram_estimate = 10000;
                    size_estimate = 8_000_000_000;
                } else if name_lower.contains("32b") || name_lower.contains("70b") {
                    vram_estimate = 24000;
                    size_estimate = 19_000_000_000;
                }

                dynamic_models.push(ModelEntry {
                    id: repo_id
                        .split('/')
                        .next_back()
                        .unwrap_or(repo_id)
                        .to_string(), // Shorthand ID
                    model_type: ModelType::Llm, // Most searched GGUFs are LLMs
                    source: ModelSource::HuggingFace {
                        repo_id: repo_id.to_string(),
                        filename: "fastest_quantile_q4_k_m.gguf".to_string(), // Requires user to eventually map this to real file
                    },
                    size_bytes: size_estimate,
                    status: ModelStatus::Available,
                    local_path: None,
                    recommended_vram_mb: vram_estimate,
                    description,
                });
            }
        }

        Ok(dynamic_models)
    }

    /// Delete a downloaded model.
    pub async fn delete_model(&self, model_id: &str) -> Result<(), ModelError> {
        let entry = self
            .registry
            .get(model_id)
            .map(|e| e.value().clone())
            .ok_or_else(|| ModelError::NotFound(model_id.to_string()))?;

        if let Some(ref path) = entry.local_path {
            if path.exists() {
                tokio::fs::remove_file(path)
                    .await
                    .map_err(|e| ModelError::IoError(format!("Failed to delete: {}", e)))?;
            }
        }

        self.registry.alter(model_id, |_, mut e| {
            e.local_path = None;
            e.status = ModelStatus::Available;
            e
        });

        Ok(())
    }

    /// Recommend a model for a given type based on hardware.
    pub fn recommend_model(
        &self,
        model_type: ModelType,
        hardware: &HardwareProfile,
    ) -> Option<String> {
        let tier = hardware.recommend_tier();
        match model_type {
            ModelType::Stt => Some(
                match tier {
                    ModelTier::Large => "whisper-large-v3",
                    ModelTier::Medium => "whisper-medium",
                    ModelTier::Small => "whisper-base",
                }
                .to_string(),
            ),
            ModelType::Tts => Some("piper-fr-siwis-medium".to_string()),
            ModelType::Ocr => Some("ocrs-text-detection".to_string()),
            ModelType::Llm => Some(
                match tier {
                    ModelTier::Large => "llama-3.1-8b-q4",
                    ModelTier::Medium => "llama-3.2-3b-q4",
                    ModelTier::Small => "llama-3.2-1b-q8",
                }
                .to_string(),
            ),
            ModelType::Embeddings => Some("nomic-embed-text-v1.5".to_string()),
        }
    }

    /// Get model entry.
    pub fn get_model(&self, model_id: &str) -> Option<ModelEntry> {
        self.registry.get(model_id).map(|e| e.value().clone())
    }

    /// Register a custom model.
    pub fn register_model(&self, entry: ModelEntry) {
        self.registry.insert(entry.id.clone(), entry);
    }

    fn model_path(&self, entry: &ModelEntry) -> PathBuf {
        let filename = match &entry.source {
            ModelSource::HuggingFace { filename, .. } => filename.clone(),
            ModelSource::Url { url } => url.rsplit('/').next().unwrap_or("model.bin").to_string(),
            ModelSource::LocalPath { path } => path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "model.bin".to_string()),
        };
        self.cache_dir
            .join(entry.model_type.subdir())
            .join(&filename)
    }

    fn scan_local_models(&self) {
        for mut entry in self.registry.iter_mut() {
            let path = self.model_path(entry.value());
            if path.exists() {
                entry.local_path = Some(path);
                entry.status = ModelStatus::Ready;
            }
        }
    }

    fn register_builtin_models(&self) {
        // STT (Whisper) models
        let whisper_models = [
            (
                "whisper-base",
                "ggerganov/whisper.cpp",
                "ggml-base.bin",
                148_000_000u64,
                0,
                "Whisper Base - fastest, English-focused",
            ),
            (
                "whisper-small",
                "ggerganov/whisper.cpp",
                "ggml-small.bin",
                488_000_000,
                1024,
                "Whisper Small - good multilingual",
            ),
            (
                "whisper-medium",
                "ggerganov/whisper.cpp",
                "ggml-medium.bin",
                1_533_000_000,
                2048,
                "Whisper Medium - better accuracy",
            ),
            (
                "whisper-large-v3",
                "ggerganov/whisper.cpp",
                "ggml-large-v3.bin",
                3_094_000_000,
                4096,
                "Whisper Large V3 - best accuracy, needs GPU",
            ),
        ];

        for (id, repo, file, size, vram, desc) in whisper_models {
            self.registry.insert(
                id.to_string(),
                ModelEntry {
                    id: id.to_string(),
                    model_type: ModelType::Stt,
                    source: ModelSource::HuggingFace {
                        repo_id: repo.to_string(),
                        filename: file.to_string(),
                    },
                    size_bytes: size,
                    status: ModelStatus::Available,
                    local_path: None,
                    recommended_vram_mb: vram,
                    description: desc.to_string(),
                },
            );
        }

        // TTS (Piper) models
        let piper_voices = [
            (
                "piper-fr-siwis-medium",
                "rhasspy/piper-voices",
                "fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx",
                63_000_000u64,
                "French female voice - Siwis medium quality",
            ),
            (
                "piper-fr-siwis-medium-config",
                "rhasspy/piper-voices",
                "fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx.json",
                500,
                "Config for Siwis medium voice",
            ),
            (
                "piper-en-lessac-medium",
                "rhasspy/piper-voices",
                "en/en_US/lessac/medium/en_US-lessac-medium.onnx",
                63_000_000,
                "English US female voice - Lessac medium",
            ),
            (
                "piper-en-lessac-medium-config",
                "rhasspy/piper-voices",
                "en/en_US/lessac/medium/en_US-lessac-medium.onnx.json",
                500,
                "Config for Lessac medium voice",
            ),
        ];

        for (id, repo, file, size, desc) in piper_voices {
            self.registry.insert(
                id.to_string(),
                ModelEntry {
                    id: id.to_string(),
                    model_type: ModelType::Tts,
                    source: ModelSource::HuggingFace {
                        repo_id: repo.to_string(),
                        filename: file.to_string(),
                    },
                    size_bytes: size,
                    status: ModelStatus::Available,
                    local_path: None,
                    recommended_vram_mb: 0,
                    description: desc.to_string(),
                },
            );
        }

        // OCR models (ocrs)
        let ocr_models = [
            (
                "ocrs-text-detection",
                "robertknight/ocrs",
                "text-detection-ssfbcj81.rten",
                4_200_000u64,
                "Text detection ONNX model for ocrs",
            ),
            (
                "ocrs-text-recognition",
                "robertknight/ocrs",
                "text-rec-checkpoint-s52qdbqt.rten",
                13_000_000,
                "Text recognition ONNX model for ocrs",
            ),
        ];

        for (id, repo, file, size, desc) in ocr_models {
            self.registry.insert(
                id.to_string(),
                ModelEntry {
                    id: id.to_string(),
                    model_type: ModelType::Ocr,
                    source: ModelSource::HuggingFace {
                        repo_id: repo.to_string(),
                        filename: file.to_string(),
                    },
                    size_bytes: size,
                    status: ModelStatus::Available,
                    local_path: None,
                    recommended_vram_mb: 0,
                    description: desc.to_string(),
                },
            );
        }

        // LLM (GGUF) models — sorted by size (tiny → XXL)
        let llm_models: [(&str, &str, &str, u64, u64, &str); 18] = [
            // --- Tiny (CPU, < 1 GB) ---
            (
                "qwen2.5-0.5b-q8",
                "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
                "qwen2.5-0.5b-instruct-q8_0.gguf",
                530_000_000,
                0,
                "Qwen 2.5 0.5B Q8 - ultra-leger, CPU, multilingue",
            ),
            // --- Small (1-2 GB) ---
            (
                "qwen2.5-1.5b-q4",
                "Qwen/Qwen2.5-1.5B-Instruct-GGUF",
                "qwen2.5-1.5b-instruct-q4_k_m.gguf",
                1_000_000_000,
                0,
                "Qwen 2.5 1.5B Q4 - compact, multilingue, CPU",
            ),
            (
                "llama-3.2-1b-q8",
                "bartowski/Llama-3.2-1B-Instruct-GGUF",
                "Llama-3.2-1B-Instruct-Q8_0.gguf",
                1_320_000_000,
                0,
                "Llama 3.2 1B Q8 - rapide, tourne sur CPU",
            ),
            // --- Medium (2-3 GB) ---
            (
                "gemma-2-2b-q4",
                "bartowski/gemma-2-2b-it-GGUF",
                "gemma-2-2b-it-Q4_K_M.gguf",
                1_500_000_000,
                2048,
                "Gemma 2 2B Q4 - Google, compact et performant",
            ),
            (
                "llama-3.2-3b-q4",
                "bartowski/Llama-3.2-3B-Instruct-GGUF",
                "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
                2_020_000_000,
                2048,
                "Llama 3.2 3B Q4 - bon equilibre vitesse/qualite",
            ),
            (
                "qwen2.5-3b-q4",
                "Qwen/Qwen2.5-3B-Instruct-GGUF",
                "qwen2.5-3b-instruct-q4_k_m.gguf",
                2_070_000_000,
                2048,
                "Qwen 2.5 3B Q4 - multilingue, polyvalent",
            ),
            (
                "phi-3.5-mini-q4",
                "bartowski/Phi-3.5-mini-instruct-GGUF",
                "Phi-3.5-mini-instruct-Q4_K_M.gguf",
                2_400_000_000,
                3072,
                "Phi 3.5 Mini 3.8B Q4 - excellent ratio qualite/taille",
            ),
            // --- Large (4-6 GB) ---
            (
                "mistral-7b-v0.3-q4",
                "bartowski/Mistral-7B-Instruct-v0.3-GGUF",
                "Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
                4_370_000_000,
                5120,
                "Mistral 7B v0.3 Q4 - generaliste francais/anglais",
            ),
            (
                "qwen2.5-7b-q4",
                "Qwen/Qwen2.5-7B-Instruct-GGUF",
                "qwen2.5-7b-instruct-q4_k_m.gguf",
                4_680_000_000,
                6144,
                "Qwen 2.5 7B Q4 - excellent multilingue, 6 GB VRAM",
            ),
            (
                "qwen2.5-coder-7b-q4",
                "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF",
                "qwen2.5-coder-7b-instruct-q4_k_m.gguf",
                4_680_000_000,
                6144,
                "Qwen 2.5 Coder 7B Q4 - specialise code, 6 GB VRAM",
            ),
            (
                "llama-3.1-8b-q4",
                "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF",
                "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
                4_920_000_000,
                6144,
                "Llama 3.1 8B Q4 - excellent generaliste, multilingue",
            ),
            // --- XL (6-10 GB) ---
            (
                "gemma-2-9b-q4",
                "bartowski/gemma-2-9b-it-GGUF",
                "gemma-2-9b-it-Q4_K_M.gguf",
                5_760_000_000,
                7168,
                "Gemma 2 9B Q4 - Google, tres performant, 7 GB VRAM",
            ),
            (
                "mistral-nemo-12b-q4",
                "bartowski/Mistral-Nemo-Instruct-2407-GGUF",
                "Mistral-Nemo-Instruct-2407-Q4_K_M.gguf",
                7_000_000_000,
                8192,
                "Mistral Nemo 12B Q4 - haute qualite, 8 GB VRAM",
            ),
            (
                "qwen2.5-14b-q4",
                "Qwen/Qwen2.5-14B-Instruct-GGUF",
                "qwen2.5-14b-instruct-q4_k_m.gguf",
                8_700_000_000,
                10240,
                "Qwen 2.5 14B Q4 - quasi-GPT-4, 10 GB VRAM",
            ),
            // --- XXL (> 10 GB) ---
            (
                "qwen2.5-32b-q4",
                "Qwen/Qwen2.5-32B-Instruct-GGUF",
                "qwen2.5-32b-instruct-q4_k_m.gguf",
                19_800_000_000,
                22528,
                "Qwen 2.5 32B Q4 - niveau GPT-4, 22 GB VRAM",
            ),
            (
                "qwen2.5-coder-32b-q4",
                "Qwen/Qwen2.5-Coder-32B-Instruct-GGUF",
                "qwen2.5-coder-32b-instruct-q4_k_m.gguf",
                19_800_000_000,
                22528,
                "Qwen 2.5 Coder 32B Q4 - top code, 22 GB VRAM",
            ),
            (
                "llama-3.1-70b-q4",
                "bartowski/Meta-Llama-3.1-70B-Instruct-GGUF",
                "Meta-Llama-3.1-70B-Instruct-Q4_K_M.gguf",
                40_800_000_000,
                44032,
                "Llama 3.1 70B Q4 - meilleur open-source, 44 GB VRAM",
            ),
            (
                "llama-3.3-70b-q4",
                "bartowski/Llama-3.3-70B-Instruct-GGUF",
                "Llama-3.3-70B-Instruct-Q4_K_M.gguf",
                40_800_000_000,
                44032,
                "Llama 3.3 70B Q4 - derniere version, 44 GB VRAM",
            ),
        ];

        for (id, repo, file, size, vram, desc) in llm_models {
            self.registry.insert(
                id.to_string(),
                ModelEntry {
                    id: id.to_string(),
                    model_type: ModelType::Llm,
                    source: ModelSource::HuggingFace {
                        repo_id: repo.to_string(),
                        filename: file.to_string(),
                    },
                    size_bytes: size,
                    status: ModelStatus::Available,
                    local_path: None,
                    recommended_vram_mb: vram,
                    description: desc.to_string(),
                },
            );
        }

        // Embeddings models
        self.registry.insert(
            "nomic-embed-text-v1.5".to_string(),
            ModelEntry {
                id: "nomic-embed-text-v1.5".to_string(),
                model_type: ModelType::Embeddings,
                source: ModelSource::HuggingFace {
                    repo_id: "nomic-ai/nomic-embed-text-v1.5-GGUF".to_string(),
                    filename: "nomic-embed-text-v1.5.Q8_0.gguf".to_string(),
                },
                size_bytes: 141_000_000,
                status: ModelStatus::Available,
                local_path: None,
                recommended_vram_mb: 0,
                description: "Nomic Embed Text v1.5 - 768-dim embeddings".to_string(),
            },
        );
    }
}

impl std::fmt::Debug for ModelManager {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ModelManager")
            .field("cache_dir", &self.cache_dir)
            .field("models_count", &self.registry.len())
            .finish()
    }
}

#[derive(Debug, thiserror::Error)]
/// Error type for Model operations.
pub enum ModelError {
    /// The requested model ID does not exist in the registry.
    #[error("Model not found: {0}")]
    NotFound(String),

    /// The model download failed (network error, checksum mismatch, etc.).
    #[error("Download failed: {0}")]
    DownloadFailed(String),

    /// A filesystem I/O error occurred while reading or writing the model.
    #[error("IO error: {0}")]
    IoError(String),
}
