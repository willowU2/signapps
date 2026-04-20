//! Canonical `org_resource_renewals` table — SO9 cycle de renouvellement.
//!
//! Suit les échéances récurrentes (garanties, licences, contrôles
//! techniques, validités badges, etc.). Un cron
//! (`signapps-scheduler::resource_renewals_daily`) tick toutes les 24 h
//! et publie des events PgEventBus `org.resource.renewal.due.{j60, j30,
//! j7, overdue}` selon la proximité de `due_date`.
//!
//! States :
//! - `pending`   : en attente, hors fenêtre de rappel J-60
//! - `snoozed`   : reporté jusqu'à `snoozed_until`
//! - `renewed`   : clos avec `renewed_at` + `renewed_by_user_id`
//! - `escalated` : passé J-0 + grace → email escalade
//! - `cancelled` : pas pertinent (resource retirée)

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Type de renouvellement.
///
/// Stored as lowercase `VARCHAR(32)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "VARCHAR", rename_all = "snake_case")]
pub enum RenewalKind {
    /// Fin de garantie constructeur/vendeur.
    WarrantyEnd,
    /// Expiration licence logicielle.
    LicenseExpiry,
    /// Validité badge d'accès.
    BadgeValidity,
    /// Expiration assurance.
    InsuranceExpiry,
    /// Contrôle technique véhicule.
    TechnicalInspection,
    /// Maintenance périodique due.
    MaintenanceDue,
    /// Remplacement batterie (véhicule électrique, UPS, ...).
    BatteryReplacement,
    /// Rotation clés (sécurité physique).
    KeyRotation,
    /// Autre — fallback pour cas spécifiques.
    Custom,
}

impl RenewalKind {
    /// Parse a snake_case string.
    ///
    /// # Errors
    ///
    /// Returns `Err` for unknown variants.
    pub fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "warranty_end" => Ok(Self::WarrantyEnd),
            "license_expiry" => Ok(Self::LicenseExpiry),
            "badge_validity" => Ok(Self::BadgeValidity),
            "insurance_expiry" => Ok(Self::InsuranceExpiry),
            "technical_inspection" => Ok(Self::TechnicalInspection),
            "maintenance_due" => Ok(Self::MaintenanceDue),
            "battery_replacement" => Ok(Self::BatteryReplacement),
            "key_rotation" => Ok(Self::KeyRotation),
            "custom" => Ok(Self::Custom),
            other => Err(format!("unknown renewal kind: {other}")),
        }
    }

    /// Snake-case DB value.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::WarrantyEnd => "warranty_end",
            Self::LicenseExpiry => "license_expiry",
            Self::BadgeValidity => "badge_validity",
            Self::InsuranceExpiry => "insurance_expiry",
            Self::TechnicalInspection => "technical_inspection",
            Self::MaintenanceDue => "maintenance_due",
            Self::BatteryReplacement => "battery_replacement",
            Self::KeyRotation => "key_rotation",
            Self::Custom => "custom",
        }
    }
}

/// Statut d'un renouvellement.
///
/// Stored as lowercase `VARCHAR(16)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "VARCHAR", rename_all = "snake_case")]
pub enum RenewalStatus {
    /// En attente — pas encore déclenché.
    Pending,
    /// Reporté jusqu'à `snoozed_until`.
    Snoozed,
    /// Clos — renouvellement effectué.
    Renewed,
    /// Passé J-0 + grace — notification d'escalade envoyée.
    Escalated,
    /// Annulé (resource retirée ou n'en a plus besoin).
    Cancelled,
}

impl RenewalStatus {
    /// Parse a snake_case string.
    ///
    /// # Errors
    ///
    /// Returns `Err` for unknown variants.
    pub fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "pending" => Ok(Self::Pending),
            "snoozed" => Ok(Self::Snoozed),
            "renewed" => Ok(Self::Renewed),
            "escalated" => Ok(Self::Escalated),
            "cancelled" => Ok(Self::Cancelled),
            other => Err(format!("unknown renewal status: {other}")),
        }
    }

    /// Snake-case DB value.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Snoozed => "snoozed",
            Self::Renewed => "renewed",
            Self::Escalated => "escalated",
            Self::Cancelled => "cancelled",
        }
    }

    /// Is this status considered "open" (needs a follow-up)?
    #[must_use]
    pub fn is_open(self) -> bool {
        matches!(self, Self::Pending | Self::Snoozed | Self::Escalated)
    }
}

