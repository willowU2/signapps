//! CSV/TSV filter — imports/exports delimiter-separated values as spreadsheets.
//!
//! Import auto-detects the delimiter (comma, semicolon, tab) and parses rows
//! into `DocBody::Spreadsheet`. Numbers are auto-detected where possible.
//! Export produces RFC 4180-compliant CSV (comma-delimited).

use crate::error::{FilterError, FilterResult};
use crate::intermediate::{
    CellData, CellValue, DocBody, DocMetadata, DocType, IntermediateDocument, RowData, SheetData,
};
use crate::traits::FilterTrait;

/// Converts CSV/TSV files to/from `IntermediateDocument`.
///
/// Import uses a heuristic to detect the delimiter and parses all rows into
/// a single sheet named "Sheet1". Numeric values are stored as `CellValue::Number`.
///
/// Export joins cells with commas. Fields containing commas, quotes, or newlines
/// are quoted per RFC 4180.
pub struct CsvFilter;

impl FilterTrait for CsvFilter {
    fn name(&self) -> &str {
        "CSV Filter"
    }

    fn mime_types(&self) -> &[&str] {
        &["text/csv", "text/tab-separated-values"]
    }

    fn extensions(&self) -> &[&str] {
        &["csv", "tsv"]
    }

    fn import(&self, bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        let text = std::str::from_utf8(bytes)
            .map_err(|e| FilterError::ImportFailed(format!("invalid UTF-8: {e}")))?;

        let delimiter = detect_delimiter(text);
        let rows = parse_csv(text, delimiter);

        let sheet = SheetData {
            name: "Sheet1".to_string(),
            rows,
            col_widths: Vec::new(),
            frozen_rows: 0,
            frozen_cols: 0,
        };

        Ok(IntermediateDocument {
            doc_type: DocType::Spreadsheet,
            metadata: DocMetadata::default(),
            body: DocBody::Spreadsheet {
                sheets: vec![sheet],
            },
        })
    }

    fn export(&self, doc: &IntermediateDocument) -> FilterResult<Vec<u8>> {
        let sheets = match &doc.body {
            DocBody::Spreadsheet { sheets } => sheets,
            other => {
                return Err(FilterError::ExportFailed(format!(
                    "CsvFilter cannot export {:?} body",
                    std::mem::discriminant(other)
                )));
            },
        };

        let sheet = sheets.first().ok_or_else(|| {
            FilterError::ExportFailed("CsvFilter: no sheets to export".to_string())
        })?;

        let mut buf = String::new();
        for (i, row) in sheet.rows.iter().enumerate() {
            if i > 0 {
                buf.push('\n');
            }
            for (j, cell) in row.cells.iter().enumerate() {
                if j > 0 {
                    buf.push(',');
                }
                let text = cell_value_to_string(&cell.value);
                buf.push_str(&csv_quote(&text));
            }
        }

        Ok(buf.into_bytes())
    }

    fn export_mime_type(&self) -> &str {
        "text/csv"
    }

    fn export_extension(&self) -> &str {
        "csv"
    }
}

/// Detect the most likely delimiter for a CSV-like text.
fn detect_delimiter(text: &str) -> char {
    let lines: Vec<&str> = text.lines().take(10).collect();
    if lines.len() < 2 {
        return ',';
    }

    for &delim in &['\t', ';', ','] {
        let counts: Vec<usize> = lines
            .iter()
            .filter(|l| !l.trim().is_empty())
            .map(|l| l.matches(delim).count())
            .collect();

        if !counts.is_empty() {
            let first = counts[0];
            if first > 0 && counts.iter().all(|&c| c == first) {
                return delim;
            }
        }
    }

    ','
}

/// Parse CSV text into rows of cells, handling quoted fields.
fn parse_csv(text: &str, delimiter: char) -> Vec<RowData> {
    let mut rows = Vec::new();

    for line in text.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let fields = split_csv_line(line, delimiter);
        let cells: Vec<CellData> = fields
            .into_iter()
            .map(|field| {
                let value = parse_cell_value(&field);
                CellData {
                    value,
                    formula: None,
                    style: None,
                }
            })
            .collect();
        rows.push(RowData {
            cells,
            height: None,
        });
    }

    rows
}

