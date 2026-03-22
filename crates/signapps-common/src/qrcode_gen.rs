//! QR Code generation utilities
//!
//! Generates SVG-based QR codes for quick sharing of data.

use qrcode::QrCode;
use qrcode::render::svg;

/// Generate a QR code as SVG string
///
/// # Arguments
/// * `data` - The data to encode in the QR code
///
/// # Returns
/// A String containing SVG markup representing the QR code
///
/// # Example
/// ```ignore
/// let qr_svg = generate_qr_svg("https://example.com/share/abc123")?;
/// ```
pub fn generate_qr_svg(data: &str) -> Result<String, qrcode::types::QrError> {
    let code = QrCode::new(data)?;
    let image = code
        .render::<svg::Color>()
        .min_dimensions(200, 200)
        .build();
    Ok(image)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_qr_svg() {
        let svg = generate_qr_svg("https://example.com").unwrap();
        assert!(svg.contains("<svg"));
        assert!(svg.contains("</svg>"));
    }

    #[test]
    fn test_generate_qr_empty_data() {
        let svg = generate_qr_svg("").unwrap();
        assert!(svg.contains("<svg"));
    }
}
