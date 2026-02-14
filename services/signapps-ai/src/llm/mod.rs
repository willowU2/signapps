//! LLM client supporting multiple providers (vLLM, Ollama, OpenAI, Anthropic, LlamaCpp).

#[cfg(feature = "native-llm")]
pub mod llamacpp;
pub mod providers;
pub mod registry;
pub mod types;

#[cfg(feature = "native-llm")]
pub use llamacpp::LlamaCppProvider;
pub use providers::*;
pub use registry::ProviderRegistry;
pub use types::*;
