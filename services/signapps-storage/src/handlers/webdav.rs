//! WebDAV protocol handler (RFC 4918) for Drive.
//!
//! Exposes the Drive VFS at `/webdav/*path` using standard WebDAV methods.
//! Clients authenticate via HTTP Basic Auth; credentials are verified against
//! the password hash stored in `identity.users`.
//!
//! Supported methods: OPTIONS, PROPFIND, GET, PUT, MKCOL, DELETE, MOVE, COPY.
//! Compliance level: DAV class 1 and 2.

use axum::{
    body::Body,
    extract::{Request, State},
    http::{header, Method, StatusCode},
    middleware::Next,
    response::Response,
};
use bytes::Bytes;
use chrono::{DateTime, Utc};
use signapps_common::auth::Claims;
use signapps_common::Error as AppError;
use uuid::Uuid;

use crate::AppState;

// ─── Response builder helper ──────────────────────────────────────────────────

/// Build an HTTP response, falling back to 500 if the builder fails.
///
/// `Response::builder().body()` can theoretically fail when header values are
/// invalid (e.g. non-ASCII filenames from user-supplied data). Using this helper
/// prevents a panic in the publicly-exposed WebDAV endpoint.
fn build_response(
    status: StatusCode,
    headers: &[(&str, String)],
    body: Body,
) -> Response {
    let mut builder = Response::builder().status(status);
    for (name, value) in headers {
        builder = builder.header(*name, value.as_str());
    }
    builder.body(body).unwrap_or_else(|e| {
        tracing::error!(?e, "failed to build WebDAV response");
        Response::builder()
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .body(Body::from("Internal Server Error"))
            .expect("static fallback response always builds")
    })
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DAV_CAPABILITIES: &str = "1, 2";
const ALLOWED_METHODS: &str = "OPTIONS, GET, PUT, DELETE, MKCOL, MOVE, COPY, PROPFIND, HEAD";

// ─── Internal DB row type ─────────────────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct DriveNodeRow {
    id: Uuid,
    parent_id: Option<Uuid>,
    name: String,
    node_type: String,
    target_id: Option<Uuid>,
    owner_id: Option<Uuid>,
    size: Option<i64>,
    mime_type: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

// ─── Path resolution helper ───────────────────────────────────────────────────

/// Walk `/Documents/folder/file.pdf` through `drive.nodes` and return the node.
///
/// Returns `None` if any segment is not found (allows callers to distinguish
/// 404 from other errors).
async fn resolve_path(
    pool: &sqlx::PgPool,
    user_id: Uuid,
    path: &str,
) -> Result<Option<DriveNodeRow>, AppError> {
    // Normalise: strip leading slash, split into segments
    let path = path.trim_start_matches('/');
    if path.is_empty() {
        // Virtual root – callers handle this case
        return Ok(None);
    }

    let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();

    let mut current_parent: Option<Uuid> = None;

    for (i, segment) in segments.iter().enumerate() {
        let is_last = i == segments.len() - 1;

        let row: Option<DriveNodeRow> = if let Some(pid) = current_parent {
            sqlx::query_as::<_, DriveNodeRow>(
                r#"
                SELECT id, parent_id, name, node_type::text,
                       target_id, owner_id, size, mime_type,
                       created_at, updated_at
                FROM drive.nodes
                WHERE parent_id = $1 AND name = $2 AND deleted_at IS NULL
                  AND (owner_id = $3 OR EXISTS (
                        SELECT 1 FROM drive.permissions p
                        WHERE p.node_id = drive.nodes.id AND p.user_id = $3))
                LIMIT 1
                "#,
            )
            .bind(pid)
            .bind(segment)
            .bind(user_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
        } else {
            sqlx::query_as::<_, DriveNodeRow>(
                r#"
                SELECT id, parent_id, name, node_type::text,
                       target_id, owner_id, size, mime_type,
                       created_at, updated_at
                FROM drive.nodes
                WHERE parent_id IS NULL AND name = $1 AND deleted_at IS NULL
                  AND (owner_id = $2 OR EXISTS (
                        SELECT 1 FROM drive.permissions p
                        WHERE p.node_id = drive.nodes.id AND p.user_id = $2))
                LIMIT 1
                "#,
            )
            .bind(segment)
            .bind(user_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
        };

        match row {
            Some(n) => {
                if is_last {
                    return Ok(Some(n));
                }
                current_parent = Some(n.id);
            },
            None => return Ok(None),
        }
    }

    Ok(None)
}

/// List direct children of a folder node (or root when `parent_id` is None).
async fn list_children(
    pool: &sqlx::PgPool,
    user_id: Uuid,
    parent_id: Option<Uuid>,
) -> Result<Vec<DriveNodeRow>, AppError> {
    let nodes: Vec<DriveNodeRow> = if let Some(pid) = parent_id {
        sqlx::query_as::<_, DriveNodeRow>(
            r#"
            SELECT id, parent_id, name, node_type::text,
                   target_id, owner_id, size, mime_type,
                   created_at, updated_at
            FROM drive.nodes
            WHERE parent_id = $1 AND deleted_at IS NULL
              AND (owner_id = $2 OR EXISTS (
                    SELECT 1 FROM drive.permissions p
                    WHERE p.node_id = drive.nodes.id AND p.user_id = $2))
            ORDER BY node_type, name
            "#,
        )
        .bind(pid)
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    } else {
        sqlx::query_as::<_, DriveNodeRow>(
            r#"
            SELECT id, parent_id, name, node_type::text,
                   target_id, owner_id, size, mime_type,
                   created_at, updated_at
            FROM drive.nodes
            WHERE parent_id IS NULL AND deleted_at IS NULL
              AND (owner_id = $1 OR EXISTS (
                    SELECT 1 FROM drive.permissions p
                    WHERE p.node_id = drive.nodes.id AND p.user_id = $1))
            ORDER BY node_type, name
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    };
    Ok(nodes)
}

// ─── XML helpers ──────────────────────────────────────────────────────────────

fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

/// RFC 1123 date format required by DAV (same as HTTP Date header).
fn rfc1123(dt: &DateTime<Utc>) -> String {
    dt.format("%a, %d %b %Y %H:%M:%S GMT").to_string()
}

/// ISO 8601 / WebDAV `getlastmodified` format.
fn iso8601(dt: &DateTime<Utc>) -> String {
    dt.to_rfc3339()
}

/// Build a single `<D:response>` element for a node.
fn propfind_response_xml(node: &DriveNodeRow, href: &str) -> String {
    let is_collection = node.node_type == "folder";
    let content_length = node.size.unwrap_or(0);
    let content_type = node
        .mime_type
        .clone()
        .unwrap_or_else(|| "application/octet-stream".into());
    let last_modified = rfc1123(&node.updated_at);
    let creation_date = iso8601(&node.created_at);
    let display_name = escape_xml(&node.name);
    let href_escaped = escape_xml(href);

    let resource_type = if is_collection {
        "<D:collection/>".to_string()
    } else {
        String::new()
    };

    format!(
        r#"<D:response>
  <D:href>{href_escaped}</D:href>
  <D:propstat>
    <D:prop>
      <D:displayname>{display_name}</D:displayname>
      <D:resourcetype>{resource_type}</D:resourcetype>
      <D:getcontentlength>{content_length}</D:getcontentlength>
      <D:getcontenttype>{content_type}</D:getcontenttype>
      <D:getlastmodified>{last_modified}</D:getlastmodified>
      <D:creationdate>{creation_date}</D:creationdate>
      <D:getetag>"{node_id}"</D:getetag>
    </D:prop>
    <D:status>HTTP/1.1 200 OK</D:status>
  </D:propstat>
</D:response>"#,
        href_escaped = href_escaped,
        display_name = display_name,
        resource_type = resource_type,
        content_length = content_length,
        content_type = escape_xml(&content_type),
        last_modified = last_modified,
        creation_date = creation_date,
        node_id = node.id,
    )
}

/// Build a virtual root `<D:response>` element.
fn propfind_root_xml(base_href: &str) -> String {
    let now = rfc1123(&Utc::now());
    let now_iso = iso8601(&Utc::now());
    let href = escape_xml(base_href);
    format!(
        r#"<D:response>
  <D:href>{href}</D:href>
  <D:propstat>
    <D:prop>
      <D:displayname>Drive</D:displayname>
      <D:resourcetype><D:collection/></D:resourcetype>
      <D:getlastmodified>{now}</D:getlastmodified>
      <D:creationdate>{now_iso}</D:creationdate>
    </D:prop>
    <D:status>HTTP/1.1 200 OK</D:status>
  </D:propstat>
</D:response>"#,
        href = href,
        now = now,
        now_iso = now_iso,
    )
}

/// Wrap response elements in a multi-status document.
fn multistatus_xml(responses: &[String]) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="DAV:">
{}
</D:multistatus>"#,
        responses.join("\n")
    )
}

// ─── Authentication middleware ────────────────────────────────────────────────

/// Verify Basic Auth credentials against `identity.users.password_hash`.
///
/// On success injects `Claims` and `Uuid` (user ID) into request extensions,
/// matching what `auth_middleware` does for JWT routes.
#[tracing::instrument(skip(state, request, next), name = "webdav_auth")]
pub async fn webdav_auth(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, (StatusCode, String)> {
    // Extract Authorization header
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_owned());

    let credentials = match auth_header
        .as_deref()
        .and_then(|h| h.strip_prefix("Basic "))
    {
        Some(encoded) => {
            use base64::Engine;
            base64::engine::general_purpose::STANDARD
                .decode(encoded)
                .ok()
                .and_then(|b| String::from_utf8(b).ok())
        },
        None => None,
    };

    let (username, password) = match credentials.as_deref().and_then(|c| c.split_once(':')) {
        Some((u, p)) => (u.to_owned(), p.to_owned()),
        None => {
            return Ok(Response::builder()
                .status(StatusCode::UNAUTHORIZED)
                .header(header::WWW_AUTHENTICATE, r#"Basic realm="SignApps Drive""#)
                .header(header::CONTENT_TYPE, "text/plain")
                .body(Body::from("Authentication required"))
                .expect("static auth response always builds"));
        },
    };

    // Query the user from the database
    let row: Option<(Uuid, String, i16, Option<bool>)> = sqlx::query_as(
        r#"SELECT id, password_hash, role, webdav_enabled
           FROM identity.users
           WHERE username = $1 AND deleted_at IS NULL
           LIMIT 1"#,
    )
    .bind(&username)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {e}"),
        )
    })?;

    let (user_id, hash, role, webdav_enabled) = match row {
        Some(r) => r,
        None => {
            return Ok(Response::builder()
                .status(StatusCode::UNAUTHORIZED)
                .header(header::WWW_AUTHENTICATE, r#"Basic realm="SignApps Drive""#)
                .header(header::CONTENT_TYPE, "text/plain")
                .body(Body::from("Invalid credentials"))
                .expect("static auth response always builds"));
        },
    };

    // Check WebDAV is enabled for this user
    if webdav_enabled == Some(false) {
        return Ok(Response::builder()
            .status(StatusCode::FORBIDDEN)
            .header(header::CONTENT_TYPE, "text/plain")
            .body(Body::from("WebDAV access disabled for this account"))
            .expect("static auth response always builds"));
    }

    // Verify password with bcrypt
    let password_valid = bcrypt::verify(&password, &hash).unwrap_or(false);

    if !password_valid {
        return Ok(Response::builder()
            .status(StatusCode::UNAUTHORIZED)
            .header(header::WWW_AUTHENTICATE, r#"Basic realm="SignApps Drive""#)
            .header(header::CONTENT_TYPE, "text/plain")
            .body(Body::from("Invalid credentials"))
            .expect("static auth response always builds"));
    }

    // Build synthetic Claims and inject into extensions (same pattern as auth_middleware)
    let now = chrono::Utc::now().timestamp();
    let claims = Claims {
        sub: user_id,
        username: username.clone(),
        role,
        tenant_id: None,
        workspace_ids: None,
        exp: now + 3600,
        iat: now,
        token_type: "access".into(),
    };

    request.extensions_mut().insert(user_id);
    request.extensions_mut().insert(claims);

    Ok(next.run(request).await)
}

// ─── WebDAV dispatch ──────────────────────────────────────────────────────────

/// Central dispatcher: routes by HTTP method to the appropriate WebDAV handler.
#[tracing::instrument(skip(state, request), name = "webdav_dispatch")]
pub async fn webdav_dispatch(State(state): State<AppState>, request: Request) -> Response {
    let method = request.method().clone();
    let uri = request.uri().clone();
    let headers = request.headers().clone();

    // Extract user_id from extensions (injected by webdav_auth)
    let user_id = match request.extensions().get::<Uuid>().copied() {
        Some(id) => id,
        None => {
            return Response::builder()
                .status(StatusCode::UNAUTHORIZED)
                .header(header::CONTENT_TYPE, "text/plain")
                .body(Body::from("Unauthorized"))
                .expect("static dispatch response always builds");
        },
    };

    // Extract synthetic Claims injected by webdav_auth (used for SharingEngine context)
    let claims = request.extensions().get::<Claims>().cloned();

    // Extract path after /webdav prefix
    let full_path = uri.path();
    let vpath = full_path
        .strip_prefix("/webdav")
        .unwrap_or(full_path)
        .to_owned();

    match method {
        Method::OPTIONS => handle_options(),
        m if m.as_str() == "PROPFIND" => {
            let depth = headers
                .get("Depth")
                .and_then(|h| h.to_str().ok())
                .unwrap_or("1")
                .to_owned();
            match handle_propfind(&state, user_id, &vpath, &depth, full_path).await {
                Ok(r) => r,
                Err(e) => error_response(e),
            }
        },
        Method::GET | Method::HEAD => {
            match handle_get(&state, user_id, &vpath, method == Method::HEAD).await {
                Ok(r) => r,
                Err(e) => error_response(e),
            }
        },
        Method::PUT => {
            // Collect body bytes from request
            let body_bytes =
                match axum::body::to_bytes(request.into_body(), 500 * 1024 * 1024).await {
                    Ok(b) => b,
                    Err(_) => {
                        return Response::builder()
                            .status(StatusCode::BAD_REQUEST)
                            .body(Body::from("Failed to read request body"))
                            .expect("static dispatch response always builds");
                    },
                };
            let content_type = headers
                .get(header::CONTENT_TYPE)
                .and_then(|h| h.to_str().ok())
                .map(|s| s.to_owned());
            match handle_put(&state, user_id, claims.as_ref(), &vpath, body_bytes, content_type)
                .await
            {
                Ok(r) => r,
                Err(e) => error_response(e),
            }
        },
        m if m.as_str() == "MKCOL" => {
            match handle_mkcol(&state, user_id, claims.as_ref(), &vpath).await {
                Ok(r) => r,
                Err(e) => error_response(e),
            }
        },
        Method::DELETE => match handle_delete(&state, user_id, claims.as_ref(), &vpath).await {
            Ok(r) => r,
            Err(e) => error_response(e),
        },
        m if m.as_str() == "MOVE" => {
            let dest = headers
                .get("Destination")
                .and_then(|h| h.to_str().ok())
                .map(|s| s.to_owned());
            let overwrite = headers
                .get("Overwrite")
                .and_then(|h| h.to_str().ok())
                .map(|s| s != "F")
                .unwrap_or(true);
            match handle_move(
                &state,
                user_id,
                claims.as_ref(),
                &vpath,
                dest.as_deref(),
                overwrite,
            )
            .await
            {
                Ok(r) => r,
                Err(e) => error_response(e),
            }
        },
        m if m.as_str() == "COPY" => {
            let dest = headers
                .get("Destination")
                .and_then(|h| h.to_str().ok())
                .map(|s| s.to_owned());
            let overwrite = headers
                .get("Overwrite")
                .and_then(|h| h.to_str().ok())
                .map(|s| s != "F")
                .unwrap_or(true);
            match handle_copy(&state, user_id, &vpath, dest.as_deref(), overwrite).await {
                Ok(r) => r,
                Err(e) => error_response(e),
            }
        },
        _ => Response::builder()
            .status(StatusCode::METHOD_NOT_ALLOWED)
            .header(header::ALLOW, ALLOWED_METHODS)
            .body(Body::empty())
            .expect("static dispatch response always builds"),
    }
}

// ─── Individual method handlers ───────────────────────────────────────────────

/// OPTIONS — advertise WebDAV capabilities.
fn handle_options() -> Response {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::ALLOW, ALLOWED_METHODS)
        .header("DAV", DAV_CAPABILITIES)
        .header(header::CONTENT_LENGTH, "0")
        .body(Body::empty())
        .expect("static OPTIONS response always builds")
}

/// PROPFIND — list folder or get properties of a single node.
async fn handle_propfind(
    state: &AppState,
    user_id: Uuid,
    vpath: &str,
    depth: &str,
    full_path: &str,
) -> Result<Response, AppError> {
    let pool = state.pool.inner();

    // Build the base href (path that was requested, normalised with trailing
    // slash for collections to keep WebDAV clients happy)
    let base_href = full_path.to_owned();

    let mut responses: Vec<String> = Vec::new();

    let path_trimmed = vpath.trim_matches('/');

    if path_trimmed.is_empty() {
        // Root collection
        let root_href = if base_href.ends_with('/') {
            base_href.clone()
        } else {
            format!("{}/", base_href)
        };
        responses.push(propfind_root_xml(&root_href));

        if depth != "0" {
            let children = list_children(pool, user_id, None).await?;
            for child in &children {
                let child_href = format!("{}{}", root_href, urlencoding::encode(&child.name));
                if child.node_type == "folder" {
                    responses.push(propfind_response_xml(child, &format!("{}/", child_href)));
                } else {
                    responses.push(propfind_response_xml(child, &child_href));
                }
            }
        }
    } else {
        // Specific node
        let node = resolve_path(pool, user_id, vpath).await?;
        match node {
            None => {
                return Ok(Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .header(header::CONTENT_TYPE, "text/plain")
                    .body(Body::from("Not Found"))
                    .expect("static PROPFIND response always builds"));
            },
            Some(n) => {
                let node_href = if n.node_type == "folder" {
                    if base_href.ends_with('/') {
                        base_href.clone()
                    } else {
                        format!("{}/", base_href)
                    }
                } else {
                    base_href.clone()
                };
                responses.push(propfind_response_xml(&n, &node_href));

                // Depth 1: also list children of a folder
                if depth != "0" && n.node_type == "folder" {
                    let children = list_children(pool, user_id, Some(n.id)).await?;
                    for child in &children {
                        let child_href =
                            format!("{}{}", node_href, urlencoding::encode(&child.name));
                        if child.node_type == "folder" {
                            responses
                                .push(propfind_response_xml(child, &format!("{}/", child_href)));
                        } else {
                            responses.push(propfind_response_xml(child, &child_href));
                        }
                    }
                }
            },
        }
    }

    let xml = multistatus_xml(&responses);

    Ok(Response::builder()
        .status(StatusCode::MULTI_STATUS)
        .header(header::CONTENT_TYPE, "application/xml; charset=utf-8")
        .header("DAV", DAV_CAPABILITIES)
        .body(Body::from(xml))
        .expect("PROPFIND multistatus response always builds"))
}

/// GET/HEAD — download a file from storage.
async fn handle_get(
    state: &AppState,
    user_id: Uuid,
    vpath: &str,
    head_only: bool,
) -> Result<Response, AppError> {
    let pool = state.pool.inner();
    let node = resolve_path(pool, user_id, vpath)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Node not found: {vpath}")))?;

    if node.node_type == "folder" {
        return Ok(Response::builder()
            .status(StatusCode::METHOD_NOT_ALLOWED)
            .header(header::CONTENT_TYPE, "text/plain")
            .body(Body::from("Cannot GET a collection"))
            .expect("static GET response always builds"));
    }

    // node.target_id is the storage key (UUID stored as string path)
    let storage_key = node
        .target_id
        .map(|id| id.to_string())
        .ok_or_else(|| AppError::NotFound("Node has no storage target".into()))?;

    // Determine bucket: use first path segment of vpath as bucket, or default
    let bucket = vpath
        .trim_start_matches('/')
        .split('/')
        .next()
        .filter(|s| !s.is_empty())
        .unwrap_or("default")
        .to_owned();

    let obj = state.storage.get_object(&bucket, &storage_key).await?;

    let content_type = obj.content_type;
    let content_length = obj.content_length;

    // Build the Content-Disposition value — sanitise the filename to ASCII-safe
    // form using RFC 5987 percent-encoding so non-ASCII names don't cause the
    // response builder to reject the header value.
    let safe_filename = node.name.replace('"', "\\\"");
    let disposition = format!("attachment; filename=\"{safe_filename}\"");

    // Prefer the per-node mime_type stored in the DB over the object's generic
    // content_type when available.
    let effective_content_type = node.mime_type.clone().unwrap_or(content_type);

    let headers: &[(&str, String)] = &[
        (header::CONTENT_TYPE.as_str(), effective_content_type),
        (header::CONTENT_LENGTH.as_str(), content_length.to_string()),
        (header::CONTENT_DISPOSITION.as_str(), disposition),
    ];

    let body = if head_only {
        Body::empty()
    } else {
        Body::from(obj.data)
    };

    Ok(build_response(StatusCode::OK, headers, body))
}

/// PUT — create or update a file node in the Drive.
async fn handle_put(
    state: &AppState,
    user_id: Uuid,
    claims: Option<&Claims>,
    vpath: &str,
    body: Bytes,
    content_type: Option<String>,
) -> Result<Response, AppError> {
    let pool = state.pool.inner();

    // Split into parent path + filename
    let (parent_path, filename) = split_parent(vpath);

    // Resolve parent
    let parent_id = if parent_path.trim_matches('/').is_empty() {
        None
    } else {
        let parent = resolve_path(pool, user_id, parent_path)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Parent path not found: {parent_path}")))?;
        // Check write permission on parent
        check_write_permission(state, user_id, claims, parent.id).await?;
        Some(parent.id)
    };

    let content_type = content_type.unwrap_or_else(|| {
        mime_guess::from_path(filename)
            .first_or_octet_stream()
            .to_string()
    });

    let size = body.len() as i64;

    // Generate a storage key (UUID)
    let storage_key = Uuid::new_v4().to_string();

    // Determine bucket from the first path segment
    let bucket = vpath
        .trim_start_matches('/')
        .split('/')
        .next()
        .filter(|s| !s.is_empty())
        .unwrap_or("drive")
        .to_owned();

    // Check if node already exists (update)
    let existing = resolve_path(pool, user_id, vpath).await?;

    if let Some(existing_node) = existing {
        // Update: overwrite storage + update node size/mime
        let target = existing_node
            .target_id
            .map(|id| id.to_string())
            .unwrap_or_else(|| storage_key.clone());

        state
            .storage
            .put_object(&bucket, &target, body, Some(&content_type))
            .await?;

        sqlx::query(
            "UPDATE drive.nodes SET size = $1, mime_type = $2, updated_at = NOW() WHERE id = $3",
        )
        .bind(size)
        .bind(&content_type)
        .bind(existing_node.id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

        return Ok(Response::builder()
            .status(StatusCode::NO_CONTENT)
            .body(Body::empty())
            .expect("static PUT response always builds"));
    }

    // Create: upload to storage and insert drive node
    state
        .storage
        .put_object(&bucket, &storage_key, body, Some(&content_type))
        .await?;

    let storage_key_uuid: Option<Uuid> = Uuid::parse_str(&storage_key).ok();

    sqlx::query(
        r#"
        INSERT INTO drive.nodes (parent_id, name, node_type, target_id, owner_id, size, mime_type)
        VALUES ($1, $2, 'file'::text::drive.node_type, $3, $4, $5, $6)
        "#,
    )
    .bind(parent_id)
    .bind(filename)
    .bind(storage_key_uuid)
    .bind(user_id)
    .bind(size)
    .bind(&content_type)
    .execute(pool)
    .await
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(Response::builder()
        .status(StatusCode::CREATED)
        .body(Body::empty())
        .expect("static PUT response always builds"))
}

/// MKCOL — create a folder node.
async fn handle_mkcol(
    state: &AppState,
    user_id: Uuid,
    claims: Option<&Claims>,
    vpath: &str,
) -> Result<Response, AppError> {
    let pool = state.pool.inner();

    let (parent_path, folder_name) = split_parent(vpath);

    if folder_name.is_empty() {
        return Ok(Response::builder()
            .status(StatusCode::METHOD_NOT_ALLOWED)
            .body(Body::from("Cannot create root collection"))
            .expect("static MKCOL response always builds"));
    }

    // Check node doesn't already exist
    if resolve_path(pool, user_id, vpath).await?.is_some() {
        return Ok(Response::builder()
            .status(StatusCode::METHOD_NOT_ALLOWED)
            .body(Body::from("Collection already exists"))
            .expect("static MKCOL response always builds"));
    }

    let parent_id = if parent_path.trim_matches('/').is_empty() {
        None
    } else {
        let parent = resolve_path(pool, user_id, parent_path)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Parent path not found: {parent_path}")))?;
        check_write_permission(state, user_id, claims, parent.id).await?;
        Some(parent.id)
    };

    sqlx::query(
        r#"
        INSERT INTO drive.nodes (parent_id, name, node_type, owner_id)
        VALUES ($1, $2, 'folder'::text::drive.node_type, $3)
        "#,
    )
    .bind(parent_id)
    .bind(folder_name)
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(Response::builder()
        .status(StatusCode::CREATED)
        .body(Body::empty())
        .expect("static MKCOL response always builds"))
}

/// DELETE — soft-delete a node.
async fn handle_delete(
    state: &AppState,
    user_id: Uuid,
    claims: Option<&Claims>,
    vpath: &str,
) -> Result<Response, AppError> {
    let pool = state.pool.inner();
    let node = resolve_path(pool, user_id, vpath)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Node not found: {vpath}")))?;

    // Require manager role (owner or explicit grant via SharingEngine)
    let is_owner = node.owner_id == Some(user_id);
    if !is_owner {
        let allowed = check_manage_permission(state, user_id, claims, node.id)
            .await
            .unwrap_or(false);
        if !allowed {
            return Ok(Response::builder()
                .status(StatusCode::FORBIDDEN)
                .body(Body::from("Requires manager role"))
                .expect("static DELETE response always builds"));
        }
    }

    sqlx::query("UPDATE drive.nodes SET deleted_at = NOW() WHERE id = $1")
        .bind(node.id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(Response::builder()
        .status(StatusCode::NO_CONTENT)
        .body(Body::empty())
        .expect("static DELETE response always builds"))
}

/// MOVE — rename or move a node (reads Destination header).
async fn handle_move(
    state: &AppState,
    user_id: Uuid,
    claims: Option<&Claims>,
    vpath: &str,
    destination: Option<&str>,
    _overwrite: bool,
) -> Result<Response, AppError> {
    let pool = state.pool.inner();

    let dest_full =
        destination.ok_or_else(|| AppError::Validation("Missing Destination header".into()))?;

    // Extract path portion from the Destination URL (may be a full URL)
    let dest_path = extract_webdav_path(dest_full);

    let node = resolve_path(pool, user_id, vpath)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Source not found: {vpath}")))?;

    // Check write access on source
    check_write_permission(state, user_id, claims, node.id).await?;

    let (dest_parent_path, new_name) = split_parent(dest_path);

    let new_parent_id = if dest_parent_path.trim_matches('/').is_empty() {
        None
    } else {
        let parent = resolve_path(pool, user_id, dest_parent_path)
            .await?
            .ok_or_else(|| {
                AppError::NotFound(format!("Destination parent not found: {dest_parent_path}"))
            })?;
        Some(parent.id)
    };

    sqlx::query(
        "UPDATE drive.nodes SET name = $1, parent_id = $2, updated_at = NOW() WHERE id = $3",
    )
    .bind(new_name)
    .bind(new_parent_id)
    .bind(node.id)
    .execute(pool)
    .await
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(Response::builder()
        .status(StatusCode::CREATED)
        .body(Body::empty())
        .expect("static MOVE response always builds"))
}

/// COPY — duplicate a node.
async fn handle_copy(
    state: &AppState,
    user_id: Uuid,
    vpath: &str,
    destination: Option<&str>,
    _overwrite: bool,
) -> Result<Response, AppError> {
    let pool = state.pool.inner();

    let dest_full =
        destination.ok_or_else(|| AppError::Validation("Missing Destination header".into()))?;
    let dest_path = extract_webdav_path(dest_full);

    let node = resolve_path(pool, user_id, vpath)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Source not found: {vpath}")))?;

    let (dest_parent_path, new_name) = split_parent(dest_path);

    let new_parent_id = if dest_parent_path.trim_matches('/').is_empty() {
        None
    } else {
        let parent = resolve_path(pool, user_id, dest_parent_path)
            .await?
            .ok_or_else(|| {
                AppError::NotFound(format!("Destination parent not found: {dest_parent_path}"))
            })?;
        Some(parent.id)
    };

    if node.node_type == "folder" {
        // Shallow copy for folders: create a new empty folder
        sqlx::query(
            r#"
            INSERT INTO drive.nodes (parent_id, name, node_type, owner_id)
            VALUES ($1, $2, 'folder'::text::drive.node_type, $3)
            "#,
        )
        .bind(new_parent_id)
        .bind(new_name)
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    } else {
        // Copy file: duplicate storage object and create new node
        let src_key = node
            .target_id
            .map(|id| id.to_string())
            .ok_or_else(|| AppError::NotFound("Source has no storage target".into()))?;

        let dest_key = Uuid::new_v4().to_string();
        let bucket = vpath
            .trim_start_matches('/')
            .split('/')
            .next()
            .filter(|s| !s.is_empty())
            .unwrap_or("drive")
            .to_owned();

        state
            .storage
            .copy_object(&bucket, &src_key, &bucket, &dest_key)
            .await?;

        let dest_key_uuid: Option<Uuid> = Uuid::parse_str(&dest_key).ok();

        sqlx::query(
            r#"
            INSERT INTO drive.nodes (parent_id, name, node_type, target_id, owner_id, size, mime_type)
            VALUES ($1, $2, 'file'::text::drive.node_type, $3, $4, $5, $6)
            "#,
        )
        .bind(new_parent_id)
        .bind(new_name)
        .bind(dest_key_uuid)
        .bind(user_id)
        .bind(node.size)
        .bind(&node.mime_type)
        .execute(pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    }

    Ok(Response::builder()
        .status(StatusCode::CREATED)
        .body(Body::empty())
        .expect("static COPY response always builds"))
}

// ─── WebDAV admin config handlers ─────────────────────────────────────────────

/// `GET /api/v1/webdav/config` — return global WebDAV configuration.
#[utoipa::path(
    get,
    path = "/api/v1/webdav/config",
    responses(
        (status = 200, description = "WebDAV configuration"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "webdav"
)]
#[tracing::instrument(skip(state), name = "get_webdav_config")]
pub async fn get_webdav_config(
    State(state): State<AppState>,
) -> Result<axum::Json<serde_json::Value>, AppError> {
    let enabled: Option<bool> = sqlx::query_scalar(
        r#"SELECT setting_value::boolean
           FROM admin_system_settings
           WHERE setting_key = 'webdav_enabled'
           LIMIT 1"#,
    )
    .fetch_optional(state.pool.inner())
    .await
    .unwrap_or(None);

    let url = format!(
        "http://localhost:{}/webdav/",
        std::env::var("SERVER_PORT").unwrap_or_else(|_| "3004".into())
    );

    Ok(axum::Json(serde_json::json!({
        "enabled": enabled.unwrap_or(true),
        "url": url,
    })))
}

/// `PUT /api/v1/webdav/config` — update global WebDAV enabled flag.
#[utoipa::path(
    put,
    path = "/api/v1/webdav/config",
    responses(
        (status = 200, description = "Updated WebDAV configuration"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "webdav"
)]
#[tracing::instrument(skip(state, payload), name = "update_webdav_config")]
pub async fn update_webdav_config(
    State(state): State<AppState>,
    axum::Json(payload): axum::Json<serde_json::Value>,
) -> Result<axum::Json<serde_json::Value>, AppError> {
    let enabled = payload
        .get("enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    sqlx::query(
        r#"
        INSERT INTO admin_system_settings (setting_key, setting_value)
        VALUES ('webdav_enabled', $1)
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = NOW()
        "#,
    )
    .bind(enabled.to_string())
    .execute(state.pool.inner())
    .await
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(axum::Json(serde_json::json!({ "enabled": enabled })))
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/// Split `/a/b/c` into `("/a/b", "c")`.
fn split_parent(path: &str) -> (&str, &str) {
    let path = path.trim_end_matches('/');
    match path.rfind('/') {
        Some(pos) => {
            let parent = &path[..pos];
            let name = &path[pos + 1..];
            (if parent.is_empty() { "/" } else { parent }, name)
        },
        None => ("/", path),
    }
}

/// Extract the `/webdav/...` path from a full URL or relative path.
fn extract_webdav_path(dest: &str) -> &str {
    // Strip http(s)://host:port prefix if present
    let path = if dest.starts_with("http://") || dest.starts_with("https://") {
        dest.find("/webdav").map(|i| &dest[i..]).unwrap_or(dest)
    } else {
        dest
    };
    path.strip_prefix("/webdav").unwrap_or(path)
}

/// Check that `user_id` has at least editor role on `node_id` via the SharingEngine.
///
/// Falls back to `false` (deny) when Claims are unavailable (no tenant context)
/// so that unauthenticated or incomplete sessions cannot accidentally gain write
/// access.
async fn check_write_permission(
    state: &AppState,
    user_id: Uuid,
    claims: Option<&Claims>,
    node_id: Uuid,
) -> Result<(), AppError> {
    let allowed = check_min_role(state, user_id, claims, node_id, signapps_sharing::types::Role::Editor).await;
    if !allowed {
        return Err(AppError::Forbidden(
            "Requires editor role on this node".into(),
        ));
    }
    Ok(())
}

/// Check that `user_id` has at least manager role on `node_id` via the SharingEngine.
async fn check_manage_permission(
    state: &AppState,
    user_id: Uuid,
    claims: Option<&Claims>,
    node_id: Uuid,
) -> Result<bool, AppError> {
    Ok(check_min_role(state, user_id, claims, node_id, signapps_sharing::types::Role::Manager).await)
}

/// Core helper: returns `true` when the user holds at least `min_role` on `node_id`.
async fn check_min_role(
    state: &AppState,
    user_id: Uuid,
    claims: Option<&Claims>,
    node_id: Uuid,
    min_role: signapps_sharing::types::Role,
) -> bool {
    let Some(claims) = claims else { return false };

    let user_ctx = match state.sharing.build_user_context(claims).await {
        Ok(ctx) => ctx,
        Err(_) => return false,
    };

    // Determine resource type
    let rtype: signapps_sharing::types::ResourceType =
        sqlx::query_scalar("SELECT node_type FROM drive.nodes WHERE id = $1")
            .bind(node_id)
            .fetch_optional(state.pool.inner())
            .await
            .ok()
            .flatten()
            .map(|t: String| {
                if t == "folder" {
                    signapps_sharing::types::ResourceType::Folder
                } else {
                    signapps_sharing::types::ResourceType::File
                }
            })
            .unwrap_or(signapps_sharing::types::ResourceType::File);

    let resource = signapps_sharing::types::ResourceRef { resource_type: rtype, resource_id: node_id };
    let action = match min_role {
        signapps_sharing::types::Role::Manager => signapps_sharing::types::Action::new("manage"),
        signapps_sharing::types::Role::Editor => signapps_sharing::types::Action::write(),
        _ => signapps_sharing::types::Action::read(),
    };

    // Also check if user is direct owner of the node (owner always has manager)
    let is_owner: bool = sqlx::query_scalar("SELECT owner_id = $1 FROM drive.nodes WHERE id = $2")
        .bind(user_id)
        .bind(node_id)
        .fetch_optional(state.pool.inner())
        .await
        .ok()
        .flatten()
        .unwrap_or(false);

    if is_owner {
        return true;
    }

    state.sharing.check(&user_ctx, resource, action, None).await.is_ok()
}

/// Convert `AppError` into an HTTP response.
fn error_response(e: AppError) -> Response {
    let (status, msg) = match &e {
        AppError::NotFound(m) => (StatusCode::NOT_FOUND, m.clone()),
        AppError::Forbidden(m) => (StatusCode::FORBIDDEN, m.clone()),
        AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "Unauthorized".into()),
        AppError::Validation(m) => (StatusCode::BAD_REQUEST, m.clone()),
        other => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Internal error: {other}"),
        ),
    };
    build_response(
        status,
        &[(header::CONTENT_TYPE.as_str(), "text/plain".to_string())],
        Body::from(msg),
    )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_parent_works() {
        assert_eq!(split_parent("/a/b/c"), ("/a/b", "c"));
        assert_eq!(split_parent("/a/b/"), ("/a", "b"));
        assert_eq!(split_parent("/file.txt"), ("/", "file.txt"));
        assert_eq!(split_parent("file.txt"), ("/", "file.txt"));
    }

    #[test]
    fn extract_webdav_path_works() {
        assert_eq!(
            extract_webdav_path("http://localhost:3004/webdav/Documents/file.txt"),
            "/Documents/file.txt"
        );
        assert_eq!(extract_webdav_path("/webdav/Documents"), "/Documents");
    }

    #[test]
    fn multistatus_xml_wraps_correctly() {
        let xml = multistatus_xml(&["<D:response/>".into()]);
        assert!(xml.contains("<D:multistatus"));
        assert!(xml.contains("<D:response/>"));
    }
}
