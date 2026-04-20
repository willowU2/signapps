//! Canonical `org_resources` table — SO8 catalogue de ressources tangibles.
//!
//! Une **ressource** matérialise un asset physique (ou logique) géré par
//! le tenant : IT device, véhicule, clé, badge, équipement AV, licence
//! logicielle, mobilier de valeur, …
//!
//! Deux tables :
//!
//! - [`Resource`]           : modèle canonique (1 row = 1 ressource).
//! - [`ResourceStatusLog`]  : historique append-only des transitions
//!   d'état (state machine définie dans `signapps-org`).
//!
//! # Design choices
//!
//! - `kind` = taxonomie fermée (9 valeurs) stockée en `VARCHAR(32)`,
//!   convertie via `sqlx::Type` + rename `snake_case`.
//! - `status` idem (6 valeurs).
//! - `attributes` = JSONB libre par kind (serial/model pour IT, plaque
//!   pour véhicule, numéro badge, …).
//! - `assigned_to_person_id` et `assigned_to_node_id` sont mutuellement
//!   exclusifs (CHECK au niveau DB).
//! - `qr_token` = hex 16 chars généré via HMAC-SHA256(keystore_dek,
//!   resource.id) — 64 bits d'entropie, non-guessable.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Taxonomie fermée des ressources gérées.
///
/// Stored as lowercase `VARCHAR(32)` (`it_device`, `vehicle`, …).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "VARCHAR", rename_all = "snake_case")]
pub enum ResourceKind {
    /// Laptop, desktop, écran, station de travail.
    ItDevice,
    /// Voiture, utilitaire, moto — ressource routière.
    Vehicle,
    /// Clé physique (bureau, salle, coffre, véhicule).
    KeyPhysical,
    /// Badge d'accès (nominatif ou visiteur).
    Badge,
    /// Équipement audio-vidéo (projecteur, caméra, micro, écran portable).
    AvEquipment,
    /// Mobilier de valeur (bureau haut de gamme, fauteuil, œuvre d'art).
    Furniture,
    /// Téléphone mobile professionnel (flotte managée).
    MobilePhone,
    /// Licence logiciel (seat, abonnement SaaS enterprise).
    LicenseSoftware,
    /// Autre — fallback pour assets non classifiables.
    Other,
}

impl ResourceKind {
    /// Parse a snake_case string into [`ResourceKind`].
    ///
    /// # Errors
    ///
    /// Returns an `Err` for any unrecognized variant.
    pub fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "it_device" => Ok(Self::ItDevice),
            "vehicle" => Ok(Self::Vehicle),
            "key_physical" => Ok(Self::KeyPhysical),
            "badge" => Ok(Self::Badge),
            "av_equipment" => Ok(Self::AvEquipment),
            "furniture" => Ok(Self::Furniture),
            "mobile_phone" => Ok(Self::MobilePhone),
            "license_software" => Ok(Self::LicenseSoftware),
            "other" => Ok(Self::Other),
            other => Err(format!("unknown resource kind: {other}")),
        }
    }

    /// Snake-case representation (DB column value).
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ItDevice => "it_device",
            Self::Vehicle => "vehicle",
            Self::KeyPhysical => "key_physical",
            Self::Badge => "badge",
            Self::AvEquipment => "av_equipment",
            Self::Furniture => "furniture",
            Self::MobilePhone => "mobile_phone",
            Self::LicenseSoftware => "license_software",
            Self::Other => "other",
        }
    }
}

/// Cycle de vie d'une ressource.
///
/// Stored as lowercase `VARCHAR(20)` (`ordered`, `active`, `loaned`, …).
///
/// Transitions valides (state machine) :
///
/// ```text
///   ordered ─┬─▶ active
///            └─▶ retired
///
///   active ──┬─▶ loaned
///            ├─▶ in_maintenance
///            └─▶ retired
///
///   loaned ──┬─▶ active
///            └─▶ retired
///
///   in_maintenance ─┬─▶ active
///                   └─▶ retired
///
///   returned ─┬─▶ active
///             └─▶ retired
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "VARCHAR", rename_all = "snake_case")]
pub enum ResourceStatus {
    /// Commandée, pas encore reçue.
    Ordered,
    /// En service, utilisable.
    Active,
    /// Prêtée temporairement à un externe.
    Loaned,
    /// En maintenance / réparation.
    InMaintenance,
    /// Rendue par le porteur (en attente de réaffectation).
    Returned,
    /// Mise hors service définitivement.
    Retired,
}

