//! RAG pipeline orchestrating embeddings, Qdrant, and LLM.

use signapps_common::Result;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::embeddings::EmbeddingsClient;
use crate::llm::{ChatMessage, LlmClient};
use crate::qdrant::{DocumentChunk, QdrantService, SearchResult};

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
    qdrant: QdrantService,
    llm: LlmClient,
    chunker: TextChunker,
    config: RagConfig,
}

impl RagPipeline {
    /// Create a new RAG pipeline.
    pub fn new(embeddings: EmbeddingsClient, qdrant: QdrantService, llm: LlmClient) -> Self {
        Self {
            embeddings,
            qdrant,
            llm,
            chunker: TextChunker::new(),
            config: RagConfig::default(),
        }
    }

    /// Create a RAG pipeline with custom config.
    pub fn with_config(
        embeddings: EmbeddingsClient,
        qdrant: QdrantService,
        llm: LlmClient,
        config: RagConfig,
    ) -> Self {
        Self {
            embeddings,
            qdrant,
            llm,
            chunker: TextChunker::new(),
            config,
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
            })
            .collect();

        // Generate embeddings for all chunks
        let texts: Vec<String> = chunks.iter().map(|c| c.content.clone()).collect();
        let embeddings = self.embeddings.embed_batch(&texts).await?;

        // Store in Qdrant
        self.qdrant.upsert_chunks(&chunks, embeddings).await?;

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
        self.qdrant.delete_document(document_id).await
    }

    /// Search for relevant documents.
    pub async fn search(&self, query: &str, limit: Option<u64>) -> Result<Vec<SearchResult>> {
        let query_embedding = self.embeddings.embed(query).await?;

        let results = self
            .qdrant
            .search(
                query_embedding,
                limit.unwrap_or(self.config.top_k),
                Some(self.config.score_threshold),
            )
            .await?;

        Ok(results)
    }

    /// Query with RAG (retrieve + generate).
    pub async fn query(&self, question: &str) -> Result<RagResponse> {
        self.query_with_model(question, None).await
    }

    /// Query with RAG using a specific model.
    pub async fn query_with_model(
        &self,
        question: &str,
        model: Option<&str>,
    ) -> Result<RagResponse> {
        // 1. Retrieve relevant context
        let search_results = self.search(question, None).await?;

        // 2. Build context from results
        let context = self.build_context(&search_results);

        // 3. Generate response with LLM
        let messages = self.build_messages(&context, question);

        let response = self
            .llm
            .chat_with_model(
                messages,
                model,
                Some(self.config.max_tokens),
                Some(self.config.temperature),
            )
            .await?;

        let answer = response
            .choices
            .first()
            .map(|c| c.message.content.clone())
            .unwrap_or_default();

        Ok(RagResponse {
            answer,
            sources: search_results,
            usage: response.usage.map(|u| TokenUsage {
                prompt_tokens: u.prompt_tokens,
                completion_tokens: u.completion_tokens,
                total_tokens: u.total_tokens,
            }),
        })
    }

    /// Query with streaming response.
    pub async fn query_stream(
        &self,
        question: &str,
    ) -> Result<(Vec<SearchResult>, mpsc::Receiver<Result<String>>)> {
        self.query_stream_with_model(question, None).await
    }

    /// Query with streaming response using a specific model.
    pub async fn query_stream_with_model(
        &self,
        question: &str,
        model: Option<&str>,
    ) -> Result<(Vec<SearchResult>, mpsc::Receiver<Result<String>>)> {
        // 1. Retrieve relevant context
        let search_results = self.search(question, None).await?;

        // 2. Build context from results
        let context = self.build_context(&search_results);

        // 3. Stream response from LLM
        let messages = self.build_messages(&context, question);

        let stream = self
            .llm
            .chat_stream_with_model(
                messages,
                model,
                Some(self.config.max_tokens),
                Some(self.config.temperature),
            )
            .await?;

        Ok((search_results, stream))
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
    fn build_messages(&self, context: &str, question: &str) -> Vec<ChatMessage> {
        let user_content = if !context.is_empty() {
            format!(
                "{}\n\nVoici le contexte pertinent:\n\n{}\n\n---\n\nQuestion: {}",
                self.config.system_prompt, context, question
            )
        } else {
            format!(
                "{}\n\nJe n'ai pas trouvé de contexte pertinent dans les documents. Question: {}",
                self.config.system_prompt, question
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
