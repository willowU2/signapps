//! RAG pipeline orchestrating embeddings, pgvector, and LLM.

use std::sync::Arc;

use signapps_common::Result;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::embeddings::EmbeddingsClient;
use crate::llm::{ChatMessage, ProviderRegistry};
use crate::vectors::{DocumentChunk, SearchResult, VectorService};

use super::chunker::TextChunker;

/// Configuration for RAG pipeline.
#[derive(Debug, Clone)]
pub struct RagConfig {
    /// Number of context chunks to retrieve.
    pub top_k: u64,
    /// Minimum similarity score threshold.
    pub score_threshold: f32,
    /// Maximum tokens for LLM response.
    pub max_tokens: u32,
    /// Temperature for LLM.
    pub temperature: f32,
    /// System prompt for RAG.
    pub system_prompt: String,
}

impl Default for RagConfig {
    fn default() -> Self {
        Self {
            top_k: 5,
            score_threshold: 0.5,
            max_tokens: 1024,
            temperature: 0.7,
            system_prompt: "Tu es un assistant IA utile. Réponds aux questions en utilisant le contexte fourni. Si tu ne trouves pas l'information dans le contexte, dis-le clairement.".to_string(),
        }
    }
}

/// RAG pipeline for question answering.
#[derive(Clone)]
pub struct RagPipeline {
    embeddings: EmbeddingsClient,
    vectors: VectorService,
    providers: Arc<ProviderRegistry>,
    chunker: TextChunker,
    config: RagConfig,
}

impl RagPipeline {
    /// Create a new RAG pipeline.
    pub fn new(
        embeddings: EmbeddingsClient,
        vectors: VectorService,
        providers: Arc<ProviderRegistry>,
    ) -> Self {
        Self {
            embeddings,
            vectors,
            providers,
            chunker: TextChunker::new(),
            config: RagConfig::default(),
        }
    }

    /// Index a document.
    pub async fn index_document(
        &self,
        document_id: Uuid,
        content: &str,
        filename: &str,
        path: &str,
        mime_type: Option<&str>,
        collection: Option<&str>,
        security_tags: Option<serde_json::Value>,
    ) -> Result<usize> {
        // Chunk the document
        let text_chunks = self.chunker.chunk_by_paragraphs(content);

        if text_chunks.is_empty() {
            return Ok(0);
        }

        // Create document chunks
        let chunks: Vec<DocumentChunk> = text_chunks
            .iter()
            .enumerate()
            .map(|(i, content)| DocumentChunk {
                id: Uuid::new_v4(),
                document_id,
                chunk_index: i as i32,
                content: content.clone(),
                filename: filename.to_string(),
                path: path.to_string(),
                mime_type: mime_type.map(|s| s.to_string()),
                collection: collection.map(|s| s.to_string()),
                security_tags: security_tags.clone(),
            })
            .collect();

        // Generate embeddings for all chunks
        let texts: Vec<String> = chunks.iter().map(|c| c.content.clone()).collect();
        let embeddings = self.embeddings.embed_batch(&texts).await?;

        // Store in pgvector
        self.vectors.upsert_chunks(&chunks, embeddings).await?;

        let count = chunks.len();
        tracing::info!(
            document_id = %document_id,
            chunks = count,
            "Document indexed"
        );

        Ok(count)
    }

    /// Remove a document from the index.
    pub async fn remove_document(&self, document_id: Uuid) -> Result<()> {
        self.vectors.delete_document(document_id).await
    }

    /// Search for relevant documents.
    pub async fn search(
        &self,
        query: &str,
        limit: Option<u64>,
        collections: Option<&[String]>,
        security_tags_filter: Option<&serde_json::Value>,
    ) -> Result<Vec<SearchResult>> {
        let query_embedding = self.embeddings.embed(query).await?;

        let results = self
            .vectors
            .search(
                &query_embedding,
                limit.unwrap_or(self.config.top_k) as i64,
                Some(self.config.score_threshold),
                collections,
                security_tags_filter,
            )
            .await?;

        // Map DB results to SearchResult
        Ok(results
            .into_iter()
            .map(|r| SearchResult {
                id: r.id,
                document_id: r.document_id,
                filename: r.filename,
                content: r.content,
                score: r.score,
            })
            .collect())
    }

    /// Query with RAG (retrieve + generate), using default provider.
    pub async fn query(&self, question: &str) -> Result<RagResponse> {
        self.query_with_provider(question, None, None, None, None, None, None)
            .await
    }

    /// Query with RAG using a specific model (backward compat).
    pub async fn query_with_model(
        &self,
        question: &str,
        model: Option<&str>,
    ) -> Result<RagResponse> {
        self.query_with_provider(question, None, model, None, None, None, None)
            .await
    }

