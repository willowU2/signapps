// crates/signapps-ad-core/src/mail_resolver.rs
//! Resolves mail domains for org nodes using inheritance via closure table.
//!
//! Mail domain assignment is inherited: if a node has no direct mapping in
//! `ad_node_mail_domains`, the resolver walks up the org hierarchy via the
//! `core.org_closure` table and returns the closest ancestor's domain.

use sqlx::PgPool;
use uuid::Uuid;

/// Resolve the mail domain for a node by walking up ancestors.
///
/// Returns the `(domain_id, dns_name)` of the closest ancestor (including
/// the node itself, at depth 0) that has a mail domain mapping and whose
/// domain has `mail_enabled = true`.
///
/// Returns `None` if no ancestor has a mail domain configured.
///
/// # Errors
///
/// Returns `Error::Database` if the query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```rust,ignore
/// let result = resolve_closest_mail_domain(&pool, node_id).await?;
/// if let Some((domain_id, dns_name)) = result {
///     let mail = format!("{}@{}", sam, dns_name);
/// }
/// ```
#[tracing::instrument(skip(pool))]
pub async fn resolve_closest_mail_domain(
    pool: &PgPool,
    node_id: Uuid,
) -> signapps_common::Result<Option<(Uuid, String)>> {
    // Walk closure table from node up to root, find first ancestor with mail domain
    let row: Option<(Uuid, String)> = sqlx::query_as(
        r#"SELECT d.id, d.dns_name
           FROM ad_node_mail_domains nmd
           JOIN core.org_closure c ON c.ancestor_id = nmd.node_id
           JOIN infrastructure.domains d ON d.id = nmd.domain_id AND d.mail_enabled = true
           WHERE c.descendant_id = $1
           ORDER BY c.depth ASC
           LIMIT 1"#,
    )
    .bind(node_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    Ok(row)
}

/// Resolve all mail alias domains for a node (sub-branch domains).
///
/// Returns a list of `(domain_id, dns_name)` tuples for all descendants
/// of the given node that have a mail domain mapping and `mail_enabled = true`.
///
/// Useful for provisioning secondary SMTP aliases when a user's OU has
/// sub-domains.
///
/// # Errors
///
/// Returns `Error::Database` if the query fails.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
///
/// # Examples
///
/// ```rust,ignore
/// let aliases = resolve_mail_aliases(&pool, node_id).await?;
/// for (domain_id, dns_name) in aliases {
///     // provision additional alias
/// }
/// ```
#[tracing::instrument(skip(pool))]
pub async fn resolve_mail_aliases(
    pool: &PgPool,
    node_id: Uuid,
) -> signapps_common::Result<Vec<(Uuid, String)>> {
    let rows: Vec<(Uuid, String)> = sqlx::query_as(
        r#"SELECT d.id, d.dns_name
           FROM ad_node_mail_domains nmd
           JOIN core.org_closure c ON c.descendant_id = nmd.node_id
           JOIN infrastructure.domains d ON d.id = nmd.domain_id AND d.mail_enabled = true
           WHERE c.ancestor_id = $1 AND c.depth > 0"#,
    )
    .bind(node_id)
    .fetch_all(pool)
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    Ok(rows)
}

#[cfg(test)]
mod tests {
    /// Integration tests require a live database — covered by sync worker
    /// integration tests. This test verifies the module compiles.
    #[test]
    fn module_compiles() {
        // Placeholder: real tests live in integration test suite
        assert!(true);
    }
}
