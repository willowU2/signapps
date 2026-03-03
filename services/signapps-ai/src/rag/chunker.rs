//! Text chunking for document processing.
#![allow(dead_code)]

/// Configuration for text chunking.
#[derive(Debug, Clone)]
pub struct ChunkConfig {
    /// Maximum chunk size in characters.
    pub chunk_size: usize,
    /// Overlap between chunks in characters.
    pub chunk_overlap: usize,
}

impl Default for ChunkConfig {
    fn default() -> Self {
        Self {
            chunk_size: 512,
            chunk_overlap: 50,
        }
    }
}

/// Text chunker for splitting documents.
#[derive(Debug, Clone)]
pub struct TextChunker {
    config: ChunkConfig,
}

impl TextChunker {
    /// Create a new text chunker with default config.
    pub fn new() -> Self {
        Self {
            config: ChunkConfig::default(),
        }
    }

    /// Create a new text chunker with custom config.
    pub fn with_config(config: ChunkConfig) -> Self {
        Self { config }
    }

    /// Split text into chunks.
    pub fn chunk(&self, text: &str) -> Vec<String> {
        if text.is_empty() {
            return vec![];
        }

        let mut chunks = Vec::new();
        let chars: Vec<char> = text.chars().collect();
        let total_len = chars.len();

        if total_len <= self.config.chunk_size {
            return vec![text.to_string()];
        }

        let mut start = 0;

        while start < total_len {
            let end = (start + self.config.chunk_size).min(total_len);

            // Try to find a good break point (sentence or paragraph)
            let mut actual_end = end;
            if end < total_len {
                // Look backwards for sentence boundary
                for i in (start..end).rev() {
                    let c = chars[i];
                    if c == '.' || c == '!' || c == '?' || c == '\n' {
                        actual_end = i + 1;
                        break;
                    }
                }

                // If no sentence boundary found, look for word boundary
                if actual_end == end {
                    for i in (start..end).rev() {
                        if chars[i].is_whitespace() {
                            actual_end = i;
                            break;
                        }
                    }
                }
            }

            let chunk: String = chars[start..actual_end].iter().collect();
            let trimmed = chunk.trim();

            if !trimmed.is_empty() {
                chunks.push(trimmed.to_string());
            }

            // Move start forward, ensuring progress is made
            let next_start = if actual_end > self.config.chunk_overlap {
                actual_end - self.config.chunk_overlap
            } else {
                actual_end
            };

            // Ensure we always make progress to avoid infinite loop
            if next_start <= start {
                start = actual_end;
            } else {
                start = next_start;
            }
        }

        chunks
    }

    /// Split text by paragraphs first, then by size.
    pub fn chunk_by_paragraphs(&self, text: &str) -> Vec<String> {
        let paragraphs: Vec<&str> = text.split("\n\n").collect();
        let mut chunks = Vec::new();
        let mut current_chunk = String::new();

        for paragraph in paragraphs {
            let paragraph = paragraph.trim();
            if paragraph.is_empty() {
                continue;
            }

            // If paragraph itself is too large, chunk it
            if paragraph.len() > self.config.chunk_size {
                if !current_chunk.is_empty() {
                    chunks.push(current_chunk.trim().to_string());
                    current_chunk = String::new();
                }
                chunks.extend(self.chunk(paragraph));
                continue;
            }

            // Check if adding this paragraph would exceed chunk size
            let potential_len = current_chunk.len() + paragraph.len() + 2; // +2 for newlines

            if potential_len > self.config.chunk_size && !current_chunk.is_empty() {
                chunks.push(current_chunk.trim().to_string());
                current_chunk = String::new();
            }

            if !current_chunk.is_empty() {
                current_chunk.push_str("\n\n");
            }
            current_chunk.push_str(paragraph);
        }

        if !current_chunk.trim().is_empty() {
            chunks.push(current_chunk.trim().to_string());
        }

        chunks
    }
}

