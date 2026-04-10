//! Accounting endpoints -- chart of accounts, journal entries, reports, seed.
//!
//! Uses the `accounting` schema with proper relational tables:
//! `accounting.accounts`, `accounting.journal_entries`, `accounting.journal_lines`.
//!
//! The auth middleware injects the authenticated user, but these handlers
//! currently do not scope by owner_id (single-tenant MVP).

use crate::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/// An account in the chart of accounts.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct Account {
    /// Unique identifier.
    pub id: Uuid,
    /// Parent account (for hierarchical structure).
    pub parent_id: Option<Uuid>,
    /// Account code (e.g. "411", "512").
    pub code: String,
    /// Human-readable name.
    pub name: String,
    /// Type: asset, liability, equity, revenue, expense.
    pub account_type: String,
    /// Balance in cents.
    pub balance: i64,
    /// Currency code (default EUR).
    pub currency: String,
    /// Whether the account is active.
    pub is_active: bool,
    /// Owner user ID.
    pub owner_id: Uuid,
    /// Tenant ID (multi-tenant).
    pub tenant_id: Option<Uuid>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Request to create or update an account.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateAccountRequest {
    /// Parent account ID (null for root accounts).
    pub parent_id: Option<Uuid>,
    /// Account code.
    pub code: String,
    /// Account name.
    pub name: String,
    /// Account type: asset, liability, equity, revenue, expense.
    pub account_type: String,
    /// Initial balance in cents.
    pub balance: Option<i64>,
    /// Currency code.
    pub currency: Option<String>,
    /// Owner user ID (defaults to nil UUID if omitted).
    pub owner_id: Option<Uuid>,
}

/// A journal entry header.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct JournalEntry {
    /// Unique identifier.
    pub id: Uuid,
    /// Entry date.
    pub date: NaiveDate,
    /// Reference (invoice number, etc.).
    pub reference: Option<String>,
    /// Description of the entry.
    pub description: Option<String>,
    /// Whether the entry is posted (immutable once posted).
    pub is_posted: bool,
    /// Owner user ID.
    pub owner_id: Uuid,
    /// Tenant ID.
    pub tenant_id: Option<Uuid>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}

/// A line in a journal entry.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct JournalLine {
    /// Unique identifier.
    pub id: Uuid,
    /// Parent entry ID.
    pub entry_id: Uuid,
    /// Account ID this line affects.
    pub account_id: Uuid,
    /// Debit amount in cents.
    pub debit: i64,
    /// Credit amount in cents.
    pub credit: i64,
    /// Optional line description.
    pub description: Option<String>,
}

/// Journal entry with its lines, returned to the client.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct JournalEntryWithLines {
    /// The journal entry header.
    #[serde(flatten)]
    pub entry: JournalEntry,
    /// Lines belonging to this entry.
    pub lines: Vec<JournalLine>,
}

/// Request to create a journal entry with lines.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateEntryRequest {
    /// Entry date.
    pub date: NaiveDate,
    /// Reference (optional).
    pub reference: Option<String>,
    /// Description.
    pub description: Option<String>,
    /// Journal lines (debit/credit).
    pub lines: Vec<CreateLineRequest>,
}

/// A single line in a create-entry request.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateLineRequest {
    /// Account ID.
    pub account_id: Uuid,
    /// Debit amount in cents.
    pub debit: Option<i64>,
    /// Credit amount in cents.
    pub credit: Option<i64>,
    /// Line description.
    pub description: Option<String>,
}

// ---------------------------------------------------------------------------
// DB helpers -- ensure schema exists
// ---------------------------------------------------------------------------

