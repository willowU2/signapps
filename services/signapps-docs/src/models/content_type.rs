use serde::{Deserialize, Serialize};

/// Document content type (for future use)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
#[allow(dead_code)]
pub enum DocumentType {
    /// Rich text document (Tiptap editor)
    Text,
    /// Spreadsheet (Excel-like)
    Sheet,
    /// Presentation (PowerPoint-like)
    Slide,
    /// Kanban board (Trello-like)
    Board,
}

#[allow(dead_code)]
impl DocumentType {
    pub fn as_str(&self) -> &'static str {
        match self {
            DocumentType::Text => "text",
            DocumentType::Sheet => "sheet",
            DocumentType::Slide => "slide",
            DocumentType::Board => "board",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "text" => Some(DocumentType::Text),
            "sheet" => Some(DocumentType::Sheet),
            "slide" => Some(DocumentType::Slide),
            "board" => Some(DocumentType::Board),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_document_type_conversion() {
        assert_eq!(DocumentType::Text.as_str(), "text");
        assert_eq!(DocumentType::from_str("sheet"), Some(DocumentType::Sheet));
        assert_eq!(DocumentType::from_str("invalid"), None);
    }
}
