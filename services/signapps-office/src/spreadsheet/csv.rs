//! CSV import/export functionality.

use std::io::{BufRead, BufReader, Cursor, Write};

use super::{Cell, CellStyle, CellValue, Sheet, Spreadsheet, SpreadsheetError};

/// Import CSV data to Spreadsheet structure
pub fn csv_to_spreadsheet(
    data: &[u8],
    delimiter: Option<char>,
    _has_headers: bool,
) -> Result<Spreadsheet, SpreadsheetError> {
    let content = String::from_utf8(data.to_vec())
        .map_err(|e| SpreadsheetError::InvalidInput(format!("Invalid UTF-8: {}", e)))?;

    // Auto-detect delimiter if not specified
    let delimiter = delimiter.unwrap_or_else(|| detect_delimiter(&content));

    let mut sheet = Sheet::new("Sheet1");
    let reader = BufReader::new(Cursor::new(content));

    for line_result in reader.lines() {
        let line = line_result.map_err(SpreadsheetError::IoError)?;

        if line.trim().is_empty() {
            continue;
        }

        let cells = parse_csv_line(&line, delimiter);
        let row: Vec<Cell> = cells
            .into_iter()
            .map(|value| {
                let cell_value = parse_cell_value(&value);
                Cell {
                    value: cell_value,
                    style: CellStyle::default(),
                    formula: None,
                }
            })
            .collect();

        sheet.rows.push(row);
    }

    let mut spreadsheet = Spreadsheet::new();
    spreadsheet.add_sheet(sheet);

    Ok(spreadsheet)
}

/// Export Spreadsheet to CSV bytes
pub fn spreadsheet_to_csv(
    spreadsheet: &Spreadsheet,
    delimiter: Option<char>,
    sheet_index: Option<usize>,
) -> Result<Vec<u8>, SpreadsheetError> {
    let delimiter = delimiter.unwrap_or(',');
    let sheet_idx = sheet_index.unwrap_or(0);

    let sheet = spreadsheet
        .sheets
        .get(sheet_idx)
        .ok_or_else(|| SpreadsheetError::InvalidInput("Sheet not found".to_string()))?;

    let mut output = Vec::new();

    for row in &sheet.rows {
        let cells: Vec<String> = row
            .iter()
            .map(|cell| format_csv_value(&cell.value, delimiter))
            .collect();

        writeln!(output, "{}", cells.join(&delimiter.to_string()))
            .map_err(SpreadsheetError::IoError)?;
    }

    Ok(output)
}

/// Convert JSON to CSV bytes
pub fn json_to_csv(
    json: &serde_json::Value,
    delimiter: Option<char>,
) -> Result<Vec<u8>, SpreadsheetError> {
    let spreadsheet = super::export::parse_json_to_spreadsheet(json)?;
    spreadsheet_to_csv(&spreadsheet, delimiter, None)
}

/// Detect delimiter from content
fn detect_delimiter(content: &str) -> char {
    let first_line = content.lines().next().unwrap_or("");

    let comma_count = first_line.matches(',').count();
    let semicolon_count = first_line.matches(';').count();
    let tab_count = first_line.matches('\t').count();

    if tab_count > comma_count && tab_count > semicolon_count {
        '\t'
    } else if semicolon_count > comma_count {
        ';'
    } else {
        ','
    }
}

/// Parse a CSV line respecting quotes
fn parse_csv_line(line: &str, delimiter: char) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '"' {
            if in_quotes {
                // Check for escaped quote
                if chars.peek() == Some(&'"') {
                    current.push('"');
                    chars.next();
                } else {
                    in_quotes = false;
                }
            } else {
                in_quotes = true;
            }
        } else if c == delimiter && !in_quotes {
            result.push(current.trim().to_string());
            current = String::new();
        } else {
            current.push(c);
        }
    }

    result.push(current.trim().to_string());
    result
}

/// Parse cell value from string
fn parse_cell_value(value: &str) -> CellValue {
    let trimmed = value.trim();

    if trimmed.is_empty() {
        return CellValue::Empty;
    }

    // Try to parse as number
    if let Ok(n) = trimmed.parse::<f64>() {
        return CellValue::Number(n);
    }

    // Try to parse as boolean
    match trimmed.to_lowercase().as_str() {
        "true" | "vrai" | "oui" | "yes" | "1" => return CellValue::Bool(true),
        "false" | "faux" | "non" | "no" | "0" => return CellValue::Bool(false),
        _ => {}
    }

    // Check for formula
    if trimmed.starts_with('=') {
        return CellValue::Formula(trimmed.to_string());
    }

    CellValue::String(trimmed.to_string())
}

/// Format cell value for CSV output
fn format_csv_value(value: &CellValue, delimiter: char) -> String {
    match value {
        CellValue::Empty => String::new(),
        CellValue::String(s) => {
            if s.contains(delimiter) || s.contains('"') || s.contains('\n') {
                format!("\"{}\"", s.replace('"', "\"\""))
            } else {
                s.clone()
            }
        }
        CellValue::Number(n) => {
            if n.fract() == 0.0 {
                format!("{}", *n as i64)
            } else {
                format!("{}", n)
            }
        }
        CellValue::Bool(b) => if *b { "TRUE" } else { "FALSE" }.to_string(),
        CellValue::Formula(f) => f.clone(),
        CellValue::Date(d) => d.clone(),
        CellValue::Error(e) => format!("#ERROR: {}", e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_delimiter_comma() {
        let content = "a,b,c\n1,2,3";
        assert_eq!(detect_delimiter(content), ',');
    }

    #[test]
    fn test_detect_delimiter_semicolon() {
        let content = "a;b;c\n1;2;3";
        assert_eq!(detect_delimiter(content), ';');
    }

    #[test]
    fn test_detect_delimiter_tab() {
        let content = "a\tb\tc\n1\t2\t3";
        assert_eq!(detect_delimiter(content), '\t');
    }

    #[test]
    fn test_parse_csv_line_simple() {
        let line = "a,b,c";
        let result = parse_csv_line(line, ',');
        assert_eq!(result, vec!["a", "b", "c"]);
    }

    #[test]
    fn test_parse_csv_line_quoted() {
        let line = r#""hello, world",b,"c""d""#;
        let result = parse_csv_line(line, ',');
        assert_eq!(result, vec!["hello, world", "b", "c\"d"]);
    }

    #[test]
    fn test_csv_roundtrip() {
        let csv_data = b"Name,Value,Active\nAlice,100,true\nBob,200,false";
        let spreadsheet = csv_to_spreadsheet(csv_data, Some(','), true).unwrap();

        assert_eq!(spreadsheet.sheets.len(), 1);
        assert_eq!(spreadsheet.sheets[0].rows.len(), 3);

        let exported = spreadsheet_to_csv(&spreadsheet, Some(','), None).unwrap();
        let exported_str = String::from_utf8(exported).unwrap();

        assert!(exported_str.contains("Alice"));
        assert!(exported_str.contains("100"));
    }

    #[test]
    fn test_parse_cell_value_number() {
        assert!(matches!(parse_cell_value("42"), CellValue::Number(_)));
        assert!(matches!(parse_cell_value("3.14"), CellValue::Number(_)));
    }

    #[test]
    fn test_parse_cell_value_boolean() {
        assert!(matches!(parse_cell_value("true"), CellValue::Bool(true)));
        assert!(matches!(parse_cell_value("FALSE"), CellValue::Bool(false)));
    }
}
