//! ODS (OpenDocument Spreadsheet) export functionality.
//!
//! ODS is a ZIP archive containing XML files following the ODF (Open Document Format) specification.

use std::io::{Cursor, Write};
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use super::{CellValue, Spreadsheet, SpreadsheetError};

/// Convert a Spreadsheet to ODS bytes
pub fn spreadsheet_to_ods(spreadsheet: &Spreadsheet) -> Result<Vec<u8>, SpreadsheetError> {
    let buffer = Cursor::new(Vec::new());
    let mut zip = ZipWriter::new(buffer);
    let options = SimpleFileOptions::default();

    // 1. mimetype (must be first, uncompressed)
    zip.start_file("mimetype", SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored))
        .map_err(|e| SpreadsheetError::ConversionFailed(e.to_string()))?;
    zip.write_all(b"application/vnd.oasis.opendocument.spreadsheet")
        .map_err(|e| SpreadsheetError::IoError(e))?;

    // 2. META-INF/manifest.xml
    zip.start_file("META-INF/manifest.xml", options)
        .map_err(|e| SpreadsheetError::ConversionFailed(e.to_string()))?;
    zip.write_all(generate_manifest().as_bytes())
        .map_err(|e| SpreadsheetError::IoError(e))?;

    // 3. meta.xml
    zip.start_file("meta.xml", options)
        .map_err(|e| SpreadsheetError::ConversionFailed(e.to_string()))?;
    zip.write_all(generate_meta().as_bytes())
        .map_err(|e| SpreadsheetError::IoError(e))?;

    // 4. styles.xml
    zip.start_file("styles.xml", options)
        .map_err(|e| SpreadsheetError::ConversionFailed(e.to_string()))?;
    zip.write_all(generate_styles().as_bytes())
        .map_err(|e| SpreadsheetError::IoError(e))?;

    // 5. content.xml (main data)
    zip.start_file("content.xml", options)
        .map_err(|e| SpreadsheetError::ConversionFailed(e.to_string()))?;
    zip.write_all(generate_content(spreadsheet).as_bytes())
        .map_err(|e| SpreadsheetError::IoError(e))?;

    let cursor = zip
        .finish()
        .map_err(|e| SpreadsheetError::ConversionFailed(e.to_string()))?;

    Ok(cursor.into_inner())
}

/// Convert JSON data to ODS bytes
pub fn json_to_ods(json: &serde_json::Value) -> Result<Vec<u8>, SpreadsheetError> {
    let spreadsheet = super::export::parse_json_to_spreadsheet(json)?;
    spreadsheet_to_ods(&spreadsheet)
}

fn generate_manifest() -> String {
    r#"<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>"#.to_string()
}

fn generate_meta() -> String {
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ");
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                      xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"
                      xmlns:dc="http://purl.org/dc/elements/1.1/"
                      office:version="1.2">
  <office:meta>
    <meta:generator>SignApps Office</meta:generator>
    <meta:creation-date>{}</meta:creation-date>
    <dc:creator>SignApps</dc:creator>
  </office:meta>
</office:document-meta>"#,
        now
    )
}

fn generate_styles() -> String {
    r#"<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                        xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
                        xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
                        xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
                        office:version="1.2">
  <office:styles>
    <style:default-style style:family="table-cell">
      <style:paragraph-properties fo:text-align="start"/>
      <style:text-properties fo:font-size="10pt" fo:font-family="Arial"/>
    </style:default-style>
  </office:styles>
</office:document-styles>"#.to_string()
}