impl Default for TextChunker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_small_text() {
        let chunker = TextChunker::new();
        let chunks = chunker.chunk("Hello, world!");
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], "Hello, world!");
    }

    #[test]
    fn test_empty_text() {
        let chunker = TextChunker::new();
        let chunks = chunker.chunk("");
        assert!(chunks.is_empty());
    }

    #[test]
    fn test_large_text() {
        let chunker = TextChunker::with_config(ChunkConfig {
            chunk_size: 50,
            chunk_overlap: 10,
        });

        let text = "This is a test sentence. This is another sentence. And here is one more sentence to make it longer.";
        let chunks = chunker.chunk(text);

        assert!(chunks.len() > 1);
        for chunk in &chunks {
            assert!(chunk.len() <= 60); // Allow some flexibility
        }
    }

    // ========================================================================
    // Additional chunker tests for RAG pipeline
    // ========================================================================

    #[test]
    fn test_chunk_by_paragraphs_empty() {
        let chunker = TextChunker::new();
        let chunks = chunker.chunk_by_paragraphs("");
        assert!(chunks.is_empty());
    }

    #[test]
    fn test_chunk_by_paragraphs_single() {
        let chunker = TextChunker::new();
        let text = "This is a single paragraph without any breaks.";
        let chunks = chunker.chunk_by_paragraphs(text);

        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], text);
    }

    #[test]
    fn test_chunk_by_paragraphs_multiple() {
        let chunker = TextChunker::new();
        let text = "First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph.";
        let chunks = chunker.chunk_by_paragraphs(text);

        // May combine into one chunk if under size limit
        assert!(!chunks.is_empty());
        let combined = chunks.join("\n\n");
        assert!(combined.contains("First paragraph"));
        assert!(combined.contains("Second paragraph"));
        assert!(combined.contains("Third paragraph"));
    }

    #[test]
    fn test_chunk_by_paragraphs_large_paragraph() {
        let chunker = TextChunker::with_config(ChunkConfig {
            chunk_size: 50,
            chunk_overlap: 10,
        });

        // Create a paragraph larger than chunk_size
        let large_paragraph = "This is a very long paragraph. ".repeat(10);
        let text = format!("{}\n\nShort second paragraph.", large_paragraph);

        let chunks = chunker.chunk_by_paragraphs(&text);

        // Should split the large paragraph
        assert!(chunks.len() > 1);
    }

    #[test]
    fn test_chunk_preserves_content() {
        let chunker = TextChunker::new();
        let original = "Important content that must be preserved entirely.";
        let chunks = chunker.chunk(original);

        // Small text should return as single chunk
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], original);
    }

    #[test]
    fn test_chunk_overlap() {
        let chunker = TextChunker::with_config(ChunkConfig {
            chunk_size: 30,
            chunk_overlap: 10,
        });

        let text = "Sentence one. Sentence two. Sentence three. Sentence four.";
        let chunks = chunker.chunk(text);

        // With overlap, adjacent chunks should share some content
        assert!(chunks.len() >= 2);
    }

    #[test]
    fn test_chunk_sentence_boundaries() {
        let chunker = TextChunker::with_config(ChunkConfig {
            chunk_size: 50,
            chunk_overlap: 5,
        });

        let text = "First sentence. Second sentence. Third sentence. Fourth sentence.";
        let chunks = chunker.chunk(text);

        // Chunks should preferably end at sentence boundaries
        for chunk in &chunks {
            // Each chunk should be trimmed
            assert_eq!(chunk.trim(), chunk.as_str());
        }
    }

    #[test]
    fn test_chunk_whitespace_handling() {
        let chunker = TextChunker::new();

        let text = "   Content with leading spaces.   ";
        let chunks = chunker.chunk(text);

        assert_eq!(chunks.len(), 1);
        // Should be trimmed
        assert_eq!(chunks[0], "Content with leading spaces.");
    }

    #[test]
    fn test_chunk_by_paragraphs_whitespace_paragraphs() {
        let chunker = TextChunker::new();

        // Paragraphs with only whitespace should be ignored
        let text = "First paragraph.\n\n   \n\nSecond paragraph.";
        let chunks = chunker.chunk_by_paragraphs(text);

        let combined = chunks.join(" ");
        assert!(combined.contains("First paragraph"));
        assert!(combined.contains("Second paragraph"));
    }

    #[test]
    fn test_chunk_unicode() {
        let chunker = TextChunker::new();

        let text = "Bonjour le monde! 你好世界! مرحبا بالعالم!";
        let chunks = chunker.chunk(text);

        assert_eq!(chunks.len(), 1);
        assert!(chunks[0].contains("Bonjour"));
        assert!(chunks[0].contains("你好"));
        assert!(chunks[0].contains("مرحبا"));
    }

    #[test]
    fn test_chunk_very_long_word() {
        let chunker = TextChunker::with_config(ChunkConfig {
            chunk_size: 20,
            chunk_overlap: 5,
        });

        // A word longer than chunk_size
        let text = "supercalifragilisticexpialidocious";
        let chunks = chunker.chunk(text);

        // Should handle gracefully without panic
        assert!(!chunks.is_empty());
    }

    #[test]
    fn test_chunk_newlines_preserved_in_paragraphs() {
        let chunker = TextChunker::new();

        let text = "Line 1\nLine 2\nLine 3";
        let chunks = chunker.chunk_by_paragraphs(text);

        // Single paragraphs (no double newlines)
        assert_eq!(chunks.len(), 1);
    }

    #[test]
    fn test_chunk_config_defaults() {
        let config = ChunkConfig::default();

        assert_eq!(config.chunk_size, 512);
        assert_eq!(config.chunk_overlap, 50);
    }

    #[test]
    fn test_chunker_default_impl() {
        let chunker1 = TextChunker::new();
        let chunker2 = TextChunker::default();

        // Both should behave the same
        let text = "Test content";
        assert_eq!(chunker1.chunk(text), chunker2.chunk(text));
    }

    #[test]
    fn test_chunk_question_marks() {
        let chunker = TextChunker::with_config(ChunkConfig {
            chunk_size: 40,
            chunk_overlap: 5,
        });

        let text = "What is this? This is a test. Is it working?";
        let chunks = chunker.chunk(text);

        // Should break at question marks as sentence boundaries
        assert!(!chunks.is_empty());
    }

    #[test]
    fn test_chunk_exclamation_marks() {
        let chunker = TextChunker::with_config(ChunkConfig {
            chunk_size: 30,
            chunk_overlap: 5,
        });

        let text = "Hello! World! This is great!";
        let chunks = chunker.chunk(text);

        assert!(!chunks.is_empty());
    }

    #[test]
    fn test_chunk_mixed_punctuation() {
        let chunker = TextChunker::with_config(ChunkConfig {
            chunk_size: 60,
            chunk_overlap: 10,
        });

        let text = "Question? Statement. Exclamation! Another question? Done.";
        let chunks = chunker.chunk(text);

        // All content should be preserved
        let combined = chunks.join(" ");
        assert!(combined.contains("Question"));
        assert!(combined.contains("Statement"));
        assert!(combined.contains("Exclamation"));
    }

    #[test]
    fn test_paragraphs_aggregation() {
        let chunker = TextChunker::with_config(ChunkConfig {
            chunk_size: 200,
            chunk_overlap: 20,
        });

        // Multiple small paragraphs that fit in one chunk
        let text = "Para 1.\n\nPara 2.\n\nPara 3.";
        let chunks = chunker.chunk_by_paragraphs(text);

        // Should combine into one chunk since total < 200
        assert_eq!(chunks.len(), 1);
        assert!(chunks[0].contains("Para 1"));
        assert!(chunks[0].contains("Para 2"));
        assert!(chunks[0].contains("Para 3"));
    }
}
