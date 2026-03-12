//! Presentation (PPTX) export module.

mod export;

pub use export::*;

use thiserror::Error;

/// Presentation conversion errors
#[derive(Debug, Error)]
pub enum PresentationError {
    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Conversion failed: {0}")]
    ConversionFailed(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

/// Text alignment for slide content
#[derive(Debug, Clone, Copy, Default)]
pub enum TextAlignment {
    #[default]
    Left,
    Center,
    Right,
}

/// A text run with formatting
#[derive(Debug, Clone, Default)]
pub struct TextRun {
    pub text: String,
    pub bold: bool,
    pub italic: bool,
    pub font_size: Option<f64>,
    pub color: Option<String>,
}

/// A text element (paragraph with runs)
#[derive(Debug, Clone, Default)]
pub struct TextElement {
    pub runs: Vec<TextRun>,
    pub alignment: TextAlignment,
    pub level: usize, // For bullet lists
}

/// Slide content types
#[derive(Debug, Clone)]
pub enum SlideContent {
    Title(String),
    Subtitle(String),
    Body(Vec<TextElement>),
    BulletList(Vec<String>),
    Image {
        path: String,
        width: f64,
        height: f64,
        x: f64,
        y: f64,
    },
    Shape {
        shape_type: String,
        width: f64,
        height: f64,
        x: f64,
        y: f64,
        fill_color: Option<String>,
    },
}

/// A single slide
#[derive(Debug, Clone, Default)]
pub struct Slide {
    pub title: Option<String>,
    pub contents: Vec<SlideContent>,
    pub notes: Option<String>,
    pub background_color: Option<String>,
}

impl Slide {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_title(mut self, title: impl Into<String>) -> Self {
        self.title = Some(title.into());
        self
    }

    pub fn with_content(mut self, content: SlideContent) -> Self {
        self.contents.push(content);
        self
    }
}

/// A presentation (deck of slides)
#[derive(Debug, Clone, Default)]
pub struct Presentation {
    pub title: String,
    pub author: Option<String>,
    pub slides: Vec<Slide>,
    pub theme: Option<String>,
}

impl Presentation {
    pub fn new(title: impl Into<String>) -> Self {
        Self {
            title: title.into(),
            ..Default::default()
        }
    }

    pub fn with_author(mut self, author: impl Into<String>) -> Self {
        self.author = Some(author.into());
        self
    }

    pub fn add_slide(&mut self, slide: Slide) {
        self.slides.push(slide);
    }

    pub fn with_slide(mut self, slide: Slide) -> Self {
        self.slides.push(slide);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_slide_creation() {
        let slide = Slide::new()
            .with_title("Test Slide")
            .with_content(SlideContent::Body(vec![]));

        assert_eq!(slide.title, Some("Test Slide".to_string()));
        assert_eq!(slide.contents.len(), 1);
    }

    #[test]
    fn test_presentation_creation() {
        let presentation = Presentation::new("Test Deck")
            .with_author("Test Author")
            .with_slide(Slide::new().with_title("Slide 1"));

        assert_eq!(presentation.title, "Test Deck");
        assert_eq!(presentation.author, Some("Test Author".to_string()));
        assert_eq!(presentation.slides.len(), 1);
    }
}
