//! CardDAV handlers for contact access via DAV.
//!
//! Implements PROPFIND, GET, PUT, DELETE, and REPORT for CardDAV resources
//! stored in `mailserver.addressbooks` and `mailserver.contacts`.

use axum::http::Method;
use signapps_dav::{
    carddav::{
        build_addressbook_multiget_response, build_addressbook_propfind_response, AddressbookInfo,
        ContactResource,
    },
    vcard::VCard,
    webdav::DavResponse,
    xml::{
        build_multistatus, build_resource_response, parse_propfind, parse_report, ReportRequest,
    },
};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

use super::auth::DavAuth;

/// CardDAV contact row from the database.
#[derive(Debug, sqlx::FromRow)]
struct ContactRow {
    #[allow(dead_code)]
    id: Uuid,
    uid: String,
    etag: String,
    vcard_data: String,
}

/// CardDAV addressbook row from the database.
#[derive(Debug, sqlx::FromRow)]
struct AddressbookRow {
    id: Uuid,
    display_name: String,
    ctag: String,
    description: Option<String>,
}

/// Handle a CardDAV request.
///
/// Routes by HTTP method to the appropriate handler.
///
/// # Errors
///
/// Returns a [`DavResponse`] with an appropriate status code on error.
///
/// # Panics
///
/// None.
#[allow(clippy::too_many_arguments)]
#[tracing::instrument(skip(pool, auth, body), fields(email = %auth.email, path = %path))]
pub async fn handle(
    pool: &Pool<Postgres>,
    auth: &DavAuth,
    method: &Method,
    path: &str,
    depth: u8,
    body: Option<&str>,
    if_match: Option<&str>,
) -> DavResponse {
    let segments: Vec<&str> = path.trim_matches('/').split('/').collect();

    match method.as_str() {
        "PROPFIND" => handle_propfind(pool, auth, &segments, depth, body).await,
        "GET" => handle_get(pool, auth, &segments).await,
        "PUT" => handle_put(pool, auth, &segments, body, if_match).await,
        "DELETE" => handle_delete(pool, auth, &segments, if_match).await,
        "REPORT" => handle_report(pool, auth, &segments, body).await,
        "MKCOL" => handle_mkcol(pool, auth, &segments).await,
        _ => DavResponse::new(405, String::new()),
    }
}

/// Handle PROPFIND requests for addressbooks/contacts.
async fn handle_propfind(
    pool: &Pool<Postgres>,
    auth: &DavAuth,
    segments: &[&str],
    depth: u8,
    body: Option<&str>,
) -> DavResponse {
    let _propfind = match parse_propfind(body.unwrap_or("")) {
        Ok(pf) => pf,
        Err(e) => {
            tracing::warn!("Invalid PROPFIND body: {}", e);
            return DavResponse::new(400, format!("Invalid PROPFIND: {e}"));
        },
    };

    match segments.len() {
        // /dav/addressbooks/ or /dav/addressbooks/<email>/
        0..=3 => {
            if depth == 0 {
                let resp = build_resource_response(
                    &format!("/dav/addressbooks/{}/", auth.email),
                    vec![
                        ("D:displayname".to_string(), auth.email.clone()),
                        ("D:resourcetype".to_string(), "<D:collection/>".to_string()),
                    ],
                );
                DavResponse::multistatus(build_multistatus(&[resp]))
            } else {
                list_addressbooks(pool, auth).await
            }
        },
        // /dav/addressbooks/<email>/<book-id>/
        4 => {
            let book_id = segments[3].trim_matches('/');
            if depth == 0 {
                addressbook_props(pool, auth, book_id).await
            } else {
                list_contacts(pool, auth, book_id).await
            }
        },
        // /dav/addressbooks/<email>/<book-id>/<contact-uid>.vcf
        _ => {
            let book_id = segments[3];
            let contact_file = segments[4];
            let contact_uid = contact_file.trim_end_matches(".vcf");
            contact_props(pool, auth, book_id, contact_uid).await
        },
    }
}

