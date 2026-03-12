//! Markdown conversion utilities.

use super::ConversionError;
use comrak::{markdown_to_html as comrak_md_to_html, ComrakOptions};

/// Convert Markdown to HTML using comrak
pub fn markdown_to_html(markdown: &str) -> Result<String, ConversionError> {
    let mut options = ComrakOptions::default();

    // Enable GitHub Flavored Markdown features
    options.extension.strikethrough = true;
    options.extension.table = true;
    options.extension.autolink = true;
    options.extension.tasklist = true;
    options.extension.superscript = true;

    // Render options
    options.render.unsafe_ = true; // Allow raw HTML
    options.render.github_pre_lang = true;

    let html = comrak_md_to_html(markdown, &options);

    // Wrap in HTML document structure
    Ok(format!(
        "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"></head><body>{}</body></html>",
        html
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_markdown() {
        let md = "# Hello World\n\nThis is a paragraph.";
        let html = markdown_to_html(md).unwrap();
        assert!(html.contains("<h1>Hello World</h1>"));
        assert!(html.contains("<p>This is a paragraph.</p>"));
    }

    #[test]
    fn test_bold_italic() {
        let md = "**bold** and *italic*";
        let html = markdown_to_html(md).unwrap();
        assert!(html.contains("<strong>bold</strong>"));
        assert!(html.contains("<em>italic</em>"));
    }

    #[test]
    fn test_task_list() {
        let md = "- [x] Done\n- [ ] Todo";
        let html = markdown_to_html(md).unwrap();
        assert!(html.contains("checked"));
    }
}
