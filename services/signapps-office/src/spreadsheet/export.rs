//! XLSX export functionality.

use rust_xlsxwriter::{Format, Workbook, Worksheet, XlsxError};

use super::{CellValue, Sheet, Spreadsheet, SpreadsheetError};

/// Convert a spreadsheet to XLSX bytes
pub fn spreadsheet_to_xlsx(spreadsheet: &Spreadsheet) -> Result<Vec<u8>, SpreadsheetError> {
    let mut workbook = Workbook::new();

    for sheet in &spreadsheet.sheets {
        let worksheet = workbook.add_worksheet();
        write_sheet(worksheet, sheet)?;
    }

    workbook
        .save_to_buffer()
        .map_err(|e| SpreadsheetError::ConversionFailed(e.to_string()))
}

/// Convert JSON data (Handsontable format) to XLSX bytes
pub fn json_to_xlsx(json: &serde_json::Value) -> Result<Vec<u8>, SpreadsheetError> {
    let spreadsheet = parse_json_to_spreadsheet(json)?;
    spreadsheet_to_xlsx(&spreadsheet)
}

/// Parse Handsontable-style JSON to Spreadsheet
pub fn parse_json_to_spreadsheet(json: &serde_json::Value) -> Result<Spreadsheet, SpreadsheetError> {
    let mut spreadsheet = Spreadsheet::new();

    // Handle single sheet (array of arrays)
    if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
        let sheet = parse_sheet_data("Sheet1", data)?;
        spreadsheet.add_sheet(sheet);
    }
    // Handle multiple sheets
    else if let Some(sheets) = json.get("sheets").and_then(|s| s.as_array()) {
        for (i, sheet_json) in sheets.iter().enumerate() {
            let name = sheet_json
                .get("name")
                .and_then(|n| n.as_str())
                .unwrap_or(&format!("Sheet{}", i + 1))
                .to_string();

            if let Some(data) = sheet_json.get("data").and_then(|d| d.as_array()) {
                let sheet = parse_sheet_data(&name, data)?;
                spreadsheet.add_sheet(sheet);
            }
        }
    }
    // Handle raw array of arrays
    else if let Some(data) = json.as_array() {
        let sheet = parse_sheet_data("Sheet1", data)?;
        spreadsheet.add_sheet(sheet);
    }

    if spreadsheet.sheets.is_empty() {
        return Err(SpreadsheetError::InvalidInput(
            "No valid sheet data found".to_string(),
        ));
    }

    Ok(spreadsheet)
}

fn parse_sheet_data(
    name: &str,
    data: &[serde_json::Value],
) -> Result<Sheet, SpreadsheetError> {
    let mut sheet = Sheet::new(name);

    for row_data in data {
        let mut row = Vec::new();

        if let Some(cells) = row_data.as_array() {
            for cell_data in cells {
                let cell = parse_cell_value(cell_data);
                row.push(cell);
            }
        }

        sheet.rows.push(row);
    }

    Ok(sheet)
}

fn parse_cell_value(value: &serde_json::Value) -> super::Cell {
    let cell_value = match value {
        serde_json::Value::Null => CellValue::Empty,
        serde_json::Value::Bool(b) => CellValue::Bool(*b),
        serde_json::Value::Number(n) => {
            if let Some(f) = n.as_f64() {
                CellValue::Number(f)
            } else {
                CellValue::String(n.to_string())
            }
        }
        serde_json::Value::String(s) => {
            // Check if it's a formula
            if s.starts_with('=') {
                CellValue::Formula(s.clone())
            } else {
                CellValue::String(s.clone())
            }
        }
        serde_json::Value::Object(obj) => {
            // Handle cell object with value and style
            if let Some(v) = obj.get("value") {
                return parse_cell_value(v);
            }
            CellValue::Empty
        }
        serde_json::Value::Array(_) => CellValue::Empty,
    };

    super::Cell {
        value: cell_value,
        style: super::CellStyle::default(),
        formula: None,
    }
}