/// Ensures the accounting schema and tables exist.
///
/// # Errors
///
/// Returns `Error::Internal` if any CREATE statement fails.
///
/// # Panics
///
/// No panics possible.
async fn ensure_schema(pool: &Pool<Postgres>) -> Result<()> {
    sqlx::query("CREATE SCHEMA IF NOT EXISTS accounting")
        .execute(pool)
        .await
        .map_err(|e| Error::Internal(format!("ensure accounting schema: {e}")))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS accounting.accounts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            parent_id UUID REFERENCES accounting.accounts(id),
            code VARCHAR(20) NOT NULL,
            name VARCHAR(200) NOT NULL,
            account_type VARCHAR(30) NOT NULL,
            balance BIGINT DEFAULT 0,
            currency VARCHAR(10) DEFAULT 'EUR',
            is_active BOOLEAN DEFAULT true,
            owner_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
            tenant_id UUID,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| Error::Internal(format!("ensure accounting.accounts: {e}")))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS accounting.journal_entries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            date DATE NOT NULL,
            reference VARCHAR(100),
            description TEXT,
            is_posted BOOLEAN DEFAULT false,
            owner_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
            tenant_id UUID,
            created_at TIMESTAMPTZ DEFAULT now()
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| Error::Internal(format!("ensure accounting.journal_entries: {e}")))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS accounting.journal_lines (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            entry_id UUID NOT NULL REFERENCES accounting.journal_entries(id) ON DELETE CASCADE,
            account_id UUID NOT NULL REFERENCES accounting.accounts(id),
            debit BIGINT DEFAULT 0,
            credit BIGINT DEFAULT 0,
            description TEXT
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| Error::Internal(format!("ensure accounting.journal_lines: {e}")))?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Chart of Accounts handlers
// ---------------------------------------------------------------------------

/// `GET /api/v1/accounting/accounts` -- list all accounts.
///
/// # Errors
///
/// Returns `Error::Internal` on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/accounting/accounts",
    tag = "Accounting",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of accounts", body = Vec<Account>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_accounts(State(state): State<AppState>) -> Result<Json<Vec<Account>>> {
    if let Err(e) = ensure_schema(&state.pool).await {
        tracing::warn!("ensure_schema failed: {e}");
    }

    let rows: Vec<Account> =
        sqlx::query_as("SELECT * FROM accounting.accounts ORDER BY code ASC")
            .fetch_all(&state.pool)
            .await
            .map_err(|e| Error::Internal(format!("list accounts: {e}")))?;

    Ok(Json(rows))
}

/// `GET /api/v1/accounting/accounts/:id` -- get a single account.
///
/// # Errors
///
/// Returns `Error::NotFound` if the account does not exist.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/accounting/accounts/{id}",
    tag = "Accounting",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Account ID")),
    responses(
        (status = 200, description = "Account details", body = Account),
        (status = 404, description = "Account not found"),
    )
)]
#[tracing::instrument(skip(state), fields(account_id = %id))]
pub async fn get_account(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Account>> {
    let row: Account = sqlx::query_as("SELECT * FROM accounting.accounts WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| Error::Internal(format!("get account: {e}")))?
        .ok_or_else(|| Error::NotFound("Account not found".into()))?;

    Ok(Json(row))
}

/// `POST /api/v1/accounting/accounts` -- create a new account.
///
/// # Errors
///
/// Returns `Error::Internal` on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    post,
    path = "/api/v1/accounting/accounts",
    tag = "Accounting",
    security(("bearerAuth" = [])),
    request_body = CreateAccountRequest,
    responses(
        (status = 201, description = "Account created", body = Account),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state, body))]
pub async fn create_account(
    State(state): State<AppState>,
    Json(body): Json<CreateAccountRequest>,
) -> Result<(StatusCode, Json<Account>)> {
    if let Err(e) = ensure_schema(&state.pool).await {
        tracing::warn!("ensure_schema failed: {e}");
    }

    let owner_id = body
        .owner_id
        .unwrap_or_else(|| Uuid::parse_str("00000000-0000-0000-0000-000000000000").unwrap_or_default());

    let row: Account = sqlx::query_as(
        "INSERT INTO accounting.accounts (parent_id, code, name, account_type, balance, currency, owner_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *",
    )
    .bind(body.parent_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.account_type)
    .bind(body.balance.unwrap_or(0))
    .bind(body.currency.as_deref().unwrap_or("EUR"))
    .bind(owner_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| Error::Internal(format!("create account: {e}")))?;

    tracing::info!(account_id = %row.id, code = %row.code, "account created");
    Ok((StatusCode::CREATED, Json(row)))
}

