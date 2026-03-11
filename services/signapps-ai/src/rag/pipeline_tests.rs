//! Tests for RAG pipeline logic.

#[cfg(test)]
mod tests {
    use crate::rag::chunker::TextChunker;
    use crate::rag::pipeline::RagConfig;
    use uuid::Uuid;

    // ========================================================================
    // RagConfig Tests
    // ========================================================================

    #[test]
    fn test_rag_config_defaults() {
        let config = RagConfig::default();

        assert_eq!(config.top_k, 5);
        assert_eq!(config.score_threshold, 0.5);
        assert_eq!(config.max_tokens, 1024);
        assert_eq!(config.temperature, 0.7);
        assert!(!config.system_prompt.is_empty());
    }

    #[test]
    fn test_rag_config_french_system_prompt() {
        let config = RagConfig::default();

        // System prompt should be in French
        assert!(config.system_prompt.contains("assistant IA"));
    }

    #[test]
    fn test_rag_config_clone() {
        let config = RagConfig::default();
        let cloned = config.clone();

        assert_eq!(config.top_k, cloned.top_k);
        assert_eq!(config.score_threshold, cloned.score_threshold);
        assert_eq!(config.system_prompt, cloned.system_prompt);
    }

    // ========================================================================
    // Context Building Tests
    // ========================================================================

    #[derive(Debug, Clone)]
    struct MockSearchResult {
        id: Uuid,
        document_id: Uuid,
        filename: String,
        content: String,
        score: f32,
    }