/// List all addressbooks for the authenticated user.
async fn list_addressbooks(pool: &Pool<Postgres>, auth: &DavAuth) -> DavResponse {
    let books: Vec<AddressbookRow> = match sqlx::query_as(
        r#"SELECT id, display_name, COALESCE(ctag, '') AS ctag, description
           FROM mailserver.addressbooks
           WHERE account_id = $1"#,
    )
    .bind(auth.account_id)
    .fetch_all(pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::error!("Failed to list addressbooks: {}", e);
            return DavResponse::new(500, format!("DB error: {e}"));
        },
    };

    let infos: Vec<AddressbookInfo> = books
        .iter()
        .map(|b| AddressbookInfo {
            href: format!("/dav/addressbooks/{}/{}/", auth.email, b.id),
            display_name: b.display_name.clone(),
            ctag: format!("\"{}\"", b.ctag),
            description: b.description.clone(),
        })
        .collect();

    DavResponse::multistatus(build_addressbook_propfind_response(&infos))
}

/// Return properties for a single addressbook.
async fn addressbook_props(pool: &Pool<Postgres>, auth: &DavAuth, book_id: &str) -> DavResponse {
    let book_uuid = match Uuid::parse_str(book_id) {
        Ok(u) => u,
        Err(_) => return DavResponse::not_found(),
    };

    let book: Option<AddressbookRow> = match sqlx::query_as(
        r#"SELECT id, display_name, COALESCE(ctag, '') AS ctag, description
           FROM mailserver.addressbooks
           WHERE id = $1 AND account_id = $2"#,
    )
    .bind(book_uuid)
    .bind(auth.account_id)
    .fetch_optional(pool)
    .await
    {
        Ok(b) => b,
        Err(e) => {
            tracing::error!("Failed to fetch addressbook: {}", e);
            return DavResponse::new(500, format!("DB error: {e}"));
        },
    };

    match book {
        Some(b) => {
            let info = AddressbookInfo {
                href: format!("/dav/addressbooks/{}/{}/", auth.email, b.id),
                display_name: b.display_name,
                ctag: format!("\"{}\"", b.ctag),
                description: b.description,
            };
            DavResponse::multistatus(build_addressbook_propfind_response(&[info]))
        },
        None => DavResponse::not_found(),
    }
}

/// List all contacts in an addressbook.
async fn list_contacts(pool: &Pool<Postgres>, auth: &DavAuth, book_id: &str) -> DavResponse {
    let book_uuid = match Uuid::parse_str(book_id) {
        Ok(u) => u,
        Err(_) => return DavResponse::not_found(),
    };

    let contacts: Vec<ContactRow> = match sqlx::query_as(
        r#"SELECT id, uid, COALESCE(etag, '') AS etag, COALESCE(vcard_data, '') AS vcard_data
           FROM mailserver.contacts
           WHERE addressbook_id = $1 AND addressbook_id IN (
               SELECT id FROM mailserver.addressbooks WHERE account_id = $2
           )"#,
    )
    .bind(book_uuid)
    .bind(auth.account_id)
    .fetch_all(pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::error!("Failed to list contacts: {}", e);
            return DavResponse::new(500, format!("DB error: {e}"));
        },
    };

    let resources: Vec<ContactResource> = contacts
        .iter()
        .map(|c| ContactResource {
            href: format!(
                "/dav/addressbooks/{}/{}/{}.vcf",
                auth.email, book_uuid, c.uid
            ),
            etag: format!("\"{}\"", c.etag),
            address_data: c.vcard_data.clone(),
        })
        .collect();

    DavResponse::multistatus(build_addressbook_multiget_response(&resources))
}

