//! OpenAPI 3.1 spec — code-first via utoipa.
//!
//! Spec served at `GET /api-docs/openapi.json`, Swagger UI at `/swagger-ui/`.

use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

/// Top-level OpenAPI document for the Gamification service.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Gamification Service",
        version = "1.0.0",
        description = "XP tracking, badges, streaks, and leaderboards.",
        license(name = "Apache-2.0", url = "https://www.apache.org/licenses/LICENSE-2.0"),
    ),
    servers(
        (url = "http://localhost:3033", description = "Local development"),
    ),
    paths(
        crate::get_my_xp,
        crate::award_xp,
        crate::get_my_badges,
        crate::get_streak,
        crate::get_leaderboard,
    ),
    components(
        schemas(
            crate::UserXpRow,
            crate::XpEventRow,
            crate::BadgeRow,
            crate::AwardXpRequest,
            crate::LeaderEntry,
            crate::StreakResponse,
        )
    ),
    tags(
        (name = "gamification", description = "XP, badges, streaks, and leaderboards"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct GamificationApiDoc;

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

/// Returns the SwaggerUi router to be merged into the main Axum router.
pub fn swagger_router() -> SwaggerUi {
    SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", GamificationApiDoc::openapi())
}
