//! OpenAPI 3.1 spec — code-first via utoipa.
//!
//! `DocsApiDoc` collects all annotated paths and schemas.
//! Spec served at `GET /api-docs/openapi.json`, Swagger UI at `/swagger-ui/`.

use utoipa::{
    openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme},
    Modify, OpenApi,
};
use utoipa_swagger_ui::SwaggerUi;

/// Adds the Bearer JWT security scheme to the OpenAPI spec.
pub struct SecurityAddon;

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

/// Top-level OpenAPI document for the Docs service.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Docs Service",
        version = "1.0.0",
        description = "Collaborative documents, spreadsheets, presentations, boards, templates, designs, and chat."
    ),
    servers(
        (url = "http://localhost:3010", description = "Local development"),
    ),
    paths(
        // Health
        crate::handlers::health::health_handler,
        // Documents
        crate::handlers::types::text::create_document,
        crate::handlers::types::sheet::create_sheet,
        crate::handlers::types::sheet::get_rows,
        crate::handlers::types::slide::create_presentation,
        crate::handlers::types::slide::get_slides,
        crate::handlers::types::board::create_board,
        crate::handlers::types::board::get_columns,
        // Templates
        crate::handlers::templates::list_templates,
        crate::handlers::templates::get_template,
        crate::handlers::templates::create_template,
        crate::handlers::templates::delete_template,
        // Macros
        crate::handlers::macros::list_macros,
        crate::handlers::macros::create_macro,
        crate::handlers::macros::update_macro,
        crate::handlers::macros::delete_macro,
        // Designs
        crate::handlers::designs::list_designs,
        crate::handlers::designs::create_design,
        crate::handlers::designs::get_design,
        crate::handlers::designs::update_design,
        crate::handlers::designs::delete_design,
        // Classify
        crate::handlers::classify::classify_document,
        // Notes
        crate::handlers::notes::list_notes,
        crate::handlers::notes::create_note,
        crate::handlers::notes::update_note,
        crate::handlers::notes::delete_note,
        // Styles
        crate::handlers::styles::list_styles,
        crate::handlers::styles::get_style,
        crate::handlers::styles::get_resolved_style,
        crate::handlers::styles::create_style,
        crate::handlers::styles::update_style,
        crate::handlers::styles::delete_style,
        crate::handlers::styles::list_template_styles,
        // Chat channels
        crate::handlers::types::chat::create_channel,
        crate::handlers::types::chat::get_channels,
        crate::handlers::types::chat::get_channel,
        crate::handlers::types::chat::update_channel,
        crate::handlers::types::chat::delete_channel,
        // Channel members
        crate::handlers::types::chat::get_channel_members,
        crate::handlers::types::chat::add_channel_member,
        crate::handlers::types::chat::remove_channel_member,
        // Direct messages
        crate::handlers::types::chat::get_direct_messages,
        crate::handlers::types::chat::create_direct_message,
        crate::handlers::types::chat::delete_direct_message,
        // Channel read status
        crate::handlers::types::chat::get_channel_read_status,
        crate::handlers::types::chat::mark_channel_read,
        crate::handlers::types::chat::increment_unread_count,
        crate::handlers::types::chat::get_all_unread_counts,
        // Presentations
        crate::handlers::presentations::create_presentation,
        crate::handlers::presentations::get_presentation,
        crate::handlers::presentations::update_presentation,
        crate::handlers::presentations::list_layouts,
        crate::handlers::presentations::list_slides,
        crate::handlers::presentations::create_slide,
        crate::handlers::presentations::update_slide,
        crate::handlers::presentations::delete_slide,
        crate::handlers::presentations::reorder_slides,
        // Versions
        crate::handlers::versions::append_command,
        crate::handlers::versions::list_commands,
        crate::handlers::versions::undo_last_command,
        crate::handlers::versions::create_snapshot,
        crate::handlers::versions::list_snapshots,
        crate::handlers::versions::get_snapshot,
        crate::handlers::versions::restore_snapshot,
        crate::handlers::versions::diff_snapshots,
        // Sheet Formats
        crate::handlers::sheet_formats::list_formats,
        crate::handlers::sheet_formats::upsert_format,
        crate::handlers::sheet_formats::delete_format,
        crate::handlers::sheet_formats::batch_upsert_formats,
        crate::handlers::sheet_formats::get_metadata,
        crate::handlers::sheet_formats::upsert_metadata,
    ),
    components(schemas(
        // Classify
        crate::handlers::classify::ClassifyRequest,
        crate::handlers::classify::ClassifyResponse,
        crate::handlers::classify::DocumentCategory,
        crate::handlers::classify::ClassificationMethod,
        // Designs
        crate::handlers::designs::Design,
        crate::handlers::designs::CreateDesignRequest,
        crate::handlers::designs::UpdateDesignRequest,
        // Macros
        crate::handlers::macros::Macro,
        crate::handlers::macros::CreateMacroRequest,
        crate::handlers::macros::UpdateMacroRequest,
        // Notes
        crate::handlers::notes::QuickNote,
        crate::handlers::notes::CreateNoteRequest,
        crate::handlers::notes::UpdateNoteRequest,
        // Templates
        crate::handlers::templates::TemplateSummary,
        crate::handlers::templates::TemplateDetail,
        crate::handlers::templates::CreateTemplateRequest,
        // Document types
        crate::handlers::types::text::CreateTextDocumentRequest,
        crate::handlers::types::text::DocumentResponse,
        crate::handlers::types::sheet::CreateSheetRequest,
        crate::handlers::types::sheet::SheetResponse,
        crate::handlers::types::slide::CreatePresentationRequest,
        crate::handlers::types::slide::PresentationResponse,
        crate::handlers::types::board::CreateBoardRequest,
        crate::handlers::types::board::BoardResponse,
        // Styles
        signapps_db::models::StyleDefinition,
        signapps_db::models::CreateStyle,
        signapps_db::models::UpdateStyle,
        signapps_db::models::ResolvedStyle,
        // Chat
        crate::handlers::types::chat::CreateChannelRequest,
        crate::handlers::types::chat::ChannelResponse,
        crate::handlers::types::chat::UpdateChannelRequest,
        crate::handlers::types::chat::ChannelMember,
        crate::handlers::types::chat::AddMemberRequest,
        crate::handlers::types::chat::DirectMessage,
        crate::handlers::types::chat::DmParticipant,
        crate::handlers::types::chat::CreateDmRequest,
        crate::handlers::types::chat::ChannelReadStatus,
        // Presentations
        signapps_db::models::Presentation,
        signapps_db::models::CreatePresentation,
        signapps_db::models::SlideLayout,
        signapps_db::models::Slide,
        signapps_db::models::CreateSlide,
        signapps_db::models::UpdateSlide,
        crate::handlers::presentations::CreatePresentationBody,
        crate::handlers::presentations::UpdatePresentationBody,
        crate::handlers::presentations::CreateSlideBody,
        crate::handlers::presentations::UpdateSlideBody,
        crate::handlers::presentations::ReorderSlidesBody,
        // Sheet Formats
        signapps_db::models::CellFormat,
        signapps_db::models::UpsertCellFormat,
        signapps_db::models::SheetMetadata,
        signapps_db::models::UpsertSheetMetadata,
        crate::handlers::sheet_formats::UpsertFormatRequest,
        crate::handlers::sheet_formats::BatchUpsertRequest,
        crate::handlers::sheet_formats::UpsertMetadataRequest,
        // Versions
        signapps_db::models::DocumentCommand,
        signapps_db::models::AppendCommand,
        signapps_db::models::DocumentSnapshot,
        signapps_db::models::CreateSnapshot,
        signapps_db::models::DiffEntry,
        crate::handlers::versions::DiffSnapshotsBody,
    )),
    tags(
        (name = "System", description = "Health and system endpoints"),
        (name = "Documents", description = "Collaborative document management (text, sheet, slide, board)"),
        (name = "Templates", description = "Document template management"),
        (name = "Macros", description = "Spreadsheet macro management"),
        (name = "Designs", description = "Design file management"),
        (name = "Notes", description = "Quick notes (Google Keep style)"),
        (name = "Styles", description = "Style definitions with cascade inheritance"),
        (name = "Chat", description = "Chat channels and direct messages"),
        (name = "Presentations", description = "Slides persistence API (presentations, layouts, slides CRUD)"),
        (name = "Sheet Formats", description = "Spreadsheet cell formats and sheet metadata persistence"),
        (name = "Versions", description = "Document versioning -- command log, snapshots, undo, and diff"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct DocsApiDoc;

/// Returns a `SwaggerUi` router for the Docs service.
#[allow(dead_code)]
pub fn swagger_router() -> SwaggerUi {
    SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", DocsApiDoc::openapi())
}
