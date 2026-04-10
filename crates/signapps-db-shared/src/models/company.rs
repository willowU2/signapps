//! Company models for the `core` schema and login context models for `identity`.
//!
//! Covers `core.companies`, `core.person_companies`, and `identity.login_contexts`.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

// ============================================================================
// Company
// ============================================================================

/// A company record in `core.companies`.
///
/// Represents internal organisations, clients, suppliers, and partners.
///
/// # Examples
///
/// ```rust,ignore
/// let company = Company { name: "Acme".into(), company_type: "client".into(), ..Default::default() };
/// ```
///
/// # Errors
///
/// Repository methods return `Error::Database` on constraint violations.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Company {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Tenant that owns this company.
    pub tenant_id: Uuid,
    /// Display name.
    pub name: String,
    /// Company category: `internal`, `client`, `supplier`, `partner`.
    pub company_type: String,
    /// Official legal name.
    pub legal_name: Option<String>,
    /// French SIREN number (9 digits).
    pub siren: Option<String>,
    /// French SIRET number (14 digits).
    pub siret: Option<String>,
    /// VAT / TVA number.
    pub vat_number: Option<String>,
    /// Generic registration number for non-French entities.
    pub registration_number: Option<String>,
    /// First line of address.
    pub address_line1: Option<String>,
    /// Second line of address.
    pub address_line2: Option<String>,
    /// City.
    pub city: Option<String>,
    /// Postal code.
    pub postal_code: Option<String>,
    /// ISO 3166-1 alpha-2 country code (default `FR`).
    pub country: Option<String>,
    /// Company website URL.
    pub website: Option<String>,
    /// Logo image URL.
    pub logo_url: Option<String>,
    /// Industry / sector.
    pub industry: Option<String>,
    /// Headcount range (e.g. `"1-10"`, `"51-200"`).
    pub employee_count_range: Option<String>,
    /// Annual revenue range (e.g. `"<1M"`, `"10M-50M"`).
    pub annual_revenue_range: Option<String>,
    /// Default billing currency (ISO 4217, default `EUR`).
    pub default_currency: Option<String>,
    /// Whether the company is active.
    pub is_active: bool,
    /// Arbitrary metadata (JSON).
    pub metadata: serde_json::Value,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last-updated timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Request payload to create a new company.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateCompany {
    /// Display name.
    pub name: String,
    /// Company category: `internal`, `client`, `supplier`, `partner`.
    pub company_type: String,
    /// Official legal name.
    pub legal_name: Option<String>,
    /// SIREN number.
    pub siren: Option<String>,
    /// SIRET number.
    pub siret: Option<String>,
    /// VAT number.
    pub vat_number: Option<String>,
    /// Generic registration number.
    pub registration_number: Option<String>,
    /// Address line 1.
    pub address_line1: Option<String>,
    /// Address line 2.
    pub address_line2: Option<String>,
    /// City.
    pub city: Option<String>,
    /// Postal code.
    pub postal_code: Option<String>,
    /// Country code.
    pub country: Option<String>,
    /// Website URL.
    pub website: Option<String>,
    /// Logo URL.
    pub logo_url: Option<String>,
    /// Industry.
    pub industry: Option<String>,
    /// Headcount range.
    pub employee_count_range: Option<String>,
    /// Revenue range.
    pub annual_revenue_range: Option<String>,
    /// Default currency.
    pub default_currency: Option<String>,
    /// Arbitrary metadata.
    pub metadata: Option<serde_json::Value>,
}

/// Request payload to update an existing company.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateCompany {
    /// Display name.
    pub name: Option<String>,
    /// Company category.
    pub company_type: Option<String>,
    /// Legal name.
    pub legal_name: Option<String>,
    /// SIREN.
    pub siren: Option<String>,
    /// SIRET.
    pub siret: Option<String>,
    /// VAT number.
    pub vat_number: Option<String>,
    /// Registration number.
    pub registration_number: Option<String>,
    /// Address line 1.
    pub address_line1: Option<String>,
    /// Address line 2.
    pub address_line2: Option<String>,
    /// City.
    pub city: Option<String>,
    /// Postal code.
    pub postal_code: Option<String>,
    /// Country code.
    pub country: Option<String>,
    /// Website.
    pub website: Option<String>,
    /// Logo URL.
    pub logo_url: Option<String>,
    /// Industry.
    pub industry: Option<String>,
    /// Headcount range.
    pub employee_count_range: Option<String>,
    /// Revenue range.
    pub annual_revenue_range: Option<String>,
    /// Default currency.
    pub default_currency: Option<String>,
    /// Active flag.
    pub is_active: Option<bool>,
    /// Metadata.
    pub metadata: Option<serde_json::Value>,
}

