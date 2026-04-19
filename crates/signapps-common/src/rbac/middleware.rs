//! Axum middleware that enforces [`OrgPermissionResolver`] decisions.
//!
//! Services wire one `rbac::require(...)` layer per protected route (or
//! route group) and pass a resource extractor that derives a
//! [`ResourceRef`] from the request URI.  The middleware:
//!
//! 1. Reads the `Claims` injected by the earlier `auth_middleware`.
//! 2. Builds a [`PersonRef`] from `claims.person_id` (falling back to
//!    `claims.sub`) + `claims.tenant_id`.
//! 3. Runs the resolver; on `Allow` forwards the request, on `Deny`
//!    returns RFC 7807 `403 Forbidden`.
//!
//! The resolver is passed as `Arc<dyn OrgPermissionResolver>` so every
//! service receives the same concrete impl (`OrgClient`) without
//! needing to depend on `signapps-org`.

use std::sync::Arc;

use axum::{extract::Request, middleware::Next, response::Response};
use uuid::Uuid;

use super::resolver::OrgPermissionResolver;
use super::types::{Action, Decision, PersonRef, ResourceRef};
use crate::auth::Claims;
use crate::error::Error;

/// Shared resolver handle — what services inject into the middleware.
pub type SharedResolver = Arc<dyn OrgPermissionResolver>;

/// Resource extractor signature.  Takes a borrow of the request and
/// returns the [`ResourceRef`] (or `None` if the URI does not match).
pub type ResourceExtractor = Arc<dyn Fn(&Request) -> Option<ResourceRef> + Send + Sync>;

/// Axum middleware that checks `action` on the resource produced by
/// `extract_resource` before forwarding the request.
///
/// # Errors
///
/// Returns [`Error::Unauthorized`] when no `Claims` are in the request
/// extensions (auth middleware MUST run first), [`Error::BadRequest`]
/// when the resource extractor fails to match, or [`Error::Forbidden`]
/// / [`Error::Internal`] on resolver outcomes.
#[tracing::instrument(skip(resolver, extract_resource, req, next), fields(action = ?action))]
pub async fn require(
    resolver: SharedResolver,
    action: Action,
    extract_resource: ResourceExtractor,
    req: Request,
    next: Next,
) -> Result<Response, Error> {
    let claims = req
        .extensions()
        .get::<Claims>()
        .cloned()
        .ok_or(Error::Unauthorized)?;

    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::BadRequest("tenant-less token cannot access tenant resources".into()))?;

    // Prefer the canonical org_persons.id when present, fall back to the
    // JWT subject (user id).  `Uuid::nil()` is not a legal person id so
    // the resolver treats it as "unbound" and evaluates only admin /
    // board / direct-grant rules.
    let who = PersonRef {
        id: claims.person_id.unwrap_or(claims.sub),
        tenant_id,
    };

    let resource = extract_resource(&req).ok_or_else(|| {
        Error::BadRequest("rbac middleware: failed to extract resource from request".into())
    })?;

    tracing::debug!(
        person_id = %who.id,
        tenant_id = %who.tenant_id,
        resource_kind = resource.kind(),
        resource_id = %resource.id(),
        "rbac check"
    );

    match resolver
        .check(who, resource, action)
        .await
        .map_err(|e| Error::Internal(format!("rbac resolver: {e}")))?
    {
        Decision::Allow { source } => {
            tracing::debug!(?source, "rbac allow");
            Ok(next.run(req).await)
        },
        Decision::Deny { reason } => {
            tracing::info!(?reason, person_id = %who.id, "rbac deny");
            Err(Error::Forbidden(format!("{reason:?}")))
        },
    }
}

// ---------------------------------------------------------------------------
// Resource extractors
// ---------------------------------------------------------------------------

/// Scan the URI path for the first segment that parses as a UUID.
///
/// Every protected route in SignApps follows the convention
/// `…/<resource-kind>/:id/…`, so the first UUID is almost always the
/// resource id.
fn first_uuid_in_path(req: &Request) -> Option<Uuid> {
    req.uri()
        .path()
        .split('/')
        .find_map(|seg| Uuid::parse_str(seg).ok())
}

/// Extract a `Document` resource — matches `/api/v1/documents/:id/...`.
pub fn document_from_path(req: &Request) -> Option<ResourceRef> {
    first_uuid_in_path(req).map(ResourceRef::Document)
}

/// Extract a `Folder` resource — matches `/api/v1/folders/:id/...`
/// (and `/api/v1/storage/folders/:id/...`).
pub fn folder_from_path(req: &Request) -> Option<ResourceRef> {
    first_uuid_in_path(req).map(ResourceRef::Folder)
}

/// Extract a `Calendar` resource — matches `/api/v1/calendars/:id/...`.
pub fn calendar_from_path(req: &Request) -> Option<ResourceRef> {
    first_uuid_in_path(req).map(ResourceRef::Calendar)
}

/// Extract a `MailFolder` resource — matches `/api/v1/mail/folders/:id/...`.
pub fn mail_folder_from_path(req: &Request) -> Option<ResourceRef> {
    first_uuid_in_path(req).map(ResourceRef::MailFolder)
}

/// Extract a `Form` resource — matches `/api/v1/forms/:id/...`.
pub fn form_from_path(req: &Request) -> Option<ResourceRef> {
    first_uuid_in_path(req).map(ResourceRef::Form)
}

/// Extract a `Project` resource — matches `/api/v1/projects/:id/...`
/// or `/api/v1/workforce/projects/:id/...`.
pub fn project_from_path(req: &Request) -> Option<ResourceRef> {
    first_uuid_in_path(req).map(ResourceRef::Project)
}

/// Extract an `OrgNode` resource — matches `/api/v1/org/nodes/:id/...`.
pub fn org_node_from_path(req: &Request) -> Option<ResourceRef> {
    first_uuid_in_path(req).map(ResourceRef::OrgNode)
}

/// Generic extractor — services that own a resource kind outside the
/// canonical enum wrap the first UUID in [`ResourceRef::Custom`].
pub fn resource_from_path(kind: &'static str, req: &Request) -> Option<ResourceRef> {
    first_uuid_in_path(req).map(|id| ResourceRef::Custom { kind, id })
}
