//! Canonical `org_sites` table — SO7 sites physiques.
//!
//! Un **site** matérialise un lieu physique rattaché à un tenant. La
//! hiérarchie est modélisée par `parent_id` (self-reference) selon les
//! kinds canoniques :
//!
//! - [`SiteKind::Building`] : immeuble (Paris HQ, Lyon annexe).
//! - [`SiteKind::Floor`]    : étage d'un building.
//! - [`SiteKind::Room`]     : salle / bureau fermé / open space.
//! - [`SiteKind::Desk`]     : bureau individuel (hot-desk ou assigné).
//!
//! L'adresse + GPS sont stockés au niveau `building` uniquement. Les
//! attributs riches (capacity, equipment JSONB, bookable) s'appliquent
//! au niveau `room` / `desk`.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Variante hiérarchique d'un site.
///
/// Stored as lowercase `VARCHAR(16)` (`building`, `floor`, `room`, `desk`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum SiteKind {
    /// Immeuble (racine d'une hiérarchie).
    Building,
    /// Étage d'un building.
    Floor,
    /// Salle, bureau fermé, open space.
    Room,
    /// Bureau individuel nommé (hot-desk ou assigné).
    Desk,
}

impl SiteKind {
    /// Parse a snake_case string into [`SiteKind`].
    ///
    /// # Errors
    ///
    /// Returns an `Err` for any unrecognized variant.
    pub fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "building" => Ok(Self::Building),
            "floor" => Ok(Self::Floor),
            "room" => Ok(Self::Room),
            "desk" => Ok(Self::Desk),
            other => Err(format!("unknown site kind: {other}")),
        }
    }

    /// Snake-case representation (DB column value).
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Building => "building",
            Self::Floor => "floor",
            Self::Room => "room",
            Self::Desk => "desk",
        }
    }
}

/// Rôle d'une personne sur un site.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum SitePersonRole {
    /// Site principal (un seul par personne).
    Primary,
    /// Site secondaire (N par personne).
    Secondary,
}

impl SitePersonRole {
    /// Parse a snake_case string.
    ///
    /// # Errors
    ///
    /// Returns `Err` for any unrecognized variant.
    pub fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "primary" => Ok(Self::Primary),
            "secondary" => Ok(Self::Secondary),
            other => Err(format!("unknown site person role: {other}")),
        }
    }
}

/// Status d'un booking.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum BookingStatus {
    /// Réservation confirmée — bloque le créneau.
    Confirmed,
    /// Réservation provisoire — n'empêche pas les conflits confirmés.
    Tentative,
    /// Réservation annulée — créneau libéré.
    Cancelled,
}

impl BookingStatus {
    /// Parse a snake_case string.
    ///
    /// # Errors
    ///
    /// Returns `Err` for any unrecognized variant.
    pub fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "confirmed" => Ok(Self::Confirmed),
            "tentative" => Ok(Self::Tentative),
            "cancelled" => Ok(Self::Cancelled),
            other => Err(format!("unknown booking status: {other}")),
        }
    }

    /// Snake-case representation.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Confirmed => "confirmed",
            Self::Tentative => "tentative",
            Self::Cancelled => "cancelled",
        }
    }
}

/// One `org_sites` row.
///
/// # Examples
///
/// ```ignore
/// let site = OrgSite {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     parent_id: None,
///     slug: "paris-hq".into(),
///     name: "Paris HQ".into(),
///     kind: SiteKind::Building,
///     address: Some("18 rue de la Paix".into()),
///     gps: Some(serde_json::json!({"lat": 48.869, "lng": 2.331})),
///     timezone: Some("Europe/Paris".into()),
///     capacity: None,
///     equipment: serde_json::json!({}),
///     bookable: false,
///     active: true,
///     attributes: serde_json::json!({}),
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
pub struct OrgSite {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Parent immédiat (NULL pour un building).
    pub parent_id: Option<Uuid>,
    /// Slug unique au sein du tenant.
    pub slug: String,
    /// Libellé affiché.
    pub name: String,
    /// Variante (building | floor | room | desk).
    pub kind: SiteKind,
    /// Adresse (building seulement).
    pub address: Option<String>,
    /// Coordonnées GPS `{lat, lng}` (building seulement).
    pub gps: Option<serde_json::Value>,
    /// Timezone IANA (héritée logiquement depuis le building).
    pub timezone: Option<String>,
    /// Capacité max (room seulement).
    pub capacity: Option<i32>,
    /// Équipements (`{screen, videoconf, whiteboard, kitchen, …}`).
    pub equipment: serde_json::Value,
    /// `true` si la salle accepte les bookings.
    pub bookable: bool,
    /// `false` = archivé.
    pub active: bool,
    /// Métadonnées extensibles.
    pub attributes: serde_json::Value,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
    /// Date de dernière modification (UTC).
    pub updated_at: DateTime<Utc>,
}

/// One `org_site_persons` row.
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct SitePerson {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Personne.
    pub person_id: Uuid,
    /// Site (building / floor / room).
    pub site_id: Uuid,
    /// Desk assigné (NULL = hot-desk / pas de poste assigné).
    pub desk_id: Option<Uuid>,
    /// primary | secondary.
    pub role: SitePersonRole,
    /// Début de validité.
    pub valid_from: chrono::NaiveDate,
    /// Fin optionnelle.
    pub valid_until: Option<chrono::NaiveDate>,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
}

/// One `org_site_bookings` row.
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct SiteBooking {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Site réservé (typiquement room ou desk).
    pub site_id: Uuid,
    /// Personne qui réserve.
    pub person_id: Uuid,
    /// Début du créneau (UTC).
    pub start_at: DateTime<Utc>,
    /// Fin du créneau (UTC).
    pub end_at: DateTime<Utc>,
    /// Objet / motif.
    pub purpose: Option<String>,
    /// Status (confirmed | tentative | cancelled).
    pub status: BookingStatus,
    /// Lien optionnel vers `meet.rooms` si `link_meet = true`.
    pub meet_room_id: Option<Uuid>,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
    /// Date de dernière modification (UTC).
    pub updated_at: DateTime<Utc>,
}