impl ResourceStatus {
    /// Parse a snake_case string into [`ResourceStatus`].
    ///
    /// # Errors
    ///
    /// Returns an `Err` for any unrecognized variant.
    pub fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "ordered" => Ok(Self::Ordered),
            "active" => Ok(Self::Active),
            "loaned" => Ok(Self::Loaned),
            "in_maintenance" => Ok(Self::InMaintenance),
            "returned" => Ok(Self::Returned),
            "retired" => Ok(Self::Retired),
            other => Err(format!("unknown resource status: {other}")),
        }
    }

    /// Snake-case representation (DB column value).
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ordered => "ordered",
            Self::Active => "active",
            Self::Loaned => "loaned",
            Self::InMaintenance => "in_maintenance",
            Self::Returned => "returned",
            Self::Retired => "retired",
        }
    }

    /// Return `true` if a transition `self → to` is allowed by the state
    /// machine.
    ///
    /// Used by the handler to refuse invalid transitions with a 400
    /// before persisting anything.
    #[must_use]
    pub fn can_transition_to(self, to: Self) -> bool {
        use ResourceStatus::{Active, InMaintenance, Loaned, Ordered, Retired, Returned};
        matches!(
            (self, to),
            (Ordered, Active)
                | (Ordered, Retired)
                | (Active, Loaned)
                | (Active, InMaintenance)
                | (Active, Retired)
                | (Active, Returned)
                | (Loaned, Active)
                | (Loaned, Retired)
                | (Loaned, Returned)
                | (InMaintenance, Active)
                | (InMaintenance, Retired)
                | (Returned, Active)
                | (Returned, Retired)
        )
    }
}

/// One `org_resources` row.
///
/// # Examples
///
/// ```ignore
/// let r = Resource {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     kind: ResourceKind::Vehicle,
///     slug: "car-paris-01".into(),
///     name: "Tesla Model Y".into(),
///     description: None,
///     serial_or_ref: Some("VIN-XYZ".into()),
///     attributes: serde_json::json!({"plate": "AB-123-CD"}),
///     status: ResourceStatus::Active,
///     assigned_to_person_id: None,
///     assigned_to_node_id: None,
///     primary_site_id: None,
///     purchase_date: None,
///     purchase_cost_cents: Some(5_000_000),
///     currency: Some("EUR".into()),
///     amortization_months: Some(48),
///     warranty_end_date: None,
///     next_maintenance_date: None,
///     qr_token: None,
///     archived: false,
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
pub struct Resource {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Variante (it_device | vehicle | …).
    pub kind: ResourceKind,
    /// Slug unique au sein du tenant.
    pub slug: String,
    /// Libellé affiché à l'utilisateur.
    pub name: String,
    /// Description libre (markdown).
    pub description: Option<String>,
    /// Numéro de série / référence (pour laptops, véhicules, …).
    pub serial_or_ref: Option<String>,
    /// Attributs spécifiques par kind (JSONB libre).
    pub attributes: serde_json::Value,
    /// État du cycle de vie.
    pub status: ResourceStatus,
    /// Personne assignée (mutuellement exclusif avec `assigned_to_node_id`).
    pub assigned_to_person_id: Option<Uuid>,
    /// Node assigné (mutuellement exclusif avec `assigned_to_person_id`).
    pub assigned_to_node_id: Option<Uuid>,
    /// Site physique de base (building / floor / room).
    pub primary_site_id: Option<Uuid>,
    /// Date d'achat.
    pub purchase_date: Option<NaiveDate>,
    /// Coût d'achat en centimes (pour éviter les problèmes de floating point).
    pub purchase_cost_cents: Option<i64>,
    /// Devise (ISO 4217, défaut EUR).
    pub currency: Option<String>,
    /// Durée d'amortissement en mois.
    pub amortization_months: Option<i32>,
    /// Fin de garantie.
    pub warranty_end_date: Option<NaiveDate>,
    /// Prochaine maintenance prévue (déclenche alerte visuelle si < 30j).
    pub next_maintenance_date: Option<NaiveDate>,
    /// Token hex 16 chars pour QR code public (unique global).
    pub qr_token: Option<String>,
    /// `true` = soft-deleted.
    pub archived: bool,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
    /// Date de dernière modification (UTC).
    pub updated_at: DateTime<Utc>,
}

impl Resource {
    /// Compute the depreciated value at `as_of` assuming linear
    /// amortization from `purchase_date` over `amortization_months`.
    ///
    /// Returns `None` if any of the required fields is missing. The
    /// result is clamped to 0 (no negative depreciation).
    ///
    /// # Examples
    ///
    /// ```ignore
    /// // 100 000 cents, 10 months amortization, 5 months elapsed → 50 000.
    /// let now = chrono::Utc::now().date_naive();
    /// let res = Resource { /* purchase_date = now - 5 months, cost 100_000, amort 10 */ };
    /// assert_eq!(res.depreciated_value_cents(now), Some(50_000));
    /// ```
    #[must_use]
    pub fn depreciated_value_cents(&self, as_of: NaiveDate) -> Option<i64> {
        let cost = self.purchase_cost_cents?;
        let start = self.purchase_date?;
        let months_total = self.amortization_months?;
        if months_total <= 0 {
            return Some(cost);
        }
        // Approximate months elapsed (days / 30).
        let days_elapsed = (as_of - start).num_days();
        if days_elapsed <= 0 {
            return Some(cost);
        }
        let months_elapsed = (days_elapsed as f64) / 30.4375_f64;
        let ratio = (months_elapsed / f64::from(months_total)).clamp(0.0, 1.0);
        #[allow(clippy::cast_possible_truncation, clippy::cast_precision_loss)]
        let remaining = (cost as f64 * (1.0 - ratio)) as i64;
        Some(remaining.max(0))
    }
}

