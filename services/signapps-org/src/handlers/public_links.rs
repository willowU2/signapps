//! Public links handlers — SO4 IN2.
//!
//! Two surfaces :
//! - **Admin** (auth required): CRUD `/api/v1/org/public-links`
//! - **Public** (no auth): `/public/org/:slug`
//!   + `/public/org/:slug/embed.html`
//!
//! The public surface anonymizes nodes/persons according to the link
//! [`Visibility`] level.

use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use signapps_db::models::org::{OrgNode, Person, PublicLink, Visibility};
use signapps_db::repositories::org::{NodeRepository, PersonRepository, PublicLinkRepository};
use uuid::Uuid;

use crate::AppState;

// ─── Routers ──────────────────────────────────────────────────────────

/// Admin router (auth-guarded): mounted at `/api/v1/org/public-links`.
pub fn admin_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_admin).post(create))
        .route("/:id", delete(revoke))
        .route("/:id/rotate", post(rotate))
}

/// Public router (no auth): mounted at `/public/org`.
pub fn public_routes() -> Router<AppState> {
    Router::new()
        .route("/:slug", get(public_get))
        .route("/:slug/embed.html", get(public_embed))
}

// ─── DTOs ─────────────────────────────────────────────────────────────

/// Query parameters for `GET /api/v1/org/public-links`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListAdminQuery {
    /// Tenant UUID.
    pub tenant_id: Uuid,
}

/// Body of `POST /api/v1/org/public-links`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateBody {
    /// Tenant owning the link.
    pub tenant_id: Uuid,
    /// Root node of the exposed subtree.
    pub root_node_id: Uuid,
    /// Visibility level (`full` | `anon` | `compact`).
    pub visibility: String,
    /// Optional list of allowed origins for CORS / iframe whitelist.
    #[serde(default)]
    pub allowed_origins: Vec<String>,
    /// Optional expiration (ISO 8601 UTC).
    pub expires_at: Option<DateTime<Utc>>,
}

/// View of a public link returned to admins (always exposes the slug).
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct LinkView {
    /// UUID.
    pub id: Uuid,
    /// Tenant.
    pub tenant_id: Uuid,
    /// Root node.
    pub root_node_id: Uuid,
    /// URL slug.
    pub slug: String,
    /// Visibility level.
    pub visibility: String,
    /// Allowed origins.
    pub allowed_origins: Vec<String>,
    /// Expiration.
    pub expires_at: Option<DateTime<Utc>>,
    /// Access counter.
    pub access_count: i32,
    /// Created at.
    pub created_at: DateTime<Utc>,
    /// `true` if the link is still usable.
    pub is_active: bool,
}

impl From<PublicLink> for LinkView {
    fn from(l: PublicLink) -> Self {
        let active = l.is_active();
        Self {
            id: l.id,
            tenant_id: l.tenant_id,
            root_node_id: l.root_node_id,
            slug: l.slug,
            visibility: visibility_to_str(l.visibility).to_string(),
            allowed_origins: l.allowed_origins,
            expires_at: l.expires_at,
            access_count: l.access_count,
            created_at: l.created_at,
            is_active: active,
        }
    }
}

fn visibility_to_str(v: Visibility) -> &'static str {
    match v {
        Visibility::Full => "full",
        Visibility::Anon => "anon",
        Visibility::Compact => "compact",
    }
}

/// Public surface JSON response.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct PublicResponse {
    /// Slug echoed back.
    pub slug: String,
    /// Visibility applied.
    pub visibility: String,
    /// Anonymized nodes.
    pub nodes: Vec<PublicNode>,
    /// Anonymized persons (empty when visibility = compact).
    pub persons: Vec<PublicPerson>,
    /// Total persons under the subtree (always populated).
    pub person_count: usize,
}

/// A node in the public payload.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct PublicNode {
    /// UUID — exposed even in compact mode (used as DOM key).
    pub id: Uuid,
    /// Display name.
    pub name: String,
    /// Materialized path (`acme.rd.platform`).
    pub path: String,
    /// Optional parent id.
    pub parent_id: Option<Uuid>,
}

/// A person in the public payload.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct PublicPerson {
    /// UUID.
    pub id: Uuid,
    /// First name (initial only when anon).
    pub first_name: String,
    /// Last name (initial only when anon).
    pub last_name: String,
    /// Email (only in `full`).
    pub email: Option<String>,
    /// Photo URL (only in `full`).
    pub photo_url: Option<String>,
}

