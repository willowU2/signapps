// SE1-SE2: Endpoint security — AV status, disk encryption
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use signapps_db::DatabasePool;
use uuid::Uuid;

fn internal_err(e: impl std::fmt::Display) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}

// ─── SE1: AV/EDR status ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
/// Represents a report antivirus req.
pub struct ReportAntivirusReq {
    pub agent_id: Uuid,
    pub av_name: Option<String>,
    pub av_version: Option<String>,
    pub definitions_date: Option<NaiveDate>,
    pub last_scan: Option<DateTime<Utc>>,
    pub threats_found: Option<i32>,
    pub status: Option<String>, // "protected", "outdated", "disabled"
}

#[derive(Debug, Serialize, sqlx::FromRow)]
/// Represents a antivirus status row.
pub struct AntivirusStatusRow {
    pub id: Uuid,
    pub hardware_id: Uuid,
    pub av_name: Option<String>,
    pub av_version: Option<String>,
    pub definitions_date: Option<NaiveDate>,
    pub last_scan: Option<DateTime<Utc>>,
    pub threats_found: Option<i32>,
    pub status: Option<String>,
    pub reported_at: DateTime<Utc>,
}

pub async fn report_antivirus(
    State(pool): State<DatabasePool>,
    Json(payload): Json<ReportAntivirusReq>,
) -> Result<StatusCode, (StatusCode, String)> {
    let hw = sqlx::query!(
        "SELECT id FROM it.hardware WHERE agent_id = $1",
        payload.agent_id
    )
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "Agent not registered".to_string()))?;

    sqlx::query(
        r#"
        INSERT INTO it.antivirus_status (hardware_id, av_name, av_version, definitions_date, last_scan, threats_found, status, reported_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, now())
        ON CONFLICT (hardware_id) DO UPDATE SET
            av_name          = EXCLUDED.av_name,
            av_version       = EXCLUDED.av_version,
            definitions_date = EXCLUDED.definitions_date,
            last_scan        = EXCLUDED.last_scan,
            threats_found    = EXCLUDED.threats_found,
            status           = EXCLUDED.status,
            reported_at      = now()
        "#,
    )
    .bind(hw.id)
    .bind(&payload.av_name)
    .bind(&payload.av_version)
    .bind(payload.definitions_date)
    .bind(payload.last_scan)
    .bind(payload.threats_found.unwrap_or(0))
    .bind(payload.status.as_deref().unwrap_or("unknown"))
    .execute(pool.inner())
    .await
    .map_err(internal_err)?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_antivirus_status(
    State(pool): State<DatabasePool>,
    Path(hw_id): Path<Uuid>,
) -> Result<Json<AntivirusStatusRow>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, AntivirusStatusRow>(
        "SELECT id, hardware_id, av_name, av_version, definitions_date, last_scan, threats_found, status, reported_at FROM it.antivirus_status WHERE hardware_id = $1",
    )
    .bind(hw_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "No AV status for this machine".to_string()))?;
    Ok(Json(row))
}

// Fleet AV compliance summary
#[derive(Debug, Serialize)]
/// Represents a av fleet summary.
pub struct AvFleetSummary {
    pub total_machines: i64,
    pub protected: i64,
    pub outdated: i64,
    pub disabled: i64,
    pub unknown: i64,
}

pub async fn av_fleet_summary(
    State(pool): State<DatabasePool>,
) -> Result<Json<AvFleetSummary>, (StatusCode, String)> {
    let total: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM it.hardware")
        .fetch_one(pool.inner())
        .await
        .map_err(internal_err)?
        .unwrap_or(0);

    let rows = sqlx::query!(
        r#"
        SELECT COALESCE(status, 'unknown') as "status!", COUNT(*) as "count!"
        FROM it.antivirus_status
        GROUP BY status
        "#
    )
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;

    let mut protected = 0i64;
    let mut outdated = 0i64;
    let mut disabled = 0i64;
    let mut unknown = 0i64;

    for r in rows {
        match r.status.as_str() {
            "protected" => protected = r.count,
            "outdated" => outdated = r.count,
            "disabled" => disabled = r.count,
            _ => unknown += r.count,
        }
    }

    Ok(Json(AvFleetSummary {
        total_machines: total,
        protected,
        outdated,
        disabled,
        unknown,
    }))
}