/// Return properties for a single contact.
async fn contact_props(
    pool: &Pool<Postgres>,
    auth: &DavAuth,
    book_id: &str,
    contact_uid: &str,
) -> DavResponse {
    let book_uuid = match Uuid::parse_str(book_id) {
        Ok(u) => u,
        Err(_) => return DavResponse::not_found(),
    };

    let contact: Option<ContactRow> = match sqlx::query_as(
        r#"SELECT c.id, c.uid, COALESCE(c.etag, '') AS etag,
                  COALESCE(c.vcard_data, '') AS vcard_data
           FROM mailserver.contacts c
           JOIN mailserver.addressbooks a ON a.id = c.addressbook_id
           WHERE c.uid = $1 AND c.addressbook_id = $2 AND a.account_id = $3"#,
    )
    .bind(contact_uid)
    .bind(book_uuid)
    .bind(auth.account_id)
    .fetch_optional(pool)
    .await
    {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to fetch contact: {}", e);
            return DavResponse::new(500, format!("DB error: {e}"));
        },
    };

    match contact {
        Some(c) => {
            let resp = build_resource_response(
                &format!(
                    "/dav/addressbooks/{}/{}/{}.vcf",
                    auth.email, book_uuid, c.uid
                ),
                vec![
                    ("D:getetag".to_string(), format!("\"{}\"", c.etag)),
                    (
                        "D:getcontenttype".to_string(),
                        "text/vcard; charset=utf-8".to_string(),
                    ),
                ],
            );
            DavResponse::multistatus(build_multistatus(&[resp]))
        },
        None => DavResponse::not_found(),
    }
}

/// Handle GET -- return vCard data for a single contact.
async fn handle_get(pool: &Pool<Postgres>, auth: &DavAuth, segments: &[&str]) -> DavResponse {
    if segments.len() < 5 {
        return DavResponse::not_found();
    }

    let book_id = segments[3];
    let contact_file = segments[4];
    let contact_uid = contact_file.trim_end_matches(".vcf");

    let book_uuid = match Uuid::parse_str(book_id) {
        Ok(u) => u,
        Err(_) => return DavResponse::not_found(),
    };

    let row: Option<ContactRow> = match sqlx::query_as(
        r#"SELECT c.id, c.uid, COALESCE(c.etag, '') AS etag,
                  COALESCE(c.vcard_data, '') AS vcard_data
           FROM mailserver.contacts c
           JOIN mailserver.addressbooks a ON a.id = c.addressbook_id
           WHERE c.uid = $1 AND c.addressbook_id = $2 AND a.account_id = $3"#,
    )
    .bind(contact_uid)
    .bind(book_uuid)
    .bind(auth.account_id)
    .fetch_optional(pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("Failed to fetch contact for GET: {}", e);
            return DavResponse::new(500, format!("DB error: {e}"));
        },
    };

    match row {
        Some(contact) => DavResponse::with_headers(
            200,
            contact.vcard_data,
            vec![
                (
                    "Content-Type".to_string(),
                    "text/vcard; charset=utf-8".to_string(),
                ),
                ("ETag".to_string(), format!("\"{}\"", contact.etag)),
            ],
        ),
        None => DavResponse::not_found(),
    }
}