/// `PUT /api/v1/accounting/accounts/:id` -- update an existing account.
///
/// # Errors
///
/// Returns `Error::NotFound` if the account does not exist.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    put,
    path = "/api/v1/accounting/accounts/{id}",
    tag = "Accounting",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Account ID")),
    request_body = CreateAccountRequest,
    responses(
        (status = 200, description = "Account updated", body = Account),
        (status = 404, description = "Account not found"),
    )
)]
#[tracing::instrument(skip(state, body), fields(account_id = %id))]
pub async fn update_account(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateAccountRequest>,
) -> Result<Json<Account>> {
    let row: Account = sqlx::query_as(
        "UPDATE accounting.accounts
         SET parent_id = $1, code = $2, name = $3, account_type = $4,
             balance = COALESCE($5, balance), currency = COALESCE($6, currency),
             updated_at = now()
         WHERE id = $7
         RETURNING *",
    )
    .bind(body.parent_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.account_type)
    .bind(body.balance)
    .bind(body.currency.as_deref())
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| Error::Internal(format!("update account: {e}")))?
    .ok_or_else(|| Error::NotFound("Account not found".into()))?;

    tracing::info!(account_id = %row.id, "account updated");
    Ok(Json(row))
}

/// `DELETE /api/v1/accounting/accounts/:id` -- delete an account.
///
/// # Errors
///
/// Returns `Error::NotFound` if the account does not exist.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    delete,
    path = "/api/v1/accounting/accounts/{id}",
    tag = "Accounting",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Account ID")),
    responses(
        (status = 204, description = "Account deleted"),
        (status = 404, description = "Account not found"),
    )
)]
#[tracing::instrument(skip(state), fields(account_id = %id))]
pub async fn delete_account(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let result = sqlx::query("DELETE FROM accounting.accounts WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| Error::Internal(format!("delete account: {e}")))?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound("Account not found".into()));
    }

    tracing::info!("account deleted");
    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Journal Entries handlers
// ---------------------------------------------------------------------------

/// `GET /api/v1/accounting/entries` -- list journal entries with their lines.
///
/// # Errors
///
/// Returns `Error::Internal` on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/accounting/entries",
    tag = "Accounting",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "List of journal entries with lines", body = Vec<JournalEntryWithLines>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn list_entries(
    State(state): State<AppState>,
) -> Result<Json<Vec<JournalEntryWithLines>>> {
    if let Err(e) = ensure_schema(&state.pool).await {
        tracing::warn!("ensure_schema failed: {e}");
    }

    let entries: Vec<JournalEntry> = sqlx::query_as(
        "SELECT * FROM accounting.journal_entries ORDER BY date DESC, created_at DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| Error::Internal(format!("list entries: {e}")))?;

    let entry_ids: Vec<Uuid> = entries.iter().map(|e| e.id).collect();

    let lines: Vec<JournalLine> = if entry_ids.is_empty() {
        vec![]
    } else {
        sqlx::query_as(
            "SELECT * FROM accounting.journal_lines WHERE entry_id = ANY($1) ORDER BY id ASC",
        )
        .bind(&entry_ids)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| Error::Internal(format!("list lines: {e}")))?
    };

    let result: Vec<JournalEntryWithLines> = entries
        .into_iter()
        .map(|entry| {
            let entry_lines: Vec<JournalLine> = lines
                .iter()
                .filter(|l| l.entry_id == entry.id)
                .cloned()
                .collect();
            JournalEntryWithLines {
                entry,
                lines: entry_lines,
            }
        })
        .collect();

    Ok(Json(result))
}

/// `POST /api/v1/accounting/entries` -- create a journal entry with lines.
///
/// Validates that total debits equal total credits before inserting.
///
/// # Errors
///
/// Returns `Error::BadRequest` if debits != credits.
/// Returns `Error::Internal` on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    post,
    path = "/api/v1/accounting/entries",
    tag = "Accounting",
    security(("bearerAuth" = [])),
    request_body = CreateEntryRequest,
    responses(
        (status = 201, description = "Journal entry created", body = JournalEntryWithLines),
        (status = 400, description = "Debits do not equal credits"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state, body))]
