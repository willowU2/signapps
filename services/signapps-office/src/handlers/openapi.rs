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
        crate::handlers::conversion::info,
        crate::handlers::conversion::convert_json,
        crate::handlers::conversion::convert_upload,
        crate::handlers::conversion::convert_batch,
        // Import
        crate::handlers::import::info,
        crate::handlers::import::import_upload,
        crate::handlers::import::import_json,
        // Spreadsheet
        crate::handlers::spreadsheet::spreadsheet_info,
        crate::handlers::spreadsheet::export_spreadsheet,
        crate::handlers::spreadsheet::export_csv_handler,
        crate::handlers::spreadsheet::export_ods_handler,
        crate::handlers::spreadsheet::import_spreadsheet,
        crate::handlers::spreadsheet::import_csv_text,
        // PDF
        crate::handlers::pdf::pdf_info,
        crate::handlers::pdf::extract_pdf_text,
        crate::handlers::pdf::get_pdf_document_info,
        crate::handlers::pdf::get_pdf_pages,
        crate::handlers::pdf::merge_pdf_files,
        crate::handlers::pdf::split_pdf_file,
        // Presentation
        crate::handlers::presentation::presentation_info,
        crate::handlers::presentation::export_pptx,
        crate::handlers::presentation::export_slides_pdf,
        crate::handlers::presentation::export_slide_png,
        crate::handlers::presentation::export_slide_svg,
        crate::handlers::presentation::export_all_slides_png,
        crate::handlers::presentation::export_all_slides_svg,
        // Data import
        crate::handlers::data_import::import_info,
        crate::handlers::data_import::import_data,
        // Data export
        crate::handlers::data_export::export_info,
        crate::handlers::data_export::export_data,
        // Reports
        crate::handlers::report::report_info,
        crate::handlers::report::generate_report,
        // Async jobs
        crate::handlers::jobs::submit_convert_job,
        crate::handlers::jobs::get_job_status,
    ),
    components(
        schemas(
            // Conversion
            crate::handlers::conversion::InputFormat,
            crate::handlers::conversion::OutputFormat,
            crate::handlers::conversion::ExportComment,
            crate::handlers::conversion::ExportCommentReply,
            crate::handlers::conversion::ConversionRequest,
            crate::handlers::conversion::ConversionInfoResponse,
            crate::handlers::conversion::BatchConversionItem,
            crate::handlers::conversion::BatchConversionResultItem,
            crate::handlers::conversion::BatchConversionRequest,
            crate::handlers::conversion::BatchConversionResponse,
            // Import
            crate::handlers::import::ImportInfoResponse,
            crate::handlers::import::ImportResponse,
            crate::handlers::import::ImportMetadata,
            crate::handlers::import::ImportJsonRequest,
            // Spreadsheet
            crate::handlers::spreadsheet::CsvImportRequest,
            // PDF
            crate::handlers::pdf::PdfInfoResponse,
            // Data import
            crate::handlers::data_import::ImportResult,
            crate::handlers::data_import::ContactRecord,
            crate::handlers::data_import::EventRecord,
            // Data export
            crate::handlers::data_export::ExportRequest,
            crate::handlers::data_export::ExportInfo,
            // Reports
            crate::handlers::report::ReportRequest,
            crate::handlers::report::ReportSection,
            crate::handlers::report::ReportInfo,
            // Jobs
            crate::handlers::jobs::JobState,
            crate::handlers::jobs::JobStatus,
            crate::handlers::jobs::JobConvertRequest,
            crate::handlers::jobs::JobSubmitResponse,
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
    SwaggerUi::new("/swagger-ui")
        .url("/api-docs/openapi.json", OfficeApiDoc::openapi())
}