/// One `org_resource_status_log` row — append-only history.
///
/// Each transition (including creation) inserts one row. The `from_status`
/// is `None` for the initial insertion.
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ResourceStatusLog {
    /// Identifiant séquentiel.
    pub id: i64,
    /// Ressource concernée.
    pub resource_id: Uuid,
    /// État d'origine (NULL à la création).
    pub from_status: Option<ResourceStatus>,
    /// État cible.
    pub to_status: ResourceStatus,
    /// Utilisateur qui a déclenché la transition.
    pub actor_user_id: Option<Uuid>,
    /// Motif / commentaire optionnel.
    pub reason: Option<String>,
    /// Date de la transition (UTC).
    pub at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resource_kind_roundtrip() {
        for k in [
            ResourceKind::ItDevice,
            ResourceKind::Vehicle,
            ResourceKind::KeyPhysical,
            ResourceKind::Badge,
            ResourceKind::AvEquipment,
            ResourceKind::Furniture,
            ResourceKind::MobilePhone,
            ResourceKind::LicenseSoftware,
            ResourceKind::Other,
        ] {
            assert_eq!(ResourceKind::parse(k.as_str()).unwrap(), k);
        }
    }

    #[test]
    fn resource_kind_rejects_unknown() {
        assert!(ResourceKind::parse("blargh").is_err());
    }

    #[test]
    fn resource_status_roundtrip() {
        for s in [
            ResourceStatus::Ordered,
            ResourceStatus::Active,
            ResourceStatus::Loaned,
            ResourceStatus::InMaintenance,
            ResourceStatus::Returned,
            ResourceStatus::Retired,
        ] {
            assert_eq!(ResourceStatus::parse(s.as_str()).unwrap(), s);
        }
    }

    #[test]
    fn state_machine_ordered_only_to_active_or_retired() {
        assert!(ResourceStatus::Ordered.can_transition_to(ResourceStatus::Active));
        assert!(ResourceStatus::Ordered.can_transition_to(ResourceStatus::Retired));
        assert!(!ResourceStatus::Ordered.can_transition_to(ResourceStatus::Loaned));
        assert!(!ResourceStatus::Ordered.can_transition_to(ResourceStatus::InMaintenance));
        assert!(!ResourceStatus::Ordered.can_transition_to(ResourceStatus::Returned));
    }

    #[test]
    fn state_machine_active_transitions() {
        assert!(ResourceStatus::Active.can_transition_to(ResourceStatus::Loaned));
        assert!(ResourceStatus::Active.can_transition_to(ResourceStatus::InMaintenance));
        assert!(ResourceStatus::Active.can_transition_to(ResourceStatus::Retired));
        assert!(ResourceStatus::Active.can_transition_to(ResourceStatus::Returned));
        assert!(!ResourceStatus::Active.can_transition_to(ResourceStatus::Ordered));
    }

    #[test]
    fn state_machine_retired_is_terminal() {
        for target in [
            ResourceStatus::Ordered,
            ResourceStatus::Active,
            ResourceStatus::Loaned,
            ResourceStatus::InMaintenance,
            ResourceStatus::Returned,
        ] {
            assert!(!ResourceStatus::Retired.can_transition_to(target));
        }
    }

    #[test]
    fn depreciated_value_linear_decay() {
        use chrono::NaiveDate;
        let mut res = stub_resource();
        res.purchase_cost_cents = Some(100_000);
        res.amortization_months = Some(10);
        res.purchase_date = NaiveDate::from_ymd_opt(2025, 1, 1);
        // 5 months later → ~50% remaining.
        let as_of = NaiveDate::from_ymd_opt(2025, 6, 1).unwrap();
        let v = res.depreciated_value_cents(as_of).unwrap();
        assert!(v > 40_000 && v < 60_000, "got {v}");
    }

    #[test]
    fn depreciated_value_past_amortization_is_zero() {
        use chrono::NaiveDate;
        let mut res = stub_resource();
        res.purchase_cost_cents = Some(100_000);
        res.amortization_months = Some(10);
        res.purchase_date = NaiveDate::from_ymd_opt(2020, 1, 1);
        let as_of = NaiveDate::from_ymd_opt(2025, 1, 1).unwrap();
        assert_eq!(res.depreciated_value_cents(as_of), Some(0));
    }

    fn stub_resource() -> Resource {
        Resource {
            id: Uuid::nil(),
            tenant_id: Uuid::nil(),
            kind: ResourceKind::ItDevice,
            slug: "test".into(),
            name: "Test".into(),
            description: None,
            serial_or_ref: None,
            attributes: serde_json::json!({}),
            status: ResourceStatus::Active,
            assigned_to_person_id: None,
            assigned_to_node_id: None,
            primary_site_id: None,
            purchase_date: None,
            purchase_cost_cents: None,
            currency: None,
            amortization_months: None,
            warranty_end_date: None,
            next_maintenance_date: None,
            qr_token: None,
            archived: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }
}