// ============================================================================
// PersonCompany
// ============================================================================

/// An affiliation record in `core.person_companies` (N:N between persons and companies).
///
/// # Errors
///
/// Repository methods return `Error::Database` on constraint violations.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct PersonCompany {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Person associated with this affiliation.
    pub person_id: Uuid,
    /// Company associated with this affiliation.
    pub company_id: Uuid,
    /// Role: `employee`, `client_contact`, `supplier_contact`, `partner`, `board_member`, `freelancer`.
    pub role_in_company: String,
    /// Job title within this company.
    pub job_title: Option<String>,
    /// Department.
    pub department: Option<String>,
    /// Whether this is the primary affiliation.
    pub is_primary: bool,
    /// Start date of the affiliation.
    pub start_date: Option<NaiveDate>,
    /// End date of the affiliation (None = still active).
    pub end_date: Option<NaiveDate>,
    /// Whether the person has portal access for this company.
    pub portal_access: bool,
    /// Modules accessible via the portal.
    pub portal_modules: Vec<String>,
    /// Arbitrary metadata (JSON).
    pub metadata: serde_json::Value,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last-updated timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Request payload to create a person-company affiliation.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreatePersonCompany {
    /// Person to affiliate.
    pub person_id: Uuid,
    /// Company to affiliate with.
    pub company_id: Uuid,
    /// Role in the company.
    pub role_in_company: String,
    /// Job title.
    pub job_title: Option<String>,
    /// Department.
    pub department: Option<String>,
    /// Primary affiliation flag.
    pub is_primary: Option<bool>,
    /// Start date.
    pub start_date: Option<NaiveDate>,
    /// End date.
    pub end_date: Option<NaiveDate>,
    /// Portal access flag.
    pub portal_access: Option<bool>,
    /// Portal modules list.
    pub portal_modules: Option<Vec<String>>,
    /// Arbitrary metadata.
    pub metadata: Option<serde_json::Value>,
}

// ============================================================================
// LoginContext
// ============================================================================

/// A login context record in `identity.login_contexts`.
///
/// Maps a user to a specific person-company affiliation, enabling
/// multi-context login (employee view, client portal, supplier portal …).
///
/// # Errors
///
/// Repository methods return `Error::Database` on constraint violations.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct LoginContext {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// User this context belongs to.
    pub user_id: Uuid,
    /// Underlying person-company affiliation.
    pub person_company_id: Uuid,
    /// Context type: `employee`, `client`, `supplier`, `partner`.
    pub context_type: String,
    /// Company for this context.
    pub company_id: Uuid,
    /// Human-readable label shown in the context picker.
    pub label: String,
    /// Optional icon identifier.
    pub icon: Option<String>,
    /// Optional theme colour.
    pub color: Option<String>,
    /// Whether this context is active.
    pub is_active: bool,
    /// Last time this context was selected.
    pub last_used_at: Option<DateTime<Utc>>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}

/// Enriched login context for frontend display.
///
/// Returned by the context-picker endpoint; includes denormalised company
/// data so the UI does not need a separate company fetch.
///
/// # Errors
///
/// Repository methods return `Error::Database` on query failures.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct LoginContextDisplay {
    /// Login context id.
    pub id: Uuid,
    /// User this context belongs to.
    pub user_id: Uuid,
    /// Underlying person-company affiliation id.
    pub person_company_id: Uuid,
    /// Context type: `employee`, `client`, `supplier`, `partner`.
    pub context_type: String,
    /// Company id.
    pub company_id: Uuid,
    /// Human-readable label.
    pub label: String,
    /// Optional icon identifier.
    pub icon: Option<String>,
    /// Optional theme colour.
    pub color: Option<String>,
    /// Whether this context is active.
    pub is_active: bool,
    /// Last time this context was selected.
    pub last_used_at: Option<DateTime<Utc>>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Denormalised company name.
    pub company_name: String,
    /// Denormalised company logo URL.
    pub company_logo: Option<String>,
    /// Role in the company (from `person_companies`).
    pub role_in_company: String,
    /// Job title (from `person_companies`).
    pub job_title: Option<String>,
}
