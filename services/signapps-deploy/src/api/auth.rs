//! Wrapper middleware: require that the caller has the superadmin role.
//!
//! Sits after [`signapps_common::middleware::auth_middleware`], which inserts
//! a [`Claims`] into request extensions. Returns 401 if no claims (auth
//! didn't run), 403 if the claims don't carry superadmin.
//!
//! # Role model
//!
//! `signapps-common` encodes roles as an `i16` on [`Claims`], mirroring the
//! `UserRole` enum in the database:
//! - `1` — User
//! - `2` — Admin
//! - `3` — SuperAdmin
//!
//! This middleware only admits role `>= 3`.

use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use signapps_common::auth::Claims;

/// Role value reserved for superadmin (matches the `UserRole` enum in the DB).
const SUPERADMIN_ROLE: i16 = 3;

/// Axum middleware that gates the request on the `superadmin` role.
///
/// Must be layered **after** [`signapps_common::middleware::auth_middleware`],
/// which is responsible for verifying the JWT and inserting [`Claims`] into
/// request extensions. Because axum applies layers in reverse, the router
/// wiring looks like:
///
/// ```ignore
/// router
///     .layer(middleware::from_fn(require_superadmin))
///     .layer(middleware::from_fn_with_state(state, auth_middleware));
/// ```
///
/// # Returns
///
/// - `401 Unauthorized` if no [`Claims`] extension is present (auth did not run).
/// - `403 Forbidden` if the authenticated user is not a superadmin.
/// - Otherwise delegates to the next layer.
#[tracing::instrument(skip_all)]
pub async fn require_superadmin(req: Request, next: Next) -> Response {
    let Some(claims) = req.extensions().get::<Claims>() else {
        tracing::warn!("require_superadmin: no claims in request extensions");
        return (StatusCode::UNAUTHORIZED, "missing auth").into_response();
    };
    if !is_superadmin(claims) {
        tracing::warn!(
            user_id = %claims.sub,
            role = claims.role,
            "require_superadmin: non-superadmin attempted deploy API access"
        );
        return (StatusCode::FORBIDDEN, "superadmin role required").into_response();
    }
    next.run(req).await
}

/// Return `true` if the supplied claims carry the superadmin role.
///
/// `signapps-common::Claims` exposes `role: i16`, matching the `UserRole`
/// enum in the database (`1 = User`, `2 = Admin`, `3 = SuperAdmin`).
fn is_superadmin(claims: &Claims) -> bool {
    claims.role >= SUPERADMIN_ROLE
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;

    fn claims_with_role(role: i16) -> Claims {
        Claims {
            sub: Uuid::nil(),
            username: "tester".into(),
            role,
            tenant_id: None,
            workspace_ids: None,
            exp: Utc::now().timestamp() + 60,
            iat: Utc::now().timestamp(),
            token_type: "access".into(),
            aud: None,
            iss: None,
            person_id: None,
            context_id: None,
            context_type: None,
            company_id: None,
            company_name: None,
        }
    }

    #[test]
    fn is_superadmin_rejects_user_role() {
        assert!(!is_superadmin(&claims_with_role(1)));
    }

    #[test]
    fn is_superadmin_rejects_admin_role() {
        assert!(!is_superadmin(&claims_with_role(2)));
    }

    #[test]
    fn is_superadmin_accepts_superadmin_role() {
        assert!(is_superadmin(&claims_with_role(3)));
    }

    #[test]
    fn is_superadmin_accepts_higher_roles() {
        // Forward-compat: any future role above SuperAdmin keeps access.
        assert!(is_superadmin(&claims_with_role(4)));
    }

    // Full HTTP-level integration is covered by api_smoke.rs (Task P3a.13).
}
