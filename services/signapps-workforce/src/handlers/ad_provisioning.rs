//! AD auto-provisioning handlers.
//!
//! Resolves person → assignment → domain and generates AD account attributes
//! (SAM, UPN, DN) then inserts into `ad_user_accounts`.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::AppState;
use signapps_common::{middleware::TenantContext, Claims};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Replace common accented characters with their ASCII equivalents.
fn ascii_fold(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'à' | 'â' | 'ä' | 'á' | 'ã' => 'a',
            'è' | 'ê' | 'ë' | 'é' => 'e',
            'ì' | 'î' | 'ï' | 'í' => 'i',
            'ò' | 'ô' | 'ö' | 'ó' | 'õ' => 'o',
            'ù' | 'û' | 'ü' | 'ú' => 'u',
            'ñ' => 'n',
            'ç' => 'c',
            'ý' | 'ÿ' => 'y',
            other => other,
        })
        .collect()
}

/// Generate a SAM account name: `first.last`, ASCII-folded, truncated to 20 chars.
fn make_sam(first: &str, last: &str) -> String {
    let raw = format!(
        "{}.{}",
        ascii_fold(&first.to_lowercase()),
        ascii_fold(&last.to_lowercase())
    );
    raw.chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '.')
        .take(20)
        .collect()
}

/// Generate a distinguished name for the account.
fn make_dn(first: &str, last: &str, ou_name: &str, fqdn: &str) -> String {
    let dc_parts: String = fqdn
        .split('.')
        .map(|part| format!("DC={}", part))
        .collect::<Vec<_>>()
        .join(",");
    format!("CN={} {},OU={},{}", first, last, ou_name, dc_parts)
}

