//! LLM client supporting multiple providers (vLLM, Ollama, OpenAI, Anthropic, LlamaCpp).

pub mod anthropic;
pub mod gemini;
pub mod lazy;
#[cfg(feature = "native-llm")]
pub mod llamacpp;
pub mod lmstudio;
pub mod ollama;
pub mod openai;
pub mod providers;
pub mod registry;
pub mod types;
pub mod vllm;

#[cfg(feature = "native-llm")]
pub use llamacpp::LlamaCppProvider;
pub use providers::*;
pub use registry::ProviderRegistry;
pub use types::*;