/// One `org_resource_renewals` row.
///
/// # Examples
///
/// ```ignore
/// let r = ResourceRenewal {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     resource_id: uuid::Uuid::new_v4(),
///     kind: RenewalKind::WarrantyEnd,
///     due_date: chrono::NaiveDate::from_ymd_opt(2027, 12, 31).unwrap(),
///     grace_period_days: 0,
///     status: RenewalStatus::Pending,
///     last_reminded_at: None,
///     snoozed_until: None,
///     renewed_at: None,
///     renewed_by_user_id: None,
///     renewal_notes: None,
///     created_at: chrono::Utc::now(),
///     updated_at: chrono::Utc::now(),
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ResourceRenewal {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Ressource concernée.
    pub resource_id: Uuid,
    /// Type de renouvellement.
    pub kind: RenewalKind,
    /// Date d'échéance.
    pub due_date: NaiveDate,
    /// Jours de grâce après `due_date` avant escalade.
    pub grace_period_days: i32,
    /// Statut courant.
    pub status: RenewalStatus,
    /// Dernière relance envoyée (UTC).
    pub last_reminded_at: Option<DateTime<Utc>>,
    /// Date jusqu'à laquelle le renouvellement est reporté.
    pub snoozed_until: Option<NaiveDate>,
    /// Date effective du renouvellement (status = renewed).
    pub renewed_at: Option<DateTime<Utc>>,
    /// User ayant effectué le renouvellement.
    pub renewed_by_user_id: Option<Uuid>,
    /// Notes libres saisies lors du renouvellement.
    pub renewal_notes: Option<String>,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
    /// Date de dernière modification (UTC).
    pub updated_at: DateTime<Utc>,
}

impl ResourceRenewal {
    /// Days remaining until `due_date` relative to `today` (can be negative).
    #[must_use]
    pub fn days_to_due(&self, today: NaiveDate) -> i64 {
        (self.due_date - today).num_days()
    }

    /// Is this renewal overdue (past due + grace)?
    #[must_use]
    pub fn is_overdue(&self, today: NaiveDate) -> bool {
        let grace = i64::from(self.grace_period_days);
        self.days_to_due(today) + grace < 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kind_roundtrip() {
        for k in [
            RenewalKind::WarrantyEnd,
            RenewalKind::LicenseExpiry,
            RenewalKind::BadgeValidity,
            RenewalKind::InsuranceExpiry,
            RenewalKind::TechnicalInspection,
            RenewalKind::MaintenanceDue,
            RenewalKind::BatteryReplacement,
            RenewalKind::KeyRotation,
            RenewalKind::Custom,
        ] {
            assert_eq!(RenewalKind::parse(k.as_str()).unwrap(), k);
        }
    }

    #[test]
    fn status_roundtrip() {
        for s in [
            RenewalStatus::Pending,
            RenewalStatus::Snoozed,
            RenewalStatus::Renewed,
            RenewalStatus::Escalated,
            RenewalStatus::Cancelled,
        ] {
            assert_eq!(RenewalStatus::parse(s.as_str()).unwrap(), s);
        }
    }

    #[test]
    fn is_open() {
        assert!(RenewalStatus::Pending.is_open());
        assert!(RenewalStatus::Snoozed.is_open());
        assert!(RenewalStatus::Escalated.is_open());
        assert!(!RenewalStatus::Renewed.is_open());
        assert!(!RenewalStatus::Cancelled.is_open());
    }

    fn stub() -> ResourceRenewal {
        ResourceRenewal {
            id: Uuid::nil(),
            tenant_id: Uuid::nil(),
            resource_id: Uuid::nil(),
            kind: RenewalKind::WarrantyEnd,
            due_date: NaiveDate::from_ymd_opt(2027, 12, 31).unwrap(),
            grace_period_days: 0,
            status: RenewalStatus::Pending,
            last_reminded_at: None,
            snoozed_until: None,
            renewed_at: None,
            renewed_by_user_id: None,
            renewal_notes: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn days_to_due_positive_future() {
        let mut r = stub();
        r.due_date = NaiveDate::from_ymd_opt(2027, 12, 31).unwrap();
        let today = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
        assert!(r.days_to_due(today) > 0);
    }

    #[test]
    fn is_overdue_respects_grace() {
        let mut r = stub();
        r.due_date = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
        r.grace_period_days = 10;
        // 9 days after due — still within grace.
        let within = NaiveDate::from_ymd_opt(2026, 1, 10).unwrap();
        assert!(!r.is_overdue(within));
        // 11 days after — past grace.
        let past = NaiveDate::from_ymd_opt(2026, 1, 12).unwrap();
        assert!(r.is_overdue(past));
    }
}
