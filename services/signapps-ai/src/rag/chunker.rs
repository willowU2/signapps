//! Text chunking for document processing.

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
}