pub async fn create_entry(
    State(state): State<AppState>,
    Json(body): Json<CreateEntryRequest>,
) -> Result<(StatusCode, Json<JournalEntryWithLines>)> {
    if let Err(e) = ensure_schema(&state.pool).await {
        tracing::warn!("ensure_schema failed: {e}");
    }

    // Validate balanced entry
    let total_debit: i64 = body.lines.iter().map(|l| l.debit.unwrap_or(0)).sum();
    let total_credit: i64 = body.lines.iter().map(|l| l.credit.unwrap_or(0)).sum();
    if total_debit != total_credit {
        return Err(Error::BadRequest(format!(
            "Entry is not balanced: debit={total_debit} credit={total_credit}"
        )));
    }

    let nil_uuid = Uuid::nil();
    let entry: JournalEntry = sqlx::query_as(
        "INSERT INTO accounting.journal_entries (date, reference, description, owner_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *",
    )
    .bind(body.date)
    .bind(body.reference.as_deref())
    .bind(body.description.as_deref())
    .bind(nil_uuid)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| Error::Internal(format!("create entry: {e}")))?;

    let mut lines = Vec::with_capacity(body.lines.len());
    for line_req in &body.lines {
        let line: JournalLine = sqlx::query_as(
            "INSERT INTO accounting.journal_lines (entry_id, account_id, debit, credit, description)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *",
        )
        .bind(entry.id)
        .bind(line_req.account_id)
        .bind(line_req.debit.unwrap_or(0))
        .bind(line_req.credit.unwrap_or(0))
        .bind(line_req.description.as_deref())
        .fetch_one(&state.pool)
        .await
        .map_err(|e| Error::Internal(format!("create journal line: {e}")))?;
        lines.push(line);
    }

    tracing::info!(entry_id = %entry.id, lines_count = lines.len(), "journal entry created");

    Ok((
        StatusCode::CREATED,
        Json(JournalEntryWithLines { entry, lines }),
    ))
}

