//! OpenAPI documentation for the Office service.
//!
//! Exposes `/swagger-ui/` (Swagger UI) and `/api-docs/openapi.json`.

use utoipa::{
    openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme},
    Modify, OpenApi,
};
use utoipa_swagger_ui::SwaggerUi;

/// Security modifier — injects Bearer JWT scheme into the OpenAPI document.
struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "bearer",
                SecurityScheme::Http(
                    HttpBuilder::new()
                        .scheme(HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .build(),
                ),
            );
        }
    }
}

#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Office Service",
        version = "1.0.0",
        description = "Document conversion, import/export, spreadsheets, PDF, presentations, and data operations."
    ),
    servers(
        (url = "http://localhost:3018", description = "Local development")
    ),
    paths(
        // Conversion
        crate::office::handlers::conversion::info,
        crate::office::handlers::conversion::convert_json,
        crate::office::handlers::conversion::convert_upload,
        crate::office::handlers::conversion::convert_batch,
        // Import
        crate::office::handlers::import::info,
        crate::office::handlers::import::import_upload,
        crate::office::handlers::import::import_json,
        // Spreadsheet
        crate::office::handlers::spreadsheet::spreadsheet_info,
        crate::office::handlers::spreadsheet::export_spreadsheet,
        crate::office::handlers::spreadsheet::export_csv_handler,
        crate::office::handlers::spreadsheet::export_ods_handler,
        crate::office::handlers::spreadsheet::import_spreadsheet,
        crate::office::handlers::spreadsheet::import_csv_text,
        // PDF
        crate::office::handlers::pdf::pdf_info,
        crate::office::handlers::pdf::extract_pdf_text,
        crate::office::handlers::pdf::get_pdf_document_info,
        crate::office::handlers::pdf::get_pdf_pages,
        crate::office::handlers::pdf::merge_pdf_files,
        crate::office::handlers::pdf::split_pdf_file,
        // Presentation
        crate::office::handlers::presentation::presentation_info,
        crate::office::handlers::presentation::export_pptx,
        crate::office::handlers::presentation::export_slides_pdf,
        crate::office::handlers::presentation::export_slide_png,
        crate::office::handlers::presentation::export_slide_svg,
        crate::office::handlers::presentation::export_all_slides_png,
        crate::office::handlers::presentation::export_all_slides_svg,
        // Data import
        crate::office::handlers::data_import::import_info,
        crate::office::handlers::data_import::import_data,
        // Data export
        crate::office::handlers::data_export::export_info,
        crate::office::handlers::data_export::export_data,
        // Reports
        crate::office::handlers::report::report_info,
        crate::office::handlers::report::generate_report,
        // Async jobs
        crate::office::handlers::jobs::submit_convert_job,
        crate::office::handlers::jobs::get_job_status,
    ),
    components(
        schemas(
            // Conversion
            crate::office::handlers::conversion::InputFormat,
            crate::office::handlers::conversion::OutputFormat,
            crate::office::handlers::conversion::ExportComment,
            crate::office::handlers::conversion::ExportCommentReply,
            crate::office::handlers::conversion::ConversionRequest,
            crate::office::handlers::conversion::ConversionInfoResponse,
            crate::office::handlers::conversion::BatchConversionItem,
            crate::office::handlers::conversion::BatchConversionResultItem,
            crate::office::handlers::conversion::BatchConversionRequest,
            crate::office::handlers::conversion::BatchConversionResponse,
            // Import
            crate::office::handlers::import::ImportInfoResponse,
            crate::office::handlers::import::ImportResponse,
            crate::office::handlers::import::ImportMetadata,
            crate::office::handlers::import::ImportJsonRequest,
            // Spreadsheet
            crate::office::handlers::spreadsheet::CsvImportRequest,
            // PDF
            crate::office::handlers::pdf::PdfInfoResponse,
            // Data import
            crate::office::handlers::data_import::ImportResult,
            crate::office::handlers::data_import::ContactRecord,
            crate::office::handlers::data_import::EventRecord,
            // Data export
            crate::office::handlers::data_export::ExportRequest,
            crate::office::handlers::data_export::ExportInfo,
            // Reports
            crate::office::handlers::report::ReportRequest,
            crate::office::handlers::report::ReportSection,
            crate::office::handlers::report::ReportInfo,
            // Jobs
            crate::office::handlers::jobs::JobState,
            crate::office::handlers::jobs::JobStatus,
            crate::office::handlers::jobs::JobConvertRequest,
            crate::office::handlers::jobs::JobSubmitResponse,
        )
    ),
    tags(
        (name = "Conversion", description = "Document format conversion (Tiptap/HTML/Markdown → DOCX/PDF/MD/HTML/TXT)"),
        (name = "Import", description = "Document import (DOCX/Markdown/HTML/TXT → Tiptap JSON)"),
        (name = "Spreadsheet", description = "Spreadsheet import/export (XLSX/CSV/ODS)"),
        (name = "PDF", description = "PDF operations: extract text, merge, split, info"),
        (name = "Presentation", description = "Presentation export (PPTX/PDF/PNG/SVG)"),
        (name = "DataImport", description = "Universal data import (CSV/JSON/vCard/iCal)"),
        (name = "DataExport", description = "Universal data export (CSV/JSON/XLSX/PDF)"),
        (name = "Reports", description = "PDF report generation (activity/users/storage)"),
        (name = "Jobs", description = "Async job queue for heavy document exports"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct OfficeApiDoc;

/// Returns a [`SwaggerUi`] router serving the OpenAPI spec at `/api-docs/openapi.json`
/// and the Swagger UI at `/swagger-ui/`.
#[allow(dead_code)]
pub fn swagger_router() -> SwaggerUi {
    SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", OfficeApiDoc::openapi())
}
