//! Portal context utilities.

use crate::Claims;

/// Check if the current user is an internal employee.
///
/// Returns `true` for employees (explicit `employee` context) and for users
/// without a `context_type` claim (legacy tokens issued before portal support).
///
/// # Examples
///
/// ```rust,ignore
/// if is_employee(&claims) {
///     // Full access
/// }
/// ```
pub fn is_employee(claims: &Claims) -> bool {
    matches!(claims.context_type.as_deref(), Some("employee") | None)
}

/// Check if the current user is a portal user (client, supplier, or partner).
///
/// Portal users have restricted access scoped to their company.
///
/// # Examples
///
/// ```rust,ignore
/// if is_portal_user(&claims) {
///     let cid = portal_company_id(&claims).expect("portal user always has company_id");
///     // Filter data by cid
/// }
/// ```
pub fn is_portal_user(claims: &Claims) -> bool {
    matches!(
        claims.context_type.as_deref(),
        Some("client") | Some("supplier") | Some("partner")
    )
}

/// Get the `company_id` for portal-scoped queries.
///
/// Returns the company UUID when the user is a portal user (`client`, `supplier`,
/// or `partner`), or `None` for employees and unauthenticated requests.
///
/// # Examples
///
/// ```rust,ignore
/// if let Some(cid) = portal_company_id(&claims) {
///     // Scope the DB query: WHERE company_id = $cid
/// }
/// ```
///
/// # Errors
///
/// This function is infallible. It returns `None` for non-portal users.
///
/// # Panics
///
/// No panics possible.
pub fn portal_company_id(claims: &Claims) -> Option<uuid::Uuid> {
    if is_portal_user(claims) {
        claims.company_id
    } else {
        None
    }
}