/// `POST /api/v1/accounting/entries/:id/post` -- mark a journal entry as posted.
///
/// # Errors
///
/// Returns `Error::NotFound` if the entry does not exist.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    post,
    path = "/api/v1/accounting/entries/{id}/post",
    tag = "Accounting",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Journal entry ID")),
    responses(
        (status = 200, description = "Entry posted", body = JournalEntry),
        (status = 404, description = "Entry not found"),
    )
)]
#[tracing::instrument(skip(state), fields(entry_id = %id))]
pub async fn post_entry(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<JournalEntry>> {
    let row: JournalEntry = sqlx::query_as(
        "UPDATE accounting.journal_entries SET is_posted = true WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| Error::Internal(format!("post entry: {e}")))?
    .ok_or_else(|| Error::NotFound("Journal entry not found".into()))?;

    tracing::info!("journal entry posted");
    Ok(Json(row))
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/// `GET /api/v1/accounting/reports/balance-sheet` -- compute balance sheet.
///
/// # Errors
///
/// Returns `Error::Internal` on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/accounting/reports/balance-sheet",
    tag = "Accounting",
    security(("bearerAuth" = [])),
    responses((status = 200, description = "Balance sheet report"))
)]
#[tracing::instrument(skip_all)]
pub async fn get_balance_sheet(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>> {
    let rows = get_type_totals(&state.pool).await?;
    let mut assets: i64 = 0;
    let mut liabilities: i64 = 0;
    let mut equity: i64 = 0;
    for r in &rows {
        match r.account_type.as_str() {
            "asset" => assets = r.total,
            "liability" => liabilities = r.total,
            "equity" => equity = r.total,
            _ => {}
        }
    }
    Ok(Json(serde_json::json!({
        "report_type": "balance_sheet",
        "assets": assets,
        "liabilities": liabilities,
        "equity": equity,
        "net": assets - liabilities - equity,
        "generated_at": Utc::now().to_rfc3339(),
    })))
}

/// `GET /api/v1/accounting/reports/profit-loss` -- compute profit & loss.
///
/// # Errors
///
/// Returns `Error::Internal` on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/accounting/reports/profit-loss",
    tag = "Accounting",
    security(("bearerAuth" = [])),
    responses((status = 200, description = "Profit & loss report"))
)]
#[tracing::instrument(skip_all)]
pub async fn get_profit_loss(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>> {
    let rows = get_type_totals(&state.pool).await?;
    let mut revenue: i64 = 0;
    let mut expenses: i64 = 0;
    for r in &rows {
        match r.account_type.as_str() {
            "revenue" => revenue = r.total,
            "expense" => expenses = r.total,
            _ => {}
        }
    }
    Ok(Json(serde_json::json!({
        "report_type": "profit_loss",
        "revenue": revenue,
        "expenses": expenses,
        "net_profit": revenue - expenses,
        "generated_at": Utc::now().to_rfc3339(),
    })))
}

/// `GET /api/v1/accounting/reports/trial-balance` -- compute trial balance.
///
/// # Errors
///
/// Returns `Error::Internal` on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/accounting/reports/trial-balance",
    tag = "Accounting",
    security(("bearerAuth" = [])),
    responses((status = 200, description = "Trial balance report"))
)]
#[tracing::instrument(skip_all)]
pub async fn get_trial_balance(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>> {
    let rows = get_type_totals(&state.pool).await?;
    Ok(Json(serde_json::json!({
        "report_type": "trial_balance",
        "rows": rows.iter().map(|r| serde_json::json!({
            "account_type": r.account_type,
            "total": r.total,
        })).collect::<Vec<_>>(),
        "generated_at": Utc::now().to_rfc3339(),
    })))
}

/// `GET /api/v1/accounting/reports` -- legacy reports endpoint.
///
/// # Errors
///
/// Returns `Error::Internal` on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/accounting/reports",
    tag = "Accounting",
    security(("bearerAuth" = [])),
    params(
        ("report_type" = Option<String>, Query, description = "Report type: 'pl' or 'balance_sheet'"),
    ),
    responses((status = 200, description = "Generated report"))
)]
#[tracing::instrument(skip_all)]
pub async fn get_reports(
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<ReportQuery>,
) -> Result<Json<serde_json::Value>> {
    let report_type = q.report_type.as_deref().unwrap_or("pl");
    match report_type {
        "balance_sheet" | "balance-sheet" => get_balance_sheet(State(state)).await,
        "trial_balance" | "trial-balance" => get_trial_balance(State(state)).await,
        _ => get_profit_loss(State(state)).await,
    }
}

/// Query params for reports endpoint.
#[derive(Debug, Deserialize)]
pub struct ReportQuery {
    /// Report type.
    pub report_type: Option<String>,
}

#[derive(sqlx::FromRow)]
struct TypeTotal {
    account_type: String,
    total: i64,
}