// ─── Admin handlers ───────────────────────────────────────────────────

/// GET /api/v1/org/public-links?tenant_id=…
#[utoipa::path(
    get,
    path = "/api/v1/org/public-links",
    tag = "Org Public Links",
    params(ListAdminQuery),
    responses(
        (status = 200, description = "Active public links", body = Vec<LinkView>),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list_admin(
    State(st): State<AppState>,
    Query(q): Query<ListAdminQuery>,
) -> Result<Json<Vec<LinkView>>> {
    let rows = PublicLinkRepository::new(st.pool.inner())
        .list_active_by_tenant(q.tenant_id)
        .await
        .map_err(|e| Error::Database(format!("list public links: {e}")))?;
    Ok(Json(rows.into_iter().map(LinkView::from).collect()))
}

/// POST /api/v1/org/public-links
#[utoipa::path(
    post,
    path = "/api/v1/org/public-links",
    tag = "Org Public Links",
    request_body = CreateBody,
    responses(
        (status = 201, description = "Link created", body = LinkView),
        (status = 400, description = "Invalid visibility"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn create(
    State(st): State<AppState>,
    Json(body): Json<CreateBody>,
) -> Result<(StatusCode, Json<LinkView>)> {
    let visibility =
        Visibility::parse(&body.visibility).map_err(Error::BadRequest)?;
    let row = PublicLinkRepository::new(st.pool.inner())
        .create(
            body.tenant_id,
            body.root_node_id,
            visibility,
            body.allowed_origins,
            body.expires_at,
            None,
        )
        .await
        .map_err(|e| Error::Database(format!("create public link: {e}")))?;
    Ok((StatusCode::CREATED, Json(LinkView::from(row))))
}

/// DELETE /api/v1/org/public-links/:id
#[utoipa::path(
    delete,
    path = "/api/v1/org/public-links/{id}",
    tag = "Org Public Links",
    params(("id" = Uuid, Path, description = "Link UUID")),
    responses(
        (status = 204, description = "Link revoked"),
        (status = 404, description = "Link not found"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn revoke(State(st): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    let revoked = PublicLinkRepository::new(st.pool.inner())
        .revoke(id)
        .await
        .map_err(|e| Error::Database(format!("revoke public link: {e}")))?;
    if !revoked {
        return Err(Error::NotFound(format!("public link {id}")));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/v1/org/public-links/:id/rotate
#[utoipa::path(
    post,
    path = "/api/v1/org/public-links/{id}/rotate",
    tag = "Org Public Links",
    params(("id" = Uuid, Path, description = "Link UUID")),
    responses(
        (status = 200, description = "New slug generated", body = LinkView),
        (status = 404, description = "Link not found or revoked"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn rotate(State(st): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<LinkView>> {
    let row = PublicLinkRepository::new(st.pool.inner())
        .rotate_slug(id)
        .await
        .map_err(|e| Error::Database(format!("rotate slug: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("public link {id}")))?;
    Ok(Json(LinkView::from(row)))
}

// ─── Public handlers (no auth) ────────────────────────────────────────

/// GET /public/org/:slug — JSON snapshot of the subtree, anonymized.
#[utoipa::path(
    get,
    path = "/public/org/{slug}",
    tag = "Org Public Links",
    params(("slug" = String, Path, description = "Public slug")),
    responses(
        (status = 200, description = "Anonymized snapshot", body = PublicResponse),
        (status = 404, description = "Slug unknown / revoked / expired"),
    ),
)]
#[tracing::instrument(skip(st))]
pub async fn public_get(
    State(st): State<AppState>,
    Path(slug): Path<String>,
) -> Result<(HeaderMap, Json<PublicResponse>)> {
    let (link, nodes, persons) = load_public_payload(&st, &slug).await?;
    let response = build_public_response(&link, nodes, persons);

    let mut headers = HeaderMap::new();
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_ORIGIN,
        header::HeaderValue::from_static("*"),
    );
    headers.insert(
        header::CACHE_CONTROL,
        header::HeaderValue::from_static("public, max-age=60"),
    );
    Ok((headers, Json(response)))
}

/// GET /public/org/:slug/embed.html — minimal self-contained page.
#[utoipa::path(
    get,
    path = "/public/org/{slug}/embed.html",
    tag = "Org Public Links",
    params(("slug" = String, Path, description = "Public slug")),
    responses(
        (status = 200, description = "Self-contained embed", content_type = "text/html"),
        (status = 404, description = "Slug unknown / revoked / expired"),
    ),
)]
#[tracing::instrument(skip(st))]
pub async fn public_embed(
    State(st): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Response> {
    let (link, nodes, persons) = load_public_payload(&st, &slug).await?;
    let response = build_public_response(&link, nodes, persons);
    let html = render_embed_html(&response);

    let mut resp = (StatusCode::OK, html).into_response();
    resp.headers_mut().insert(
        header::CONTENT_TYPE,
        header::HeaderValue::from_static("text/html; charset=utf-8"),
    );
    resp.headers_mut().insert(
        header::ACCESS_CONTROL_ALLOW_ORIGIN,
        header::HeaderValue::from_static("*"),
    );
    // Allow embedding — explicit no X-Frame-Options + permissive CSP.
    resp.headers_mut().insert(
        header::CONTENT_SECURITY_POLICY,
        header::HeaderValue::from_static("default-src 'self' 'unsafe-inline' data:; frame-ancestors *;"),
    );
    Ok(resp)
}

// ─── Helpers ──────────────────────────────────────────────────────────

async fn load_public_payload(
    st: &AppState,
    slug: &str,
) -> Result<(PublicLink, Vec<OrgNode>, Vec<Person>)> {
    let repo = PublicLinkRepository::new(st.pool.inner());
    let link = repo
        .get_active_by_slug(slug)
        .await
        .map_err(|e| Error::Database(format!("get public link: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("public link {slug}")))?;

    // Best-effort: bump access counter — never block the response.
    if let Err(e) = repo.increment_access(link.id).await {
        tracing::warn!(?e, link_id = %link.id, "increment_access failed");
    }

    let node_repo = NodeRepository::new(st.pool.inner());
    let root = node_repo
        .get(link.root_node_id)
        .await
        .map_err(|e| Error::Database(format!("get root node: {e}")))?
        .ok_or_else(|| Error::NotFound("root node missing".to_string()))?;
    let nodes = node_repo
        .subtree(&root.path)
        .await
        .map_err(|e| Error::Database(format!("list subtree: {e}")))?;

    let person_repo = PersonRepository::new(st.pool.inner());
    let persons = person_repo
        .list_by_tenant(link.tenant_id)
        .await
        .map_err(|e| Error::Database(format!("list persons: {e}")))?;

    Ok((link, nodes, persons))
}

fn build_public_response(
    link: &PublicLink,
    nodes: Vec<OrgNode>,
    persons: Vec<Person>,
) -> PublicResponse {
    let public_nodes: Vec<PublicNode> = nodes
        .into_iter()
        .map(|n| PublicNode {
            id: n.id,
            name: n.name,
            path: n.path,
            parent_id: n.parent_id,
        })
        .collect();

    let person_count = persons.len();

    let public_persons: Vec<PublicPerson> = match link.visibility {
        Visibility::Compact => Vec::new(),
        Visibility::Anon => persons
            .into_iter()
            .map(|p| PublicPerson {
                id: p.id,
                first_name: initial(p.first_name.as_deref()),
                last_name: initial(p.last_name.as_deref()),
                email: None,
                photo_url: None,
            })
            .collect(),
        Visibility::Full => persons
            .into_iter()
            .map(|p| {
                // photo_url is read from JSONB attributes if present —
                // dedicated column may be absent in older snapshots.
                let photo_url = p
                    .attributes
                    .get("photo_url")
                    .and_then(|v| v.as_str())
                    .map(str::to_string);
                PublicPerson {
                    id: p.id,
                    first_name: p.first_name.unwrap_or_default(),
                    last_name: p.last_name.unwrap_or_default(),
                    email: Some(p.email),
                    photo_url,
                }
            })
            .collect(),
    };

    PublicResponse {
        slug: link.slug.clone(),
        visibility: visibility_to_str(link.visibility).to_string(),
        nodes: public_nodes,
        persons: public_persons,
        person_count,
    }
}

fn initial(name: Option<&str>) -> String {
    name.and_then(|s| s.chars().next())
        .map(|c| c.to_uppercase().to_string())
        .unwrap_or_else(|| "?".to_string())
}

/// Render a minimal HTML embed. Plain CSS, no JS, iframe-safe.
fn render_embed_html(resp: &PublicResponse) -> String {
    let mut nodes_html = String::new();
    for n in &resp.nodes {
        nodes_html.push_str(&format!(
            "<li><strong>{}</strong> <span class=\"path\">{}</span></li>",
            html_escape(&n.name),
            html_escape(&n.path),
        ));
    }
    let mut persons_html = String::new();
    for p in &resp.persons {
        persons_html.push_str(&format!(
            "<li>{} {}</li>",
            html_escape(&p.first_name),
            html_escape(&p.last_name),
        ));
    }
    if persons_html.is_empty() {
        persons_html.push_str(&format!(
            "<li class=\"muted\">{} persons (compact view)</li>",
            resp.person_count
        ));
    }

    format!(
        "<!DOCTYPE html>\n\
        <html lang=\"en\"><head><meta charset=\"utf-8\">\n\
        <title>SignApps Org · {slug}</title>\n\
        <style>\n\
        body{{font-family:system-ui,sans-serif;margin:1.5rem;color:#111;background:#fff;}}\n\
        h1{{font-size:1.1rem;margin:0 0 .5rem;}}\n\
        .meta{{font-size:.85rem;color:#555;margin-bottom:1rem;}}\n\
        ul{{padding-left:1.25rem;}}\n\
        li{{margin:.15rem 0;}}\n\
        .path{{color:#888;font-size:.75rem;font-family:ui-monospace,Menlo,monospace;}}\n\
        .muted{{color:#888;font-style:italic;}}\n\
        h2{{font-size:.95rem;margin:1.25rem 0 .25rem;color:#444;}}\n\
        </style></head><body>\n\
        <h1>Organization · {slug}</h1>\n\
        <div class=\"meta\">Visibility: <code>{vis}</code> · {pcount} persons</div>\n\
        <h2>Nodes</h2><ul>{nodes_html}</ul>\n\
        <h2>Persons</h2><ul>{persons_html}</ul>\n\
        </body></html>",
        slug = html_escape(&resp.slug),
        vis = html_escape(&resp.visibility),
        pcount = resp.person_count,
        nodes_html = nodes_html,
        persons_html = persons_html,
    )
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initial_extracts_uppercase_first_char() {
        assert_eq!(initial(Some("alice")), "A");
        assert_eq!(initial(Some("Bob")), "B");
        assert_eq!(initial(None), "?");
        assert_eq!(initial(Some("")), "?");
    }

    #[test]
    fn html_escape_handles_dangerous_chars() {
        assert_eq!(html_escape("<script>"), "&lt;script&gt;");
        assert_eq!(html_escape("a & b"), "a &amp; b");
        assert_eq!(html_escape("\"quote\""), "&quot;quote&quot;");
    }

    fn fake_link(visibility: Visibility) -> PublicLink {
        PublicLink {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            root_node_id: Uuid::new_v4(),
            slug: "abc123".into(),
            visibility,
            allowed_origins: vec![],
            expires_at: None,
            access_count: 0,
            created_by_user_id: None,
            created_at: chrono::Utc::now(),
            revoked_at: None,
        }
    }

    fn fake_person() -> Person {
        Person {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            user_id: None,
            email: "alice@example.com".into(),
            first_name: Some("Alice".into()),
            last_name: Some("Wonderland".into()),
            dn: None,
            attributes: serde_json::json!({}),
            active: true,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            last_synced_at: None,
            last_synced_by: None,
        }
    }

    #[test]
    fn anon_visibility_strips_pii() {
        let link = fake_link(Visibility::Anon);
        let resp = build_public_response(&link, vec![], vec![fake_person()]);
        assert_eq!(resp.persons.len(), 1);
        assert_eq!(resp.persons[0].first_name, "A");
        assert_eq!(resp.persons[0].last_name, "W");
        assert!(resp.persons[0].email.is_none());
    }

    #[test]
    fn compact_visibility_returns_no_persons() {
        let link = fake_link(Visibility::Compact);
        let resp = build_public_response(&link, vec![], vec![fake_person()]);
        assert_eq!(resp.persons.len(), 0);
        assert_eq!(resp.person_count, 1);
    }

    #[test]
    fn full_visibility_includes_email() {
        let link = fake_link(Visibility::Full);
        let resp = build_public_response(&link, vec![], vec![fake_person()]);
        assert_eq!(resp.persons.len(), 1);
        assert_eq!(resp.persons[0].first_name, "Alice");
        assert_eq!(resp.persons[0].email.as_deref(), Some("alice@example.com"));
    }
}
