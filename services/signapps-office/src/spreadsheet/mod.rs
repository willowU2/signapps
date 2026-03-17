//! Spreadsheet conversion module for XLSX/CSV/ODS import/export.

#![allow(dead_code)]

mod csv;
mod export;
mod import;
mod ods;

pub use csv::*;
pub use export::*;
pub use import::*;
pub use ods::*;

use thiserror::Error;

/// Spreadsheet conversion errors
#[derive(Debug, Error)]
pub enum SpreadsheetError {
    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Unsupported format: {0}")]
    UnsupportedFormat(String),

    #[error("Conversion failed: {0}")]
    ConversionFailed(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

/// Cell value type
#[derive(Debug, Clone, PartialEq, Default)]
pub enum CellValue {
    #[default]
    Empty,
    String(String),
    Number(f64),
    Bool(bool),
    Formula(String),
    Date(String), // ISO 8601 date string
    Error(String),
}

/// Cell style information
#[derive(Debug, Clone, Default)]
pub struct CellStyle {
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub font_size: Option<f64>,
    pub font_color: Option<String>,
    pub background_color: Option<String>,
    pub horizontal_align: Option<String>,
    pub vertical_align: Option<String>,
    pub number_format: Option<String>,
}

/// A single cell in a spreadsheet
#[derive(Debug, Clone, Default)]
pub struct Cell {
    pub value: CellValue,
    pub style: CellStyle,
    pub formula: Option<String>,
}

/// A row of cells
pub type Row = Vec<Cell>;

/// Sheet data
#[derive(Debug, Clone, Default)]
pub struct Sheet {
    pub name: String,
    pub rows: Vec<Row>,
    pub column_widths: Vec<f64>,
    pub row_heights: Vec<f64>,
    pub frozen_rows: usize,
    pub frozen_cols: usize,
}

impl Sheet {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            ..Default::default()
        }
    }

    pub fn with_rows(mut self, rows: Vec<Row>) -> Self {
        self.rows = rows;
        self
    }
}

/// Spreadsheet data structure (multi-sheet workbook)
#[derive(Debug, Clone, Default)]
pub struct Spreadsheet {
    pub sheets: Vec<Sheet>,
    pub active_sheet: usize,
}

impl Spreadsheet {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_sheet(mut self, sheet: Sheet) -> Self {
        self.sheets.push(sheet);
        self
    }

    pub fn add_sheet(&mut self, sheet: Sheet) {
        self.sheets.push(sheet);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cell_value_default() {
        let cell = Cell::default();
        assert_eq!(cell.value, CellValue::Empty);
    }

    #[test]
    fn test_sheet_creation() {
        let sheet = Sheet::new("Test Sheet");
        assert_eq!(sheet.name, "Test Sheet");
        assert!(sheet.rows.is_empty());
    }

    #[test]
    fn test_spreadsheet_with_sheets() {
        let spreadsheet = Spreadsheet::new()
            .with_sheet(Sheet::new("Sheet1"))
            .with_sheet(Sheet::new("Sheet2"));

        assert_eq!(spreadsheet.sheets.len(), 2);
        assert_eq!(spreadsheet.sheets[0].name, "Sheet1");
        assert_eq!(spreadsheet.sheets[1].name, "Sheet2");
    }
}
