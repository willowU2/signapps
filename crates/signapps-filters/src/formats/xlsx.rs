//! XLSX filter — imports/exports Microsoft Excel spreadsheets.
//!
//! Import uses `calamine` to read sheets and maps cell data to the
//! intermediate `SheetData` model.
//! Export uses `rust_xlsxwriter` to produce valid XLSX files.

use calamine::{open_workbook_from_rs, Data, Reader, Xlsx};
use std::io::Cursor;

use crate::error::{FilterError, FilterResult};
use crate::intermediate::{
    CellData, CellValue, DocBody, DocMetadata, DocType, IntermediateDocument, RowData, SheetData,
};
use crate::traits::FilterTrait;

/// Converts XLSX files to/from `IntermediateDocument`.
///
/// Import reads all sheets using `calamine` and maps each cell value
/// to the appropriate `CellValue` variant.
/// Export creates a new workbook using `rust_xlsxwriter`.
pub struct XlsxFilter;

impl FilterTrait for XlsxFilter {
    fn name(&self) -> &str {
        "XLSX Filter"
    }

    fn mime_types(&self) -> &[&str] {
        &["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]
    }

    fn extensions(&self) -> &[&str] {
        &["xlsx", "xls", "xlsb"]
    }

    fn import(&self, bytes: &[u8]) -> FilterResult<IntermediateDocument> {
        let cursor = Cursor::new(bytes);
        let mut workbook: Xlsx<_> = open_workbook_from_rs(cursor)
            .map_err(|e| FilterError::ImportFailed(format!("cannot open XLSX: {e}")))?;

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

    fn export(&self, doc: &IntermediateDocument) -> FilterResult<Vec<u8>> {
        let sheets = match &doc.body {
            DocBody::Spreadsheet { sheets } => sheets,
            other => {
                return Err(FilterError::ExportFailed(format!(
                    "XlsxFilter cannot export {:?} body",
                    std::mem::discriminant(other)
                )));
            },
        };

        let mut workbook = rust_xlsxwriter::Workbook::new();

        for sheet_data in sheets {
            let worksheet = workbook
                .add_worksheet()
                .set_name(&sheet_data.name)
                .map_err(|e| FilterError::ExportFailed(format!("worksheet name error: {e}")))?;

            for (row_idx, row) in sheet_data.rows.iter().enumerate() {
                for (col_idx, cell) in row.cells.iter().enumerate() {
                    let r = row_idx as u32;
                    let c = col_idx as u16;
                    match &cell.value {
                        CellValue::Empty => {},
                        CellValue::Text(s) => {
                            worksheet.write_string(r, c, s).map_err(|e| {
                                FilterError::ExportFailed(format!("write error: {e}"))
                            })?;
                        },
                        CellValue::Number(n) => {
                            worksheet.write_number(r, c, *n).map_err(|e| {
                                FilterError::ExportFailed(format!("write error: {e}"))
                            })?;
                        },
                        CellValue::Bool(b) => {
                            worksheet.write_boolean(r, c, *b).map_err(|e| {
                                FilterError::ExportFailed(format!("write error: {e}"))
                            })?;
                        },
                        CellValue::Date(d) => {
                            worksheet.write_string(r, c, d).map_err(|e| {
                                FilterError::ExportFailed(format!("write error: {e}"))
                            })?;
                        },
                        CellValue::Error(e) => {
                            worksheet
                                .write_string(r, c, format!("#ERR: {e}"))
                                .map_err(|e| {
                                    FilterError::ExportFailed(format!("write error: {e}"))
                                })?;
                        },
                    }
                }
            }
        }

        let buffer = workbook
            .save_to_buffer()
            .map_err(|e| FilterError::ExportFailed(format!("XLSX save failed: {e}")))?;

        Ok(buffer)
    }

    fn export_mime_type(&self) -> &str {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }

    fn export_extension(&self) -> &str {
        "xlsx"
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
    fn export_and_reimport_roundtrip() {
        let doc = IntermediateDocument {
            doc_type: DocType::Spreadsheet,
            metadata: DocMetadata::default(),
            body: DocBody::Spreadsheet {
                sheets: vec![SheetData {
                    name: "TestSheet".to_string(),
                    rows: vec![
                        RowData {
                            cells: vec![
                                CellData {
                                    value: CellValue::Text("Name".to_string()),
                                    formula: None,
                                    style: None,
                                },
                                CellData {
                                    value: CellValue::Text("Age".to_string()),
                                    formula: None,
                                    style: None,
                                },
                            ],
                            height: None,
                        },
                        RowData {
                            cells: vec![
                                CellData {
                                    value: CellValue::Text("Alice".to_string()),
                                    formula: None,
                                    style: None,
                                },
                                CellData {
                                    value: CellValue::Number(30.0),
                                    formula: None,
                                    style: None,
                                },
                            ],
                            height: None,
                        },
                    ],
                    col_widths: Vec::new(),
                    frozen_rows: 0,
                    frozen_cols: 0,
                }],
            },
        };

        let filter = XlsxFilter;
        let bytes = filter.export(&doc).expect("export failed");

        // Valid ZIP signature
        assert_eq!(&bytes[0..2], b"PK");

        // Re-import
        let reimported = filter.import(&bytes).expect("reimport failed");
        assert_eq!(reimported.doc_type, DocType::Spreadsheet);
        if let DocBody::Spreadsheet { sheets } = &reimported.body {
            assert_eq!(sheets.len(), 1);
            assert_eq!(sheets[0].name, "TestSheet");
            assert_eq!(sheets[0].rows.len(), 2);
            // Check first cell
            assert!(
                matches!(&sheets[0].rows[0].cells[0].value, CellValue::Text(s) if s == "Name")
            );
        } else {
            panic!("expected Spreadsheet body");
        }
    }

    #[test]
    fn calamine_data_mapping() {
        assert!(matches!(calamine_to_cell_value(&Data::Empty), CellValue::Empty));
        assert!(
            matches!(calamine_to_cell_value(&Data::String("hi".into())), CellValue::Text(s) if s == "hi")
        );
        assert!(
            matches!(calamine_to_cell_value(&Data::Float(1.5)), CellValue::Number(n) if (n - 1.5).abs() < f64::EPSILON)
        );
        assert!(matches!(
            calamine_to_cell_value(&Data::Bool(true)),
            CellValue::Bool(true)
        ));
    }
}
