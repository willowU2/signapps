//! ODS filter — imports OpenDocument Spreadsheet files.
//!
//! Import uses `calamine::Ods` to read sheets. Export is not supported
//! (returns `UnsupportedFormat` error).

use calamine::{open_workbook_from_rs, Data, Ods, Reader};
use std::io::Cursor;

use crate::error::{FilterError, FilterResult};
use crate::intermediate::{
    CellData, CellValue, DocBody, DocMetadata, DocType, IntermediateDocument, RowData, SheetData,
};
use crate::traits::FilterTrait;

/// Converts ODS files to `IntermediateDocument` (import only).
///
/// Import reads all sheets using `calamine::Ods` and maps cell data
/// to `CellValue` variants. Export is not supported.
pub struct OdsFilter;

impl FilterTrait for OdsFilter {
    fn name(&self) -> &str {
        "ODS Filter"
    }

    fn mime_types(&self) -> &[&str] {
        &["application/vnd.oasis.opendocument.spreadsheet"]
    }

    fn extensions(&self) -> &[&str] {
        &["ods"]
    }

    fn import(&self, bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        let cursor = Cursor::new(bytes);
        let mut workbook: Ods<_> = open_workbook_from_rs(cursor)
            .map_err(|e| FilterError::ImportFailed(format!("cannot open ODS: {e}")))?;

        let sheet_names: Vec<String> = workbook.sheet_names().to_vec();
        let mut sheets = Vec::new();

        for name in &sheet_names {
            let range = workbook.worksheet_range(name).map_err(|e| {
                FilterError::ImportFailed(format!("cannot read sheet '{name}': {e}"))
            })?;

            let mut rows = Vec::new();
            for row in range.rows() {
                let cells: Vec<CellData> = row
                    .iter()
                    .map(|cell| CellData {
                        value: calamine_to_cell_value(cell),
                        formula: None,
                        style: None,
                    })
                    .collect();
                rows.push(RowData {
                    cells,
                    height: None,
                });
            }

            sheets.push(SheetData {
                name: name.clone(),
                rows,
                col_widths: Vec::new(),
                frozen_rows: 0,
                frozen_cols: 0,
            });
        }

        Ok(IntermediateDocument {
            doc_type: DocType::Spreadsheet,
            metadata: DocMetadata::default(),
            body: DocBody::Spreadsheet { sheets },
        })
    }

    fn export(&self, _doc: &IntermediateDocument) -> FilterResult<Vec<u8>> {
        Err(FilterError::UnsupportedFormat(
            "ODS export is not supported".to_string(),
        ))
    }

    fn can_export(&self) -> bool {
        false
    }

    fn export_mime_type(&self) -> &str {
        "application/vnd.oasis.opendocument.spreadsheet"
    }

    fn export_extension(&self) -> &str {
        "ods"
    }
}

/// Map a `calamine::Data` cell to our `CellValue`.
fn calamine_to_cell_value(data: &Data) -> CellValue {
    match data {
        Data::Empty => CellValue::Empty,
        Data::String(s) => CellValue::Text(s.clone()),
        Data::Float(f) => CellValue::Number(*f),
        Data::Int(i) => CellValue::Number(*i as f64),
        Data::Bool(b) => CellValue::Bool(*b),
        Data::DateTime(dt) => CellValue::Date(dt.to_string()),
        Data::DateTimeIso(s) => CellValue::Date(s.clone()),
        Data::DurationIso(s) => CellValue::Text(s.clone()),
        Data::Error(e) => CellValue::Error(format!("{e:?}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_returns_unsupported() {
        let doc = IntermediateDocument {
            doc_type: DocType::Spreadsheet,
            metadata: DocMetadata::default(),
            body: DocBody::Spreadsheet {
                sheets: Vec::new(),
            },
        };

        let filter = OdsFilter;
        assert!(!filter.can_export());
        let result = filter.export(&doc);
        assert!(result.is_err());
    }

    #[test]
    fn calamine_data_mapping() {
        assert!(matches!(calamine_to_cell_value(&Data::Empty), CellValue::Empty));
        assert!(
            matches!(calamine_to_cell_value(&Data::String("test".into())), CellValue::Text(s) if s == "test")
        );
        assert!(
            matches!(calamine_to_cell_value(&Data::Int(42)), CellValue::Number(n) if (n - 42.0).abs() < f64::EPSILON)
        );
    }
}
