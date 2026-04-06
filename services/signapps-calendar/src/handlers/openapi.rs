//! OpenAPI 3.1 spec — code-first via utoipa.
//!
//! `CalendarApiDoc` collects all annotated paths and schemas.
//! Spec served at `GET /api/v1/openapi.json`, Swagger UI at `/swagger-ui/`.
//!
//! Handlers are progressively annotated. Remaining work tracked in
//! sub-tasks of [SIG-9](/SIG/issues/SIG-9).

use utoipa::OpenApi;

/// Top-level OpenAPI document for the Calendar service.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Calendar Service",
        version = "1.0.0",
        description = "Calendar, task, resource, and scheduling management for SignApps Platform.",
        license(name = "Apache-2.0", url = "https://www.apache.org/licenses/LICENSE-2.0"),
    ),
    servers(
        (url = "http://localhost:3011", description = "Local development"),
    ),
    paths(
        // calendars
        crate::handlers::calendars::list_calendars,
        crate::handlers::calendars::create_calendar,
        crate::handlers::calendars::get_calendar,
        crate::handlers::calendars::update_calendar,
        crate::handlers::calendars::delete_calendar,
        crate::handlers::calendars::list_members,
        crate::handlers::calendars::add_member,
        crate::handlers::calendars::remove_member,
        // events
        crate::handlers::events::list_events,
        crate::handlers::events::create_event,
        crate::handlers::events::get_event,
        crate::handlers::events::update_event,
        crate::handlers::events::delete_event,
        crate::handlers::events::add_attendee,
        crate::handlers::events::list_attendees,
        crate::handlers::events::update_rsvp,
        crate::handlers::events::remove_attendee,
    ),
    components(
        schemas(
            signapps_db::models::Calendar,
            signapps_db::models::CreateCalendar,
            signapps_db::models::UpdateCalendar,
            crate::handlers::shares::CalendarShareEntry,
            crate::handlers::calendars::AddMemberRequest,
            signapps_db::models::Event,
            signapps_db::models::CreateEvent,
            signapps_db::models::UpdateEvent,
            signapps_db::models::EventWithDetails,
            signapps_db::models::EventAttendee,
            signapps_db::models::AddEventAttendee,
            signapps_db::models::UpdateAttendeeRsvp,
        )
    ),
    tags(
        (name = "calendars", description = "Calendar CRUD and sharing"),
        (name = "events", description = "Event CRUD and attendee management"),
        (name = "tasks", description = "Hierarchical task management"),
        (name = "resources", description = "Bookable resources"),
        (name = "leave", description = "Leave and time-off requests"),
        (name = "timesheets", description = "Time tracking"),
        (name = "system", description = "Health and system endpoints"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct CalendarApiDoc;

/// Adds the Bearer JWT security scheme to the OpenAPI spec.
struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
            components.add_security_scheme(
                "bearerAuth",
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
