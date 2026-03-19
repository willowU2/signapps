//! XLSX import functionality.

use calamine::{open_workbook_auto_from_rs, Data, Reader};
use std::io::Cursor;

use super::{Cell, CellStyle, CellValue, Sheet, Spreadsheet, SpreadsheetError};

/// Import XLSX bytes to Spreadsheet structure
pub fn xlsx_to_spreadsheet(data: &[u8]) -> Result<Spreadsheet, SpreadsheetError> {
    let cursor = Cursor::new(data);
    let mut workbook = open_workbook_auto_from_rs(cursor)
        .map_err(|e| SpreadsheetError::InvalidInput(e.to_string()))?;

    let mut spreadsheet = Spreadsheet::new();

    for sheet_name in workbook.sheet_names().to_vec() {
        if let Ok(range) = workbook.worksheet_range(&sheet_name) {
            let mut sheet = Sheet::new(&sheet_name);

            for row in range.rows() {
                let mut cells = Vec::new();

                for cell in row {
                    let cell_value = match cell {
                        Data::Empty => CellValue::Empty,
                        Data::String(s) => CellValue::String(s.clone()),
                        Data::Float(f) => CellValue::Number(*f),
                        Data::Int(i) => CellValue::Number(*i as f64),
                        Data::Bool(b) => CellValue::Bool(*b),
                        Data::DateTime(dt) => {
                            // Use ISO 8601 format from ExcelDateTime
                            CellValue::Date(dt.to_string())
                        },
                        Data::Error(e) => CellValue::Error(format!("{:?}", e)),
                        Data::DateTimeIso(s) => CellValue::Date(s.clone()),
                        Data::DurationIso(s) => CellValue::String(s.clone()),
                    };

                    cells.push(Cell {
                        value: cell_value,
                        style: CellStyle::default(),
                        formula: None,
                    });
                }

                sheet.rows.push(cells);
            }

            spreadsheet.add_sheet(sheet);
        }
    }

    Ok(spreadsheet)
}

/// Import XLSX to JSON (Handsontable compatible format)
pub fn xlsx_to_json(data: &[u8]) -> Result<serde_json::Value, SpreadsheetError> {
    let spreadsheet = xlsx_to_spreadsheet(data)?;
    spreadsheet_to_json(&spreadsheet)
}

/// Convert Spreadsheet to JSON
pub fn spreadsheet_to_json(
    spreadsheet: &Spreadsheet,
) -> Result<serde_json::Value, SpreadsheetError> {
    if spreadsheet.sheets.len() == 1 {
        // Single sheet - return simple format
        let sheet = &spreadsheet.sheets[0];
        Ok(serde_json::json!({
            "name": sheet.name,
            "data": sheet_to_json_data(sheet)
        }))
    } else {
        // Multiple sheets
        let sheets: Vec<serde_json::Value> = spreadsheet
            .sheets
            .iter()
            .map(|sheet| {
                serde_json::json!({
                    "name": sheet.name,
                    "data": sheet_to_json_data(sheet)
                })
            })
            .collect();

        Ok(serde_json::json!({
            "sheets": sheets,
            "activeSheet": spreadsheet.active_sheet
        }))
    }
}

fn sheet_to_json_data(sheet: &Sheet) -> Vec<Vec<serde_json::Value>> {
    sheet
        .rows
        .iter()
        .map(|row| {
            row.iter()
                .map(|cell| cell_to_json_value(&cell.value))
                .collect()
        })
        .collect()
}

fn cell_to_json_value(value: &CellValue) -> serde_json::Value {
    match value {
        CellValue::Empty => serde_json::Value::Null,
        CellValue::String(s) => serde_json::Value::String(s.clone()),
        CellValue::Number(n) => serde_json::Number::from_f64(*n)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        CellValue::Bool(b) => serde_json::Value::Bool(*b),
        CellValue::Formula(f) => serde_json::Value::String(f.clone()),
        CellValue::Date(d) => serde_json::Value::String(d.clone()),
        CellValue::Error(e) => serde_json::Value::String(e.clone()),
    }
}

fn format_excel_datetime(dt: f64) -> String {
    // Excel datetime is days since 1899-12-30
    // This is a simplified conversion - for production, use chrono
    let days = dt.trunc() as i64;
    let fraction = dt.fract();

    // Calculate date (simplified)
    let base_date = chrono::NaiveDate::from_ymd_opt(1899, 12, 30).unwrap();
    if let Some(date) = base_date.checked_add_signed(chrono::Duration::days(days)) {
        // Calculate time
        let seconds_in_day = (fraction * 86400.0) as u32;
        let hours = seconds_in_day / 3600;
        let minutes = (seconds_in_day % 3600) / 60;
        let seconds = seconds_in_day % 60;

        if let Some(time) = chrono::NaiveTime::from_hms_opt(hours, minutes, seconds) {
            let datetime = chrono::NaiveDateTime::new(date, time);
            return datetime.format("%Y-%m-%dT%H:%M:%S").to_string();
        }
    }

    format!("{}", dt)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spreadsheet_to_json_single_sheet() {
        let mut sheet = Sheet::new("Data");
        sheet.rows.push(vec![
            Cell {
                value: CellValue::String("A".to_string()),
                ..Default::default()
            },
            Cell {
                value: CellValue::Number(1.0),
                ..Default::default()
            },
        ]);

        let spreadsheet = Spreadsheet::new().with_sheet(sheet);
        let json = spreadsheet_to_json(&spreadsheet).unwrap();

        assert_eq!(json["name"], "Data");
        assert!(json["data"].is_array());
    }

    #[test]
    fn test_spreadsheet_to_json_multiple_sheets() {
        let spreadsheet = Spreadsheet::new()
            .with_sheet(Sheet::new("Sheet1"))
            .with_sheet(Sheet::new("Sheet2"));

        let json = spreadsheet_to_json(&spreadsheet).unwrap();

        assert!(json["sheets"].is_array());
        assert_eq!(json["sheets"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn test_format_excel_datetime() {
        // Test a known date: January 1, 2024
        let excel_date = 45292.0; // Days since 1899-12-30
        let result = format_excel_datetime(excel_date);
        assert!(result.contains("2024-01-01"));
    }
}