    fn build_context_from_results(results: &[MockSearchResult]) -> String {
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

    #[test]
    fn test_build_context_empty() {
        let results: Vec<MockSearchResult> = vec![];
        let context = build_context_from_results(&results);

        assert!(context.is_empty());
    }

    #[test]
    fn test_build_context_single_result() {
        let results = vec![MockSearchResult {
            id: Uuid::new_v4(),
            document_id: Uuid::new_v4(),
            filename: "test.txt".to_string(),
            content: "This is test content.".to_string(),
            score: 0.85,
        }];

        let context = build_context_from_results(&results);

        assert!(context.contains("[Source 1 - test.txt]"));
        assert!(context.contains("This is test content."));
        assert!(!context.contains("---")); // No separator for single result
    }

    #[test]
    fn test_build_context_multiple_results() {
        let results = vec![
            MockSearchResult {
                id: Uuid::new_v4(),
                document_id: Uuid::new_v4(),
                filename: "doc1.pdf".to_string(),
                content: "Content from first document.".to_string(),
                score: 0.9,
            },
            MockSearchResult {
                id: Uuid::new_v4(),
                document_id: Uuid::new_v4(),
                filename: "doc2.pdf".to_string(),
                content: "Content from second document.".to_string(),
                score: 0.8,
            },
            MockSearchResult {
                id: Uuid::new_v4(),
                document_id: Uuid::new_v4(),
                filename: "doc3.txt".to_string(),
                content: "Content from third document.".to_string(),
                score: 0.7,
            },
        ];

        let context = build_context_from_results(&results);

        assert!(context.contains("[Source 1 - doc1.pdf]"));
        assert!(context.contains("[Source 2 - doc2.pdf]"));
        assert!(context.contains("[Source 3 - doc3.txt]"));
        assert!(context.contains("---")); // Separator between results
        assert!(context.contains("Content from first document."));
        assert!(context.contains("Content from second document."));
        assert!(context.contains("Content from third document."));
    }

    // ========================================================================
    // Message Building Tests
    // ========================================================================

    fn build_user_message(
        context: &str,
        question: &str,
        language: Option<&str>,
        custom_system_prompt: Option<&str>,
    ) -> String {
        let default_system =
            "Tu es un assistant IA utile. Réponds aux questions en utilisant le contexte fourni.";
        let base_prompt = custom_system_prompt.unwrap_or(default_system);

        let system = if let Some(lang) = language {
            format!("IMPORTANT: You must reply in {}.\n\n{}", lang, base_prompt)
        } else {
            base_prompt.to_string()
        };

        if !context.is_empty() {
            format!(
                "{}\n\nVoici le contexte pertinent:\n\n{}\n\n---\n\nQuestion: {}",
                system, context, question
            )
        } else {
            format!(
                "{}\n\nJe n'ai pas trouvé de contexte pertinent dans les documents. Question: {}",
                system, question
            )
        }
    }

    #[test]
    fn test_build_message_with_context() {
        let context = "[Source 1 - doc.txt]\nSome content here.";
        let question = "What is the answer?";

        let message = build_user_message(context, question, None, None);

        assert!(message.contains("assistant IA"));
        assert!(message.contains("Voici le contexte pertinent"));
        assert!(message.contains("Some content here"));
        assert!(message.contains("Question: What is the answer?"));
    }

    #[test]
    fn test_build_message_without_context() {
        let context = "";
        let question = "General question?";

        let message = build_user_message(context, question, None, None);

        assert!(message.contains("Je n'ai pas trouvé de contexte pertinent"));
        assert!(message.contains("Question: General question?"));
    }

    #[test]
    fn test_build_message_with_language() {
        let context = "Some context";
        let question = "Question?";

        let message = build_user_message(context, question, Some("French"), None);

        assert!(message.contains("IMPORTANT: You must reply in French"));
    }

    #[test]
    fn test_build_message_with_custom_prompt() {
        let context = "Context";
        let question = "Question?";
        let custom = "You are a specialized assistant for code review.";

        let message = build_user_message(context, question, None, Some(custom));

        assert!(message.contains("specialized assistant for code review"));
        assert!(!message.contains("assistant IA utile")); // Default not used
    }

    #[test]
    fn test_build_message_with_language_and_custom_prompt() {
        let context = "Context";
        let question = "Question?";

        let message = build_user_message(
            context,
            question,
            Some("German"),
            Some("Custom system prompt."),
        );

        assert!(message.contains("IMPORTANT: You must reply in German"));
        assert!(message.contains("Custom system prompt"));
    }

    // ========================================================================
    // Document Chunking for RAG Tests
    // ========================================================================

    #[derive(Debug, Clone)]
    struct DocumentChunk {
        id: Uuid,
        document_id: Uuid,
        chunk_index: i32,
        content: String,
        filename: String,
        path: String,
        mime_type: Option<String>,
        collection: Option<String>,
        security_tags: Option<serde_json::Value>,
    }

    fn create_document_chunks(
        document_id: Uuid,
        content: &str,
        filename: &str,
        path: &str,
        mime_type: Option<&str>,
        collection: Option<&str>,
        security_tags: Option<serde_json::Value>,
    ) -> Vec<DocumentChunk> {
        let chunker = TextChunker::new();
        let text_chunks = chunker.chunk_by_paragraphs(content);

        text_chunks
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
            .collect()
    }

    #[test]
    fn test_create_chunks_from_document() {
        let doc_id = Uuid::new_v4();
        let content = "First paragraph about AI.\n\nSecond paragraph about ML.";

        let chunks = create_document_chunks(
            doc_id,
            content,
            "readme.md",
            "/docs/readme.md",
            None,
            None,
            None,
        );

        assert!(!chunks.is_empty());
        for (i, chunk) in chunks.iter().enumerate() {
            assert_eq!(chunk.document_id, doc_id);
            assert_eq!(chunk.chunk_index, i as i32);
            assert_eq!(chunk.filename, "readme.md");
            assert_eq!(chunk.path, "/docs/readme.md");
        }
    }

    #[test]
    fn test_create_chunks_with_metadata() {
        let doc_id = Uuid::new_v4();
        let content = "Test content";
        let tags = serde_json::json!({"user_id": "123", "department": "engineering"});

        let chunks = create_document_chunks(
            doc_id,
            content,
            "report.pdf",
            "/reports/report.pdf",
            Some("application/pdf"),
            Some("reports"),
            Some(tags.clone()),
        );

        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].mime_type, Some("application/pdf".to_string()));
        assert_eq!(chunks[0].collection, Some("reports".to_string()));
        assert_eq!(chunks[0].security_tags, Some(tags));
    }

    #[test]
    fn test_create_chunks_empty_content() {
        let doc_id = Uuid::new_v4();
        let content = "";

        let chunks =
            create_document_chunks(doc_id, content, "empty.txt", "/empty.txt", None, None, None);

        assert!(chunks.is_empty());
    }

    // ========================================================================
    // Score Threshold Tests
    // ========================================================================

    fn filter_by_score(results: Vec<MockSearchResult>, threshold: f32) -> Vec<MockSearchResult> {
        results
            .into_iter()
            .filter(|r| r.score >= threshold)
            .collect()
    }

    #[test]
    fn test_filter_by_score_all_pass() {
        let results = vec![
            MockSearchResult {
                id: Uuid::new_v4(),
                document_id: Uuid::new_v4(),
                filename: "a.txt".to_string(),
                content: "A".to_string(),
                score: 0.9,
            },
            MockSearchResult {
                id: Uuid::new_v4(),
                document_id: Uuid::new_v4(),
                filename: "b.txt".to_string(),
                content: "B".to_string(),
                score: 0.8,
            },
        ];

        let filtered = filter_by_score(results, 0.5);
        assert_eq!(filtered.len(), 2);
    }

    #[test]
    fn test_filter_by_score_some_pass() {
        let results = vec![
            MockSearchResult {
                id: Uuid::new_v4(),
                document_id: Uuid::new_v4(),
                filename: "high.txt".to_string(),
                content: "High score".to_string(),
                score: 0.9,
            },
            MockSearchResult {
                id: Uuid::new_v4(),
                document_id: Uuid::new_v4(),
                filename: "low.txt".to_string(),
                content: "Low score".to_string(),
                score: 0.3,
            },
        ];

        let filtered = filter_by_score(results, 0.5);
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].filename, "high.txt");
    }

    #[test]
    fn test_filter_by_score_none_pass() {
        let results = vec![
            MockSearchResult {
                id: Uuid::new_v4(),
                document_id: Uuid::new_v4(),
                filename: "low1.txt".to_string(),
                content: "Low".to_string(),
                score: 0.2,
            },
            MockSearchResult {
                id: Uuid::new_v4(),
                document_id: Uuid::new_v4(),
                filename: "low2.txt".to_string(),
                content: "Also low".to_string(),
                score: 0.3,
            },
        ];

        let filtered = filter_by_score(results, 0.5);
        assert!(filtered.is_empty());
    }

    // ========================================================================
    // Top-K Limit Tests
    // ========================================================================

    fn limit_results(results: Vec<MockSearchResult>, top_k: usize) -> Vec<MockSearchResult> {
        results.into_iter().take(top_k).collect()
    }

    #[test]
    fn test_limit_results() {
        let results: Vec<MockSearchResult> = (0..10)
            .map(|i| MockSearchResult {
                id: Uuid::new_v4(),
                document_id: Uuid::new_v4(),
                filename: format!("doc{}.txt", i),
                content: format!("Content {}", i),
                score: 0.9 - (i as f32 * 0.05),
            })
            .collect();

        let limited = limit_results(results, 5);
        assert_eq!(limited.len(), 5);
    }

    #[test]
    fn test_limit_results_fewer_than_limit() {
        let results = vec![MockSearchResult {
            id: Uuid::new_v4(),
            document_id: Uuid::new_v4(),
            filename: "only.txt".to_string(),
            content: "Only one".to_string(),
            score: 0.9,
        }];

        let limited = limit_results(results, 5);
        assert_eq!(limited.len(), 1);
    }

    // ========================================================================
    // RAG Response Structure Tests
    // ========================================================================

    #[derive(Debug, Clone)]
    struct TokenUsage {
        prompt_tokens: i32,
        completion_tokens: i32,
        total_tokens: i32,
    }

    #[derive(Debug, Clone)]
    struct RagResponse {
        answer: String,
        sources: Vec<MockSearchResult>,
        usage: Option<TokenUsage>,
    }

    #[test]
    fn test_rag_response_with_sources() {
        let sources = vec![MockSearchResult {
            id: Uuid::new_v4(),
            document_id: Uuid::new_v4(),
            filename: "source.txt".to_string(),
            content: "Source content".to_string(),
            score: 0.85,
        }];

        let response = RagResponse {
            answer: "This is the answer.".to_string(),
            sources,
            usage: Some(TokenUsage {
                prompt_tokens: 100,
                completion_tokens: 50,
                total_tokens: 150,
            }),
        };

        assert_eq!(response.answer, "This is the answer.");
        assert_eq!(response.sources.len(), 1);
        assert!(response.usage.is_some());

        let usage = response.usage.unwrap();
        assert_eq!(usage.total_tokens, 150);
    }

    #[test]
    fn test_rag_response_without_sources() {
        let response = RagResponse {
            answer: "I don't have relevant context for this question.".to_string(),
            sources: vec![],
            usage: None,
        };

        assert!(response.sources.is_empty());
        assert!(response.usage.is_none());
    }

    // ========================================================================
    // Collection Filtering Tests
    // ========================================================================

    fn filter_by_collection(
        results: Vec<MockSearchResult>,
        collection: Option<&str>,
    ) -> Vec<MockSearchResult> {
        match collection {
            Some(coll) => results
                .into_iter()
                .filter(|r| r.filename.contains(coll))
                .collect(),
            None => results,
        }
    }

    #[test]
    fn test_filter_by_collection() {
        let results = vec![
            MockSearchResult {
                id: Uuid::new_v4(),
                document_id: Uuid::new_v4(),
                filename: "reports/q1.pdf".to_string(),
                content: "Q1 report".to_string(),
                score: 0.9,
            },
            MockSearchResult {
                id: Uuid::new_v4(),
                document_id: Uuid::new_v4(),
                filename: "docs/readme.md".to_string(),
                content: "Documentation".to_string(),
                score: 0.8,
            },
        ];

        let filtered = filter_by_collection(results, Some("reports"));
        assert_eq!(filtered.len(), 1);
        assert!(filtered[0].filename.contains("reports"));
    }

    #[test]
    fn test_no_collection_filter() {
        let results = vec![
            MockSearchResult {
                id: Uuid::new_v4(),
                document_id: Uuid::new_v4(),
                filename: "a.txt".to_string(),
                content: "A".to_string(),
                score: 0.9,
            },
            MockSearchResult {
                id: Uuid::new_v4(),
                document_id: Uuid::new_v4(),
                filename: "b.txt".to_string(),
                content: "B".to_string(),
                score: 0.8,
            },
        ];

        let filtered = filter_by_collection(results, None);
        assert_eq!(filtered.len(), 2);
    }
}
