//! PDF parsing utilities (placeholder module).
//!
//! Note: PDF generation is handled by converter/pdf.rs using printpdf.
//! This module is reserved for future PDF parsing needs.

/// Generate PDF placeholder - actual implementation in converter/pdf.rs
pub fn generate_pdf() -> Result<Vec<u8>, &'static str> {
    Err("Use converter::pdf::html_to_pdf instead")
}