/// Handle PUT -- create or update a contact.
async fn handle_put(
    pool: &Pool<Postgres>,
    auth: &DavAuth,
    segments: &[&str],
    body: Option<&str>,
    _if_match: Option<&str>,
) -> DavResponse {
    if segments.len() < 5 {
        return DavResponse::new(400, "Invalid PUT path".to_string());
    }

    let book_id = segments[3];
    let contact_file = segments[4];
    let contact_uid = contact_file.trim_end_matches(".vcf");

    let book_uuid = match Uuid::parse_str(book_id) {
        Ok(u) => u,
        Err(_) => return DavResponse::new(400, "Invalid addressbook ID".to_string()),
    };

    let vcard_data = match body {
        Some(b) if !b.is_empty() => b,
        _ => return DavResponse::new(400, "Empty PUT body".to_string()),
    };

    // Parse vCard data
    let card = match VCard::parse(vcard_data) {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!("Invalid vCard data: {}", e);
            return DavResponse::new(400, format!("Invalid vCard: {e}"));
        },
    };

    // Verify addressbook ownership
    let book_exists: bool = match sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM mailserver.addressbooks WHERE id = $1 AND account_id = $2)",
    )
    .bind(book_uuid)
    .bind(auth.account_id)
    .fetch_one(pool)
    .await
    {
        Ok(exists) => exists,
        Err(e) => {
            tracing::error!("Addressbook ownership check failed: {}", e);
            return DavResponse::new(500, format!("DB error: {e}"));
        },
    };

    if !book_exists {
        return DavResponse::not_found();
    }

    let new_etag = Uuid::new_v4().to_string();

    let result = sqlx::query(
        r#"INSERT INTO mailserver.contacts
               (addressbook_id, uid, fn_name, emails, phones, org, vcard_data, etag)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (addressbook_id, uid) DO UPDATE SET
               fn_name = EXCLUDED.fn_name,
               emails = EXCLUDED.emails,
               phones = EXCLUDED.phones,
               org = EXCLUDED.org,
               vcard_data = EXCLUDED.vcard_data,
               etag = EXCLUDED.etag,
               updated_at = NOW()"#,
    )
    .bind(book_uuid)
    .bind(contact_uid)
    .bind(&card.fn_name)
    .bind(serde_json::to_value(&card.emails).unwrap_or_default())
    .bind(serde_json::to_value(&card.phones).unwrap_or_default())
    .bind(&card.org)
    .bind(vcard_data)
    .bind(&new_etag)
    .execute(pool)
    .await;

    if let Err(e) = result {
        tracing::error!("Failed to upsert contact: {}", e);
        return DavResponse::new(500, format!("DB error: {e}"));
    }

    // Update addressbook ctag
    let new_ctag = Uuid::new_v4().to_string();
    let _ = sqlx::query("UPDATE mailserver.addressbooks SET ctag = $1 WHERE id = $2")
        .bind(&new_ctag)
        .bind(book_uuid)
        .execute(pool)
        .await;

    tracing::info!(
        addressbook_id = %book_uuid,
        contact_uid = %contact_uid,
        "CardDAV contact upserted"
    );

    DavResponse::with_headers(
        201,
        String::new(),
        vec![("ETag".to_string(), format!("\"{}\"", new_etag))],
    )
}

/// Handle DELETE -- remove a contact.
async fn handle_delete(
    pool: &Pool<Postgres>,
    auth: &DavAuth,
    segments: &[&str],
    _if_match: Option<&str>,
) -> DavResponse {
    if segments.len() < 5 {
        return DavResponse::new(400, "Invalid DELETE path".to_string());
    }

    let book_id = segments[3];
    let contact_file = segments[4];
    let contact_uid = contact_file.trim_end_matches(".vcf");

    let book_uuid = match Uuid::parse_str(book_id) {
        Ok(u) => u,
        Err(_) => return DavResponse::not_found(),
    };

    let result = sqlx::query(
        r#"DELETE FROM mailserver.contacts
           WHERE uid = $1 AND addressbook_id = $2
             AND addressbook_id IN (
                 SELECT id FROM mailserver.addressbooks WHERE account_id = $3
             )"#,
    )
    .bind(contact_uid)
    .bind(book_uuid)
    .bind(auth.account_id)
    .execute(pool)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            let new_ctag = Uuid::new_v4().to_string();
            let _ = sqlx::query("UPDATE mailserver.addressbooks SET ctag = $1 WHERE id = $2")
                .bind(&new_ctag)
                .bind(book_uuid)
                .execute(pool)
                .await;

            tracing::info!(
                addressbook_id = %book_uuid,
                contact_uid = %contact_uid,
                "CardDAV contact deleted"
            );
            DavResponse::new(204, String::new())
        },
        Ok(_) => DavResponse::not_found(),
        Err(e) => {
            tracing::error!("Failed to delete contact: {}", e);
            DavResponse::new(500, format!("DB error: {e}"))
        },
    }
}