fn write_sheet(worksheet: &mut Worksheet, sheet: &Sheet) -> Result<(), SpreadsheetError> {
    // Set sheet name
    worksheet
        .set_name(&sheet.name)
        .map_err(|e: XlsxError| SpreadsheetError::ConversionFailed(e.to_string()))?;

    // Write cell data
    for (row_idx, row) in sheet.rows.iter().enumerate() {
        for (col_idx, cell) in row.iter().enumerate() {
            write_cell(worksheet, row_idx as u32, col_idx as u16, cell)?;
        }
    }

    // Set column widths if specified
    for (col_idx, width) in sheet.column_widths.iter().enumerate() {
        worksheet
            .set_column_width(col_idx as u16, *width)
            .map_err(|e: XlsxError| SpreadsheetError::ConversionFailed(e.to_string()))?;
    }

    // Set frozen panes
    if sheet.frozen_rows > 0 || sheet.frozen_cols > 0 {
        let _ = worksheet.set_freeze_panes(sheet.frozen_rows as u32, sheet.frozen_cols as u16);
    }

    Ok(())
}

fn write_cell(
    worksheet: &mut Worksheet,
    row: u32,
    col: u16,
    cell: &super::Cell,
) -> Result<(), SpreadsheetError> {
    let format = build_cell_format(&cell.style);

    match &cell.value {
        CellValue::Empty => {}
        CellValue::String(s) => {
            worksheet
                .write_string_with_format(row, col, s, &format)
                .map_err(|e: XlsxError| SpreadsheetError::ConversionFailed(e.to_string()))?;
        }
        CellValue::Number(n) => {
            worksheet
                .write_number_with_format(row, col, *n, &format)
                .map_err(|e: XlsxError| SpreadsheetError::ConversionFailed(e.to_string()))?;
        }
        CellValue::Bool(b) => {
            worksheet
                .write_boolean_with_format(row, col, *b, &format)
                .map_err(|e: XlsxError| SpreadsheetError::ConversionFailed(e.to_string()))?;
        }
        CellValue::Formula(f) => {
            worksheet
                .write_formula_with_format(row, col, f.as_str(), &format)
                .map_err(|e: XlsxError| SpreadsheetError::ConversionFailed(e.to_string()))?;
        }
        CellValue::Date(d) => {
            // Write date as string for now
            worksheet
                .write_string_with_format(row, col, d, &format)
                .map_err(|e: XlsxError| SpreadsheetError::ConversionFailed(e.to_string()))?;
        }
        CellValue::Error(e) => {
            worksheet
                .write_string_with_format(row, col, e, &format)
                .map_err(|e: XlsxError| SpreadsheetError::ConversionFailed(e.to_string()))?;
        }
    }

    Ok(())
}

fn build_cell_format(style: &super::CellStyle) -> Format {
    let mut format = Format::new();

    if style.bold {
        format = format.set_bold();
    }
    if style.italic {
        format = format.set_italic();
    }
    if style.underline {
        format = format.set_underline(rust_xlsxwriter::FormatUnderline::Single);
    }
    if let Some(size) = style.font_size {
        format = format.set_font_size(size);
    }

    format
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_spreadsheet_export() {
        let mut sheet = Sheet::new("Test");
        sheet.rows.push(vec![
            super::super::Cell {
                value: CellValue::String("Header 1".to_string()),
                ..Default::default()
            },
            super::super::Cell {
                value: CellValue::String("Header 2".to_string()),
                ..Default::default()
            },
        ]);
        sheet.rows.push(vec![
            super::super::Cell {
                value: CellValue::Number(42.0),
                ..Default::default()
            },
            super::super::Cell {
                value: CellValue::Number(3.14),
                ..Default::default()
            },
        ]);

        let spreadsheet = Spreadsheet::new().with_sheet(sheet);
        let result = spreadsheet_to_xlsx(&spreadsheet);

        assert!(result.is_ok());
        let bytes = result.unwrap();
        // XLSX files start with PK (ZIP signature)
        assert!(bytes.len() > 4);
        assert_eq!(&bytes[0..2], b"PK");
    }

    #[test]
    fn test_json_to_xlsx() {
        let json = serde_json::json!({
            "data": [
                ["Name", "Value"],
                ["Item 1", 100],
                ["Item 2", 200]
            ]
        });

        let result = json_to_xlsx(&json);
        assert!(result.is_ok());
    }

    #[test]
    fn test_raw_array_json() {
        let json = serde_json::json!([
            ["A", "B", "C"],
            [1, 2, 3],
            [4, 5, 6]
        ]);

        let result = json_to_xlsx(&json);
        assert!(result.is_ok());
    }
}