    /// Query with RAG using a specific provider and model.
    /// Falls back to direct LLM chat when embeddings are unavailable.
    /// Tries alternative providers when the primary one fails.
    pub async fn query_with_provider(
        &self,
        question: &str,
        provider_id: Option<&str>,
        model: Option<&str>,
        language: Option<&str>,
        custom_system_prompt: Option<&str>,
        collections: Option<&[String]>,
        security_tags_filter: Option<&serde_json::Value>,
    ) -> Result<RagResponse> {
        // 1. Try to retrieve relevant context (graceful fallback)
        let search_results = match self
            .search(question, None, collections, security_tags_filter)
            .await
        {
            Ok(results) => results,
            Err(e) => {
                tracing::warn!("RAG search failed, falling back to direct LLM: {}", e);
                vec![]
            },
        };

        // 2. Build context from results
        let context = self.build_context(&search_results);

        // 3. Generate response with LLM — try providers in fallback order
        let messages = self.build_messages(&context, question, language, custom_system_prompt);
        let provider_ids = self.providers.fallback_order(provider_id);

        let mut last_error = None;
        for pid in &provider_ids {
            let provider = match self.providers.get(pid) {
                Ok(p) => p,
                Err(_) => continue,
            };

            match provider
                .chat(
                    messages.clone(),
                    model,
                    Some(self.config.max_tokens),
                    Some(self.config.temperature),
                )
                .await
            {
                Ok(response) => {
                    let answer = response
                        .choices
                        .first()
                        .map(|c| c.message.content.clone())
                        .unwrap_or_default();

                    return Ok(RagResponse {
                        answer,
                        sources: search_results,
                        usage: response.usage.map(|u| TokenUsage {
                            prompt_tokens: u.prompt_tokens,
                            completion_tokens: u.completion_tokens,
                            total_tokens: u.total_tokens,
                        }),
                    });
                },
                Err(e) => {
                    tracing::warn!("Provider '{}' failed for chat, trying next: {}", pid, e);
                    last_error = Some(e);
                },
            }
        }

        Err(last_error.unwrap_or_else(|| {
            signapps_common::Error::Internal("No LLM providers available".into())
        }))
    }

    /// Query with streaming response, using default provider.
    pub async fn query_stream(
        &self,
        question: &str,
    ) -> Result<(Vec<SearchResult>, mpsc::Receiver<Result<String>>)> {
        self.query_stream_with_provider(question, None, None, None, None, None, None)
            .await
    }

    /// Query with streaming response using a specific model (backward compat).
    pub async fn query_stream_with_model(
        &self,
        question: &str,
        model: Option<&str>,
    ) -> Result<(Vec<SearchResult>, mpsc::Receiver<Result<String>>)> {
        self.query_stream_with_provider(question, None, model, None, None, None, None)
            .await
    }

    /// Query with streaming response using a specific provider and model.
    /// Tries alternative providers when the primary one fails.
    pub async fn query_stream_with_provider(
        &self,
        question: &str,
        provider_id: Option<&str>,
        model: Option<&str>,
        language: Option<&str>,
        custom_system_prompt: Option<&str>,
        collections: Option<&[String]>,
        security_tags_filter: Option<&serde_json::Value>,
    ) -> Result<(Vec<SearchResult>, mpsc::Receiver<Result<String>>)> {
        // 1. Try to retrieve relevant context (graceful fallback)
        let search_results = match self
            .search(question, None, collections, security_tags_filter)
            .await
        {
            Ok(results) => results,
            Err(e) => {
                tracing::warn!(
                    "RAG search failed, falling back to direct LLM streaming: {}",
                    e
                );
                vec![]
            },
        };

        // 2. Build context from results
        let context = self.build_context(&search_results);

        // 3. Stream response from LLM — try providers in fallback order
        let messages = self.build_messages(&context, question, language, custom_system_prompt);
        let provider_ids = self.providers.fallback_order(provider_id);

        let mut last_error = None;
        for pid in &provider_ids {
            let provider = match self.providers.get(pid) {
                Ok(p) => p,
                Err(_) => continue,
            };

            match provider
                .chat_stream(
                    messages.clone(),
                    model,
                    Some(self.config.max_tokens),
                    Some(self.config.temperature),
                )
                .await
            {
                Ok(stream) => {
                    return Ok((search_results, stream));
                },
                Err(e) => {
                    tracing::warn!(
                        "Provider '{}' failed for chat_stream, trying next: {}",
                        pid,
                        e
                    );
                    last_error = Some(e);
                },
            }
        }

        Err(last_error.unwrap_or_else(|| {
            signapps_common::Error::Internal("No LLM providers available".into())
        }))
    }

    /// Build context string from search results.
    fn build_context(&self, results: &[SearchResult]) -> String {
        if results.is_empty() {
            return String::new();
        }

        results
            .iter()
            .enumerate()
            .map(|(i, r)| format!("[Source {} - {}]\n{}", i + 1, r.filename, r.content))
            .collect::<Vec<_>>()
            .join("\n\n---\n\n")
    }

    /// Build chat messages for RAG query.
    /// Merges system prompt into user message for Mistral compatibility
    /// (Mistral requires strictly alternating user/assistant roles).
    fn build_messages(
        &self,
        context: &str,
        question: &str,
        language: Option<&str>,
        custom_system_prompt: Option<&str>,
    ) -> Vec<ChatMessage> {
        let base_prompt = custom_system_prompt.unwrap_or(&self.config.system_prompt);

        let system = if let Some(lang) = language {
            format!("IMPORTANT: You must reply in {}.\n\n{}", lang, base_prompt)
        } else {
            base_prompt.to_string()
        };

        let user_content = if !context.is_empty() {
            format!(
                "{}\n\nVoici le contexte pertinent:\n\n{}\n\n---\n\nQuestion: {}",
                system, context, question
            )
        } else {
            format!(
                "{}\n\nJe n'ai pas trouvé de contexte pertinent dans les documents. Question: {}",
                system, question
            )
        };

        vec![ChatMessage::user(user_content)]
    }
}

/// Response from RAG query.
#[derive(Debug, Clone)]
pub struct RagResponse {
    /// Generated answer.
    pub answer: String,
    /// Source documents used.
    pub sources: Vec<SearchResult>,
    /// Token usage statistics.
    pub usage: Option<TokenUsage>,
}

/// Token usage for RAG response.
#[derive(Debug, Clone)]
pub struct TokenUsage {
    pub prompt_tokens: i32,
    pub completion_tokens: i32,
    pub total_tokens: i32,
}