/// Handle REPORT -- addressbook-query and addressbook-multiget.
async fn handle_report(
    pool: &Pool<Postgres>,
    auth: &DavAuth,
    segments: &[&str],
    body: Option<&str>,
) -> DavResponse {
    let report_body = match body {
        Some(b) => b,
        None => return DavResponse::new(400, "REPORT requires a body".to_string()),
    };

    let report = match parse_report(report_body) {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!("Invalid REPORT body: {}", e);
            return DavResponse::new(400, format!("Invalid REPORT: {e}"));
        },
    };

    if segments.len() < 4 {
        return DavResponse::not_found();
    }

    let book_id = segments[3].trim_matches('/');
    let book_uuid = match Uuid::parse_str(book_id) {
        Ok(u) => u,
        Err(_) => return DavResponse::not_found(),
    };

    match report {
        ReportRequest::AddressbookQuery => {
            // Return all contacts (basic implementation)
            list_contacts(pool, auth, book_id).await
        },
        ReportRequest::AddressbookMultiget { hrefs } => {
            handle_addressbook_multiget(pool, auth, book_uuid, &hrefs).await
        },
        _ => DavResponse::new(400, "Unsupported REPORT type for CardDAV".to_string()),
    }
}

/// Handle addressbook-multiget REPORT: fetch specific contacts by href.
async fn handle_addressbook_multiget(
    pool: &Pool<Postgres>,
    auth: &DavAuth,
    book_uuid: Uuid,
    hrefs: &[String],
) -> DavResponse {
    let mut resources = Vec::new();

    for href in hrefs {
        let uid = href
            .rsplit('/')
            .next()
            .unwrap_or("")
            .trim_end_matches(".vcf");

        if uid.is_empty() {
            continue;
        }

        let contact: Option<ContactRow> = sqlx::query_as(
            r#"SELECT c.id, c.uid, COALESCE(c.etag, '') AS etag,
                      COALESCE(c.vcard_data, '') AS vcard_data
               FROM mailserver.contacts c
               JOIN mailserver.addressbooks a ON a.id = c.addressbook_id
               WHERE c.uid = $1 AND c.addressbook_id = $2 AND a.account_id = $3"#,
        )
        .bind(uid)
        .bind(book_uuid)
        .bind(auth.account_id)
        .fetch_optional(pool)
        .await
        .unwrap_or(None);

        if let Some(c) = contact {
            resources.push(ContactResource {
                href: href.clone(),
                etag: format!("\"{}\"", c.etag),
                address_data: c.vcard_data,
            });
        }
    }

    DavResponse::multistatus(build_addressbook_multiget_response(&resources))
}

/// Handle MKCOL -- create a new addressbook.
async fn handle_mkcol(pool: &Pool<Postgres>, auth: &DavAuth, segments: &[&str]) -> DavResponse {
    if segments.len() < 4 {
        return DavResponse::new(400, "Invalid MKCOL path".to_string());
    }

    let book_name = segments[3].trim_matches('/');
    let new_id = Uuid::new_v4();
    let ctag = Uuid::new_v4().to_string();

    let result = sqlx::query(
        r#"INSERT INTO mailserver.addressbooks
               (id, account_id, display_name, ctag)
           VALUES ($1, $2, $3, $4)"#,
    )
    .bind(new_id)
    .bind(auth.account_id)
    .bind(book_name)
    .bind(&ctag)
    .execute(pool)
    .await;

    match result {
        Ok(_) => {
            tracing::info!(
                addressbook_id = %new_id,
                name = %book_name,
                "CardDAV addressbook created via MKCOL"
            );
            DavResponse::new(201, String::new())
        },
        Err(e) => {
            tracing::error!("Failed to create addressbook: {}", e);
            DavResponse::new(500, format!("DB error: {e}"))
        },
    }
}