/// Core provisioning logic: resolve person → node → domain → generate account attributes.
///
/// Returns `(sam, upn, dn, domain_id, ou_name)` or an error `StatusCode`.
async fn resolve_provision_data(
    pool: &signapps_db::DatabasePool,
    person_id: Uuid,
    tenant_id: Uuid,
) -> Result<(String, String, String, Uuid, String, String, String), StatusCode> {
    // 1. Load person
    let person: Option<(String, String)> = sqlx::query_as(
        "SELECT first_name, last_name FROM core.persons WHERE id = $1 AND tenant_id = $2 AND is_active = true LIMIT 1",
    )
    .bind(person_id)
    .bind(tenant_id)
    .fetch_optional(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error loading person");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let (first_name, last_name) = person.ok_or(StatusCode::NOT_FOUND)?;

    // 2. Resolve primary org node via assignment
    let node_row: Option<(Uuid,)> = sqlx::query_as(
        "SELECT node_id FROM core.assignments WHERE person_id = $1 AND is_primary = true AND end_date IS NULL LIMIT 1",
    )
    .bind(person_id)
    .fetch_optional(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error resolving assignment");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let node_id = node_row
        .map(|(id,)| id)
        .ok_or(StatusCode::UNPROCESSABLE_ENTITY)?;

    // 3. Walk org_closure ancestors to find a node linked to an AD domain
    let domain_row: Option<(Uuid, String, String, Option<String>)> = sqlx::query_as(
        r#"
        SELECT d.id, d.fqdn, n.name, n.ou_path
        FROM core.org_closure oc
        JOIN workforce_org_nodes n ON n.id = oc.ancestor_id
        JOIN ad_domains d ON d.org_node_id = oc.ancestor_id AND d.tenant_id = $2
        WHERE oc.descendant_id = $1
        ORDER BY oc.depth ASC
        LIMIT 1
        "#,
    )
    .bind(node_id)
    .bind(tenant_id)
    .fetch_optional(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error resolving domain via org_closure");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let (domain_id, fqdn, ou_name, _ou_path) =
        domain_row.ok_or(StatusCode::UNPROCESSABLE_ENTITY)?;

    let sam = make_sam(&first_name, &last_name);
    let upn = format!("{}@{}", sam, fqdn);
    let dn = make_dn(&first_name, &last_name, &ou_name, &fqdn);

    Ok((sam, upn, dn, domain_id, first_name, last_name, fqdn))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 1: provision_person
// ─────────────────────────────────────────────────────────────────────────────

/// Provision an AD account for a person.
///
/// Resolves person → primary assignment → domain (via org_closure), then generates
/// SAM/UPN/DN and inserts a row into `ad_user_accounts`. Returns `409` if an account
/// already exists for the person in that domain.
///
/// # Errors
///
/// - `404` if the person does not exist or is inactive.
/// - `409` if an AD account already exists.
/// - `422` if no primary assignment or linked AD domain can be resolved.
/// - `500` on database failure.
///
/// # Panics
///
/// No panics — all errors propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/ad/provision/{person_id}",
    params(("person_id" = Uuid, Path, description = "Person UUID to provision")),
    responses(
        (status = 201, description = "Account provisioned"),
        (status = 404, description = "Person not found"),
        (status = 409, description = "Account already exists"),
        (status = 422, description = "Cannot resolve domain"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "AD Provisioning"
)]
#[tracing::instrument(skip_all, fields(person_id = %person_id))]
pub async fn provision_person(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(person_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let pool = &state.pool;

    // Check for existing account
    let existing: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM ad_user_accounts WHERE person_id = $1 LIMIT 1")
            .bind(person_id)
            .fetch_optional(&**pool)
            .await
            .map_err(|e| {
                tracing::error!(?e, "DB error checking existing account");
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    if existing.is_some() {
        return Err(StatusCode::CONFLICT);
    }

    let (sam, upn, dn, domain_id, first_name, last_name, _fqdn) =
        resolve_provision_data(pool, person_id, ctx.tenant_id).await?;

    let display_name = format!("{} {}", first_name, last_name);
    let account_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO ad_user_accounts
            (id, domain_id, person_id, sam_account_name, user_principal_name,
             distinguished_name, display_name, sync_status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW(), NOW())
        "#,
    )
    .bind(account_id)
    .bind(domain_id)
    .bind(person_id)
    .bind(&sam)
    .bind(&upn)
    .bind(&dn)
    .bind(&display_name)
    .execute(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error inserting ad_user_account");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!(
        account_id = %account_id,
        sam = %sam,
        upn = %upn,
        "AD account provisioned"
    );

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "id": account_id,
            "person_id": person_id,
            "domain_id": domain_id,
            "sam_account_name": sam,
            "user_principal_name": upn,
            "distinguished_name": dn,
            "display_name": display_name,
            "sync_status": "pending"
        })),
    ))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 2: preview_provision
// ─────────────────────────────────────────────────────────────────────────────

/// Preview what an AD account would look like for a person, without inserting.
///
/// # Errors
///
/// - `404` if the person does not exist or is inactive.
/// - `422` if no primary assignment or linked AD domain can be resolved.
/// - `500` on database failure.
///
/// # Panics
///
/// No panics — all errors propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/ad/provision/{person_id}/preview",
    params(("person_id" = Uuid, Path, description = "Person UUID to preview")),
    responses(
        (status = 200, description = "Provisioning preview"),
        (status = 404, description = "Person not found"),
        (status = 422, description = "Cannot resolve domain"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "AD Provisioning"
)]
#[tracing::instrument(skip_all, fields(person_id = %person_id))]
pub async fn preview_provision(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(person_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let pool = &state.pool;

    let (sam, upn, dn, domain_id, first_name, last_name, _fqdn) =
        resolve_provision_data(pool, person_id, ctx.tenant_id).await?;

    let has_account: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM ad_user_accounts WHERE person_id = $1 LIMIT 1")
            .bind(person_id)
            .fetch_optional(&**pool)
            .await
            .map_err(|e| {
                tracing::error!(?e, "DB error checking existing account");
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    Ok(Json(json!({
        "person_id": person_id,
        "domain_id": domain_id,
        "sam_account_name": sam,
        "user_principal_name": upn,
        "distinguished_name": dn,
        "display_name": format!("{} {}", first_name, last_name),
        "already_provisioned": has_account.is_some(),
    })))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler 3: bulk_provision
// ─────────────────────────────────────────────────────────────────────────────

/// Bulk-provision AD accounts for all employees that do not yet have one.
///
/// Iterates over active persons with a primary assignment and no existing AD account,
/// and provisions each. Returns a summary `{provisioned, skipped, errors}`.
///
/// # Errors
///
/// Returns `500` if the initial query fails.
///
/// # Panics
///
/// No panics — all errors propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/ad/provision/bulk",
    responses(
        (status = 200, description = "Bulk provisioning result"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "AD Provisioning"
)]
#[tracing::instrument(skip_all)]
pub async fn bulk_provision(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let pool = &state.pool;

    // Find employees without an AD account
    let candidates: Vec<(Uuid,)> = sqlx::query_as(
        r#"
        SELECT DISTINCT p.id
        FROM core.persons p
        JOIN core.assignments a ON a.person_id = p.id AND a.is_primary = true AND a.end_date IS NULL
        WHERE p.tenant_id = $1
          AND p.is_active = true
          AND NOT EXISTS (
              SELECT 1 FROM ad_user_accounts au WHERE au.person_id = p.id
          )
        "#,
    )
    .bind(ctx.tenant_id)
    .fetch_all(&**pool)
    .await
    .map_err(|e| {
        tracing::error!(?e, "DB error fetching provisioning candidates");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let total = candidates.len();
    let mut provisioned = 0usize;
    let mut skipped = 0usize;
    let mut errors: Vec<serde_json::Value> = Vec::new();

    for (person_id,) in candidates {
        match resolve_provision_data(pool, person_id, ctx.tenant_id).await {
            Err(_) => {
                skipped += 1;
            },
            Ok((sam, upn, dn, domain_id, first_name, last_name, _fqdn)) => {
                let display_name = format!("{} {}", first_name, last_name);
                let account_id = Uuid::new_v4();
                let result = sqlx::query(
                    r#"
                    INSERT INTO ad_user_accounts
                        (id, domain_id, person_id, sam_account_name, user_principal_name,
                         distinguished_name, display_name, sync_status, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW(), NOW())
                    "#,
                )
                .bind(account_id)
                .bind(domain_id)
                .bind(person_id)
                .bind(&sam)
                .bind(&upn)
                .bind(&dn)
                .bind(&display_name)
                .execute(&**pool)
                .await;

                match result {
                    Ok(_) => provisioned += 1,
                    Err(e) => {
                        tracing::warn!(?e, %person_id, "Failed to provision account");
                        errors.push(json!({ "person_id": person_id, "error": e.to_string() }));
                    },
                }
            },
        }
    }

    tracing::info!(
        total,
        provisioned,
        skipped,
        error_count = errors.len(),
        "Bulk AD provisioning complete"
    );

    Ok(Json(json!({
        "total": total,
        "provisioned": provisioned,
        "skipped": skipped,
        "errors": errors
    })))
}