fn generate_content(spreadsheet: &Spreadsheet) -> String {
    let mut content = String::new();

    // XML declaration and namespaces
    content.push_str(r#"<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                         xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
                         xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
                         xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
                         xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
                         xmlns:calcext="urn:org:documentfoundation:names:experimental:calc:xmlns:calcext:1.0"
                         office:version="1.2">
  <office:body>
    <office:spreadsheet>
"#);

    // Generate each sheet
    for sheet in &spreadsheet.sheets {
        content.push_str(&format!(
            r#"      <table:table table:name="{}">
"#,
            escape_xml(&sheet.name)
        ));

        // Define columns
        let max_cols = sheet.rows.iter().map(|r| r.len()).max().unwrap_or(0);
        if max_cols > 0 {
            content.push_str(&format!(
                r#"        <table:table-column table:number-columns-repeated="{}"/>
"#,
                max_cols
            ));
        }

        // Generate rows
        for row in &sheet.rows {
            content.push_str("        <table:table-row>\n");

            for cell in row {
                content.push_str(&format_cell(cell));
            }

            // Fill remaining columns with empty cells
            if row.len() < max_cols {
                for _ in row.len()..max_cols {
                    content.push_str("          <table:table-cell/>\n");
                }
            }

            content.push_str("        </table:table-row>\n");
        }

        content.push_str("      </table:table>\n");
    }

    content.push_str(r#"    </office:spreadsheet>
  </office:body>
</office:document-content>"#);

    content
}

fn format_cell(cell: &super::Cell) -> String {
    match &cell.value {
        CellValue::Empty => "          <table:table-cell/>\n".to_string(),

        CellValue::String(s) => {
            format!(
                r#"          <table:table-cell office:value-type="string">
            <text:p>{}</text:p>
          </table:table-cell>
"#,
                escape_xml(s)
            )
        }

        CellValue::Number(n) => {
            let display = if n.fract() == 0.0 {
                format!("{}", *n as i64)
            } else {
                format!("{}", n)
            };
            format!(
                r#"          <table:table-cell office:value-type="float" office:value="{}">
            <text:p>{}</text:p>
          </table:table-cell>
"#,
                n, display
            )
        }

        CellValue::Bool(b) => {
            let value = if *b { "true" } else { "false" };
            let display = if *b { "TRUE" } else { "FALSE" };
            format!(
                r#"          <table:table-cell office:value-type="boolean" office:boolean-value="{}">
            <text:p>{}</text:p>
          </table:table-cell>
"#,
                value, display
            )
        }

        CellValue::Formula(f) => {
            // ODS uses different formula syntax, but we output as-is
            format!(
                r#"          <table:table-cell table:formula="{}">
            <text:p></text:p>
          </table:table-cell>
"#,
                escape_xml(f)
            )
        }

        CellValue::Date(d) => {
            format!(
                r#"          <table:table-cell office:value-type="date" office:date-value="{}">
            <text:p>{}</text:p>
          </table:table-cell>
"#,
                escape_xml(d),
                escape_xml(d)
            )
        }

        CellValue::Error(e) => {
            format!(
                r#"          <table:table-cell office:value-type="string">
            <text:p>#ERROR: {}</text:p>
          </table:table-cell>
"#,
                escape_xml(e)
            )
        }
    }
}

fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::spreadsheet::{Cell, Sheet};

    #[test]
    fn test_ods_export() {
        let mut sheet = Sheet::new("Test");
        sheet.rows.push(vec![
            Cell {
                value: CellValue::String("Header".to_string()),
                ..Default::default()
            },
            Cell {
                value: CellValue::Number(42.0),
                ..Default::default()
            },
        ]);

        let spreadsheet = Spreadsheet::new().with_sheet(sheet);
        let result = spreadsheet_to_ods(&spreadsheet);

        assert!(result.is_ok());
        let bytes = result.unwrap();
        // ODS files are ZIP archives starting with PK
        assert!(bytes.len() > 4);
        assert_eq!(&bytes[0..2], b"PK");
    }

    #[test]
    fn test_json_to_ods() {
        let json = serde_json::json!({
            "data": [
                ["Name", "Value"],
                ["Item", 100]
            ]
        });

        let result = json_to_ods(&json);
        assert!(result.is_ok());
    }
}