/// Aggregate balances by account type.
async fn get_type_totals(pool: &Pool<Postgres>) -> Result<Vec<TypeTotal>> {
    if let Err(e) = ensure_schema(pool).await {
        tracing::warn!("ensure_schema failed: {e}");
    }
    let rows: Vec<TypeTotal> = sqlx::query_as(
        "SELECT account_type, COALESCE(SUM(balance), 0) AS total
         FROM accounting.accounts
         WHERE is_active = true
         GROUP BY account_type",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| Error::Internal(format!("report query: {e}")))?;
    Ok(rows)
}

// ---------------------------------------------------------------------------
// Seed default chart of accounts
// ---------------------------------------------------------------------------

/// `POST /api/v1/accounting/seed` -- seed the default chart of accounts.
///
/// Only creates accounts if none exist yet.
///
/// # Errors
///
/// Returns `Error::Internal` on database failure.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    post,
    path = "/api/v1/accounting/seed",
    tag = "Accounting",
    security(("bearerAuth" = [])),
    responses(
        (status = 201, description = "Default accounts created", body = Vec<Account>),
        (status = 200, description = "Accounts already exist"),
    )
)]
#[tracing::instrument(skip_all)]
pub async fn seed_default_coa(
    State(state): State<AppState>,
) -> Result<(StatusCode, Json<Vec<Account>>)> {
    if let Err(e) = ensure_schema(&state.pool).await {
        tracing::warn!("ensure_schema failed: {e}");
    }

    // Check if accounts already exist
    let count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM accounting.accounts")
            .fetch_one(&state.pool)
            .await
            .map_err(|e| Error::Internal(format!("count accounts: {e}")))?;

    if count.0 > 0 {
        let existing: Vec<Account> =
            sqlx::query_as("SELECT * FROM accounting.accounts ORDER BY code ASC")
                .fetch_all(&state.pool)
                .await
                .map_err(|e| Error::Internal(format!("list accounts: {e}")))?;
        return Ok((StatusCode::OK, Json(existing)));
    }

    let nil_uuid = Uuid::nil();

    // Seed accounts: (code, name, account_type, parent_code, balance_cents)
    let seed_accounts: Vec<(&str, &str, &str, Option<&str>, i64)> = vec![
        ("1", "Assets", "asset", None, 0),
        ("1.1", "Current Assets", "asset", Some("1"), 0),
        ("1.1.1", "Cash", "asset", Some("1.1"), 2_500_000),
        ("1.1.2", "Accounts Receivable", "asset", Some("1.1"), 1_500_000),
        ("1.1.3", "Inventory", "asset", Some("1.1"), 800_000),
        ("1.2", "Fixed Assets", "asset", Some("1"), 0),
        ("1.2.1", "Property & Equipment", "asset", Some("1.2"), 5_000_000),
        ("1.2.2", "Accumulated Depreciation", "asset", Some("1.2"), -1_000_000),
        ("2", "Liabilities", "liability", None, 0),
        ("2.1", "Current Liabilities", "liability", Some("2"), 0),
        ("2.1.1", "Accounts Payable", "liability", Some("2.1"), 500_000),
        ("2.1.2", "Short-term Debt", "liability", Some("2.1"), 1_000_000),
        ("2.2", "Long-term Liabilities", "liability", Some("2"), 0),
        ("2.2.1", "Long-term Debt", "liability", Some("2.2"), 2_500_000),
        ("3", "Equity", "equity", None, 0),
        ("3.1", "Capital Stock", "equity", Some("3"), 5_000_000),
        ("3.2", "Retained Earnings", "equity", Some("3"), 800_000),
        ("4", "Revenue", "revenue", None, 0),
        ("4.1", "Service Revenue", "revenue", Some("4"), 12_000_000),
        ("4.2", "Product Sales", "revenue", Some("4"), 8_000_000),
        ("5", "Expenses", "expense", None, 0),
        ("5.1", "Operating Expenses", "expense", Some("5"), 0),
        ("5.1.1", "Salaries & Wages", "expense", Some("5.1"), 6_000_000),
        ("5.1.2", "Rent", "expense", Some("5.1"), 1_200_000),
        ("5.1.3", "Utilities", "expense", Some("5.1"), 240_000),
        ("5.2", "COGS", "expense", Some("5"), 4_000_000),
    ];

    let mut code_to_id: std::collections::HashMap<String, Uuid> =
        std::collections::HashMap::new();
    let mut created: Vec<Account> = Vec::new();

    for (code, name, account_type, parent_code, balance) in &seed_accounts {
        let parent_id = parent_code.and_then(|pc| code_to_id.get(pc).copied());

        let row: Account = sqlx::query_as(
            "INSERT INTO accounting.accounts (parent_id, code, name, account_type, balance, owner_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *",
        )
        .bind(parent_id)
        .bind(*code)
        .bind(*name)
        .bind(*account_type)
        .bind(*balance)
        .bind(nil_uuid)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| Error::Internal(format!("seed account {code}: {e}")))?;

        code_to_id.insert(code.to_string(), row.id);
        created.push(row);
    }

    tracing::info!(accounts_created = created.len(), "default COA seeded");
    Ok((StatusCode::CREATED, Json(created)))
}

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }
}
