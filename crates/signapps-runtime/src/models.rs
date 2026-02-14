//! Model manager for downloading and caching AI models.

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::AsyncWriteExt;

use crate::gpu::{HardwareProfile, ModelTier};

/// Types of AI models.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ModelType {
    Stt,
    Tts,
    Ocr,
    Llm,
    Embeddings,
}

impl ModelType {
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
    HuggingFace {
        repo_id: String,
        filename: String,
    },
    Url {
        url: String,
    },
    LocalPath {
        path: PathBuf,
    },
}

/// Model download/load status.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ModelStatus {
    Available,
    Downloading { progress: f32 },
    Ready,
    Loaded,
    Error { message: String },
}

/// A model entry in the registry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelEntry {
    pub id: String,
    pub model_type: ModelType,
    pub source: ModelSource,
    pub size_bytes: u64,
    pub status: ModelStatus,
    pub local_path: Option<PathBuf>,
    pub recommended_vram_mb: u64,
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
            tokio::fs::create_dir_all(parent).await.map_err(|e| {
                ModelError::IoError(format!("Failed to create directory: {}", e))
            })?;
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
            }
            ModelSource::Url { url } => url.clone(),
            ModelSource::LocalPath { path } => {
                // Just copy or symlink
                if path.exists() {
                    tokio::fs::copy(path, &dest_path).await.map_err(|e| {
                        ModelError::IoError(format!("Failed to copy model: {}", e))
                    })?;
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
            }
        };

        tracing::info!("Downloading model '{}' from {}", model_id, url);

        let response = self.client.get(&url).send().await.map_err(|e| {
            ModelError::DownloadFailed(format!("HTTP request failed: {}", e))
        })?;

        if !response.status().is_success() {
            return Err(ModelError::DownloadFailed(format!(
                "HTTP {}: {}",
                response.status(),
                url
            )));
        }

        let total_size = response.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;
        let mut file = tokio::fs::File::create(&dest_path).await.map_err(|e| {
            ModelError::IoError(format!("Failed to create file: {}", e))
        })?;

        let mut stream = response.bytes_stream();
        use futures_util::StreamExt;
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| {
                ModelError::DownloadFailed(format!("Download stream error: {}", e))
            })?;
            file.write_all(&chunk).await.map_err(|e| {
                ModelError::IoError(format!("Write error: {}", e))
            })?;
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

        file.flush().await.map_err(|e| {
            ModelError::IoError(format!("Flush error: {}", e))
        })?;

        tracing::info!(
            "Model '{}' downloaded ({} bytes)",
            model_id,
            downloaded
        );

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

    /// Delete a downloaded model.
    pub async fn delete_model(&self, model_id: &str) -> Result<(), ModelError> {
        let entry = self
            .registry
            .get(model_id)
            .map(|e| e.value().clone())
            .ok_or_else(|| ModelError::NotFound(model_id.to_string()))?;

        if let Some(ref path) = entry.local_path {
            if path.exists() {
                tokio::fs::remove_file(path).await.map_err(|e| {
                    ModelError::IoError(format!("Failed to delete: {}", e))
                })?;
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
                    ModelTier::Large => "llama-3.2-8b-q4",
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
            ModelSource::Url { url } => url
                .rsplit('/')
                .next()
                .unwrap_or("model.bin")
                .to_string(),
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
                "robertknight/ocrs-models",
                "text-detection.rten",
                4_200_000u64,
                "Text detection ONNX model for ocrs",
            ),
            (
                "ocrs-text-recognition",
                "robertknight/ocrs-models",
                "text-recognition.rten",
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
pub enum ModelError {
    #[error("Model not found: {0}")]
    NotFound(String),

    #[error("Download failed: {0}")]
    DownloadFailed(String),

    #[error("IO error: {0}")]
    IoError(String),
}