// ─── SE2: Disk encryption status ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
/// Represents a report encryption req.
pub struct ReportEncryptionReq {
    pub agent_id: Uuid,
    pub drives: Vec<DriveEncryptionEntry>,
}

#[derive(Debug, Deserialize)]
/// Represents a drive encryption entry.
pub struct DriveEncryptionEntry {
    pub drive: String,
    pub encrypted: bool,
    pub method: Option<String>, // "BitLocker", "LUKS", "FileVault"
}

#[derive(Debug, Serialize, sqlx::FromRow)]
/// Represents a encryption status row.
pub struct EncryptionStatusRow {
    pub id: Uuid,
    pub hardware_id: Uuid,
    pub drive: String,
    pub encrypted: bool,
    pub method: Option<String>,
    pub reported_at: DateTime<Utc>,
}

pub async fn report_encryption(
    State(pool): State<DatabasePool>,
    Json(payload): Json<ReportEncryptionReq>,
) -> Result<StatusCode, (StatusCode, String)> {
    let hw = sqlx::query!(
        "SELECT id FROM it.hardware WHERE agent_id = $1",
        payload.agent_id
    )
    .fetch_optional(pool.inner())
    .await
    .map_err(internal_err)?
    .ok_or((StatusCode::NOT_FOUND, "Agent not registered".to_string()))?;

    let hardware_id = hw.id;

    // Delete old entries and reinsert
    sqlx::query("DELETE FROM it.encryption_status WHERE hardware_id = $1")
        .bind(hardware_id)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;

    for drive in payload.drives {
        sqlx::query(
            "INSERT INTO it.encryption_status (hardware_id, drive, encrypted, method) VALUES ($1, $2, $3, $4)",
        )
        .bind(hardware_id)
        .bind(&drive.drive)
        .bind(drive.encrypted)
        .bind(&drive.method)
        .execute(pool.inner())
        .await
        .map_err(internal_err)?;
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_encryption_status(
    State(pool): State<DatabasePool>,
    Path(hw_id): Path<Uuid>,
) -> Result<Json<Vec<EncryptionStatusRow>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, EncryptionStatusRow>(
        "SELECT id, hardware_id, drive, encrypted, method, reported_at FROM it.encryption_status WHERE hardware_id = $1 ORDER BY drive",
    )
    .bind(hw_id)
    .fetch_all(pool.inner())
    .await
    .map_err(internal_err)?;
    Ok(Json(rows))
}

// Fleet encryption compliance
#[derive(Debug, Serialize)]
/// Represents a encryption fleet summary.
pub struct EncryptionFleetSummary {
    pub total_machines: i64,
    pub fully_encrypted: i64,
    pub partially_encrypted: i64,
    pub not_encrypted: i64,
    pub compliance_pct: f64,
}

pub async fn encryption_fleet_summary(
    State(pool): State<DatabasePool>,
) -> Result<Json<EncryptionFleetSummary>, (StatusCode, String)> {
    let total: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM it.hardware")
        .fetch_one(pool.inner())
        .await
        .map_err(internal_err)?
        .unwrap_or(0);

    let fully: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(DISTINCT hardware_id)
        FROM it.encryption_status
        WHERE hardware_id NOT IN (
            SELECT DISTINCT hardware_id FROM it.encryption_status WHERE encrypted = false
        )
        "#
    )
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?
    .unwrap_or(0);

    let partially: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(DISTINCT hardware_id)
        FROM it.encryption_status
        WHERE hardware_id IN (
            SELECT DISTINCT hardware_id FROM it.encryption_status WHERE encrypted = true
        )
        AND hardware_id IN (
            SELECT DISTINCT hardware_id FROM it.encryption_status WHERE encrypted = false
        )
        "#
    )
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?
    .unwrap_or(0);

    let not_enc: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(DISTINCT hardware_id)
        FROM it.encryption_status
        WHERE hardware_id NOT IN (
            SELECT DISTINCT hardware_id FROM it.encryption_status WHERE encrypted = true
        )
        "#
    )
    .fetch_one(pool.inner())
    .await
    .map_err(internal_err)?
    .unwrap_or(0);

    let pct = if total > 0 {
        fully as f64 / total as f64 * 100.0
    } else {
        100.0
    };

    Ok(Json(EncryptionFleetSummary {
        total_machines: total,
        fully_encrypted: fully,
        partially_encrypted: partially,
        not_encrypted: not_enc,
        compliance_pct: pct,
    }))
}