/// Split a CSV line by delimiter, respecting quoted fields.
fn split_csv_line(line: &str, delimiter: char) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();

    while let Some(ch) = chars.next() {
        if in_quotes {
            if ch == '"' {
                // Check for escaped quote ("")
                if chars.peek() == Some(&'"') {
                    current.push('"');
                    chars.next();
                } else {
                    in_quotes = false;
                }
            } else {
                current.push(ch);
            }
        } else if ch == '"' {
            in_quotes = true;
        } else if ch == delimiter {
            fields.push(current.clone());
            current.clear();
        } else {
            current.push(ch);
        }
    }
    fields.push(current);

    fields
}

/// Try to parse a field value as a number, boolean, or leave as text.
fn parse_cell_value(field: &str) -> CellValue {
    let trimmed = field.trim();
    if trimmed.is_empty() {
        return CellValue::Empty;
    }

    // Boolean detection
    match trimmed.to_lowercase().as_str() {
        "true" => return CellValue::Bool(true),
        "false" => return CellValue::Bool(false),
        _ => {},
    }

    // Number detection
    if let Ok(n) = trimmed.parse::<f64>() {
        return CellValue::Number(n);
    }

    CellValue::Text(trimmed.to_string())
}

/// Convert a `CellValue` to its string representation for CSV export.
fn cell_value_to_string(value: &CellValue) -> String {
    match value {
        CellValue::Empty => String::new(),
        CellValue::Text(s) => s.clone(),
        CellValue::Number(n) => {
            // Avoid trailing ".0" for integers
            if n.fract() == 0.0 && n.abs() < i64::MAX as f64 {
                format!("{}", *n as i64)
            } else {
                n.to_string()
            }
        },
        CellValue::Bool(b) => b.to_string(),
        CellValue::Date(d) => d.clone(),
        CellValue::Error(e) => e.clone(),
    }
}

/// Quote a CSV field if it contains special characters.
fn csv_quote(field: &str) -> String {
    if field.contains(',') || field.contains('"') || field.contains('\n') || field.contains('\r') {
        let escaped = field.replace('"', "\"\"");
        format!("\"{escaped}\"")
    } else {
        field.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn import_basic_csv() {
        let csv = b"name,age,city\nAlice,30,Paris\nBob,25,Lyon";
        let filter = CsvFilter;
        let doc = filter.import(csv).expect("import failed");

        assert_eq!(doc.doc_type, DocType::Spreadsheet);
        if let DocBody::Spreadsheet { sheets } = &doc.body {
            assert_eq!(sheets.len(), 1);
            assert_eq!(sheets[0].rows.len(), 3);
            // Header row
            assert!(matches!(&sheets[0].rows[0].cells[0].value, CellValue::Text(s) if s == "name"));
            // Number detection
            assert!(
                matches!(&sheets[0].rows[1].cells[1].value, CellValue::Number(n) if (*n - 30.0).abs() < f64::EPSILON)
            );
        } else {
            panic!("expected Spreadsheet body");
        }
    }

    #[test]
    fn import_tab_separated() {
        let tsv = b"a\tb\tc\n1\t2\t3\n4\t5\t6";
        let filter = CsvFilter;
        let doc = filter.import(tsv).expect("import failed");

        if let DocBody::Spreadsheet { sheets } = &doc.body {
            assert_eq!(sheets[0].rows.len(), 3);
        } else {
            panic!("expected Spreadsheet body");
        }
    }

    #[test]
    fn export_roundtrip() {
        let csv_input = b"name,age\nAlice,30\nBob,25";
        let filter = CsvFilter;
        let doc = filter.import(csv_input).expect("import failed");
        let exported = filter.export(&doc).expect("export failed");
        let text = String::from_utf8(exported).expect("valid UTF-8");
        assert!(text.contains("Alice"));
        assert!(text.contains("30"));
    }

    #[test]
    fn csv_quoting() {
        assert_eq!(csv_quote("hello"), "hello");
        assert_eq!(csv_quote("hello,world"), "\"hello,world\"");
        assert_eq!(csv_quote("say \"hi\""), "\"say \"\"hi\"\"\"");
    }
}
