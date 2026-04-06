//! Notification emission for sharing events.
//!
//! Inserts notification rows directly into the `notifications.notifications`
//! table (same PostgreSQL instance, no HTTP round-trip).
//!
//! Failures are **logged but never propagated** — notifications are
//! best-effort and must never block or fail a grant operation.

use sqlx::PgPool;
use tracing::instrument;
use uuid::Uuid;

use crate::types::ResourceType;

/// Notify a user that a resource was shared with them.
///
/// Inserts a row into `notifications.notifications`.  Any database error is
/// logged as a `warn!` span and silently dropped — the grant has already been
/// persisted at this point, so a notification failure must not roll it back.
///
/// Only called for **direct user grants** (`grantee_type = "user"`); fan-out
/// for groups / org-nodes / everyone is out of scope for this iteration.
///
/// # Examples
///
/// ```rust,ignore
/// use signapps_sharing::notifications::notify_grant_created;
/// use signapps_sharing::types::ResourceType;
///
/// notify_grant_created(
///     &pool,
///     tenant_id,
///     recipient_id,
///     actor_id,
///     ResourceType::File,
///     file_id,
///     "viewer",
/// ).await;
/// ```
///
/// # Errors
///
/// This function never returns an error — failures are swallowed after logging.
///
/// # Panics
///
/// No panics — all errors are handled internally.
#[instrument(skip(pool), fields(
    recipient_id = %recipient_id,
    resource_type = %resource_type,
    resource_id   = %resource_id,
    role          = %role,
))]
pub async fn notify_grant_created(
    pool: &PgPool,
    tenant_id: Uuid,
    recipient_id: Uuid,
    actor_id: Uuid,
    resource_type: ResourceType,
    resource_id: Uuid,
    role: &str,
) {
    let title = format!(
        "Un {} a été partagé avec vous",
        french_resource_label(resource_type)
    );
    let body = format!(
        "Vous avez désormais accès en {} à cette ressource.",
        french_role_label(role)
    );

    let result = sqlx::query(
        r#"INSERT INTO notifications.notifications
               (user_id, type, title, body, source, priority, metadata)
           VALUES ($1, 'info', $2, $3, 'sharing', 'normal', $4)"#,
    )
    .bind(recipient_id)
    .bind(&title)
    .bind(&body)
    .bind(serde_json::json!({
        "actor_id":      actor_id,
        "tenant_id":     tenant_id,
        "resource_type": resource_type.as_str(),
        "resource_id":   resource_id,
        "role":          role,
    }))
    .execute(pool)
    .await;

    if let Err(e) = result {
        tracing::warn!(
            error = ?e,
            %recipient_id,
            %resource_type,
            %resource_id,
            "failed to insert sharing notification — grant is unaffected"
        );
    }
}

// ─── Label helpers ────────────────────────────────────────────────────────────

fn french_resource_label(rt: ResourceType) -> &'static str {
    match rt {
        ResourceType::File => "fichier",
        ResourceType::Folder => "dossier",
        ResourceType::Calendar => "calendrier",
        ResourceType::Event => "événement",
        ResourceType::Document => "document",
        ResourceType::Form => "formulaire",
        ResourceType::ContactBook => "carnet d'adresses",
        ResourceType::Channel => "canal",
        ResourceType::Asset => "actif",
        ResourceType::VaultEntry => "secret",
    }
}

fn french_role_label(role: &str) -> &'static str {
    match role {
        "viewer" => "lecture",
        "editor" => "édition",
        "manager" => "gestion",
        "deny" => "accès refusé",
        _ => "accès partagé",
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn french_resource_labels_cover_all_variants() {
        for rt in [
            ResourceType::File,
            ResourceType::Folder,
            ResourceType::Calendar,
            ResourceType::Event,
            ResourceType::Document,
            ResourceType::Form,
            ResourceType::ContactBook,
            ResourceType::Channel,
            ResourceType::Asset,
            ResourceType::VaultEntry,
        ] {
            let label = french_resource_label(rt);
            assert!(!label.is_empty(), "label for {rt:?} must not be empty");
        }
    }

    #[test]
    fn french_role_labels_for_standard_roles() {
        assert_eq!(french_role_label("viewer"), "lecture");
        assert_eq!(french_role_label("editor"), "édition");
        assert_eq!(french_role_label("manager"), "gestion");
        assert_eq!(french_role_label("deny"), "accès refusé");
        // Unknown roles fall through to the generic fallback
        assert_eq!(french_role_label("superuser"), "accès partagé");
    }
}
