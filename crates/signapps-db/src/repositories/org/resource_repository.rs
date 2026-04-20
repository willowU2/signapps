//! CRUD for `org_resources` + `org_resource_status_log` — SO8.
//!
//! Hiérarchie :
//! - [`ResourceRepository`] : opérations CRUD sur `org_resources`.
//! - Les transitions d'état passent par [`ResourceRepository::transition`]
//!   qui écrit atomiquement `org_resources.status` + un row
//!   `org_resource_status_log`.
//!
//! Les transitions invalides sont **filtrées par le handler** (via
//! [`crate::models::org::ResourceStatus::can_transition_to`]) avant d'arriver
//! ici : le repo se contente d'exécuter l'update + insert.

use anyhow::Result;
use chrono::NaiveDate;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::models::org::{Resource, ResourceKind, ResourceStatus, ResourceStatusLog};

/// Repository for `org_resources` + `org_resource_status_log`.
pub struct ResourceRepository<'a> {
    pool: &'a PgPool,
}

/// Filters pour [`ResourceRepository::list`].
#[derive(Debug, Default, Clone)]
pub struct ResourceListFilters {
    /// Tenant (obligatoire — portée naturelle).
    pub tenant_id: Uuid,
    /// Optional kind filter.
    pub kind: Option<ResourceKind>,
    /// Optional status filter.
    pub status: Option<ResourceStatus>,
    /// Optional person assignment filter.
    pub assigned_to_person_id: Option<Uuid>,
    /// Optional node assignment filter.
    pub assigned_to_node_id: Option<Uuid>,
    /// Optional site filter.
    pub primary_site_id: Option<Uuid>,
    /// Include archived rows (default `false`).
    pub include_archived: bool,
}

/// Payload minimal pour créer une ressource.
///
/// Les champs optionnels carry `None` par défaut — le caller remplit ce qui
/// est pertinent pour le `kind`.
#[derive(Debug, Clone)]
pub struct NewResource {
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Variante (IT, véhicule, …).
    pub kind: ResourceKind,
    /// Slug unique au sein du tenant.
    pub slug: String,
    /// Libellé affiché.
    pub name: String,
    /// Description libre (markdown).
    pub description: Option<String>,
    /// Numéro de série / référence.
    pub serial_or_ref: Option<String>,
    /// Attributs spécifiques par kind.
    pub attributes: serde_json::Value,
    /// Statut initial (par défaut `Active`).
    pub status: ResourceStatus,
    /// Personne assignée.
    pub assigned_to_person_id: Option<Uuid>,
    /// Node assigné.
    pub assigned_to_node_id: Option<Uuid>,
    /// Site physique.
    pub primary_site_id: Option<Uuid>,
    /// Date d'achat.
    pub purchase_date: Option<NaiveDate>,
    /// Coût en centimes.
    pub purchase_cost_cents: Option<i64>,
    /// Devise (ISO 4217).
    pub currency: Option<String>,
    /// Durée d'amortissement en mois.
    pub amortization_months: Option<i32>,
    /// Fin de garantie.
    pub warranty_end_date: Option<NaiveDate>,
    /// Prochaine maintenance.
    pub next_maintenance_date: Option<NaiveDate>,
    /// Token QR (si pré-calculé ; sinon le handler le set après create).
    pub qr_token: Option<String>,
    /// URL photo hero.
    pub photo_url: Option<String>,
    /// Type de l'identifiant primaire (snake_case, défaut `'none'`).
    pub primary_identifier_type: Option<String>,
}

/// Payload pour update partiel (tous les champs modifiables).
#[derive(Debug, Clone, Default)]
pub struct ResourceUpdate {
    /// Nouveau libellé.
    pub name: Option<String>,
    /// Description (Some(None-ish) pour vider, ici on passe `None` = pas touché,
    /// `Some(None)` pas supporté, utiliser `Some(String::new())` pour clear).
    pub description: Option<Option<String>>,
    /// Numéro de série.
    pub serial_or_ref: Option<Option<String>>,
    /// Attributs (remplacement complet du JSONB).
    pub attributes: Option<serde_json::Value>,
    /// Personne assignée (Some(None) = désassigner).
    pub assigned_to_person_id: Option<Option<Uuid>>,
    /// Node assigné (Some(None) = désassigner).
    pub assigned_to_node_id: Option<Option<Uuid>>,
    /// Site.
    pub primary_site_id: Option<Option<Uuid>>,
    /// Date d'achat.
    pub purchase_date: Option<Option<NaiveDate>>,
    /// Coût en centimes.
    pub purchase_cost_cents: Option<Option<i64>>,
    /// Devise.
    pub currency: Option<Option<String>>,
    /// Amortissement.
    pub amortization_months: Option<Option<i32>>,
    /// Garantie.
    pub warranty_end_date: Option<Option<NaiveDate>>,
    /// Prochaine maintenance.
    pub next_maintenance_date: Option<Option<NaiveDate>>,
    /// URL photo hero (Some(None) = vider).
    pub photo_url: Option<Option<String>>,
    /// Type de l'identifiant primaire.
    pub primary_identifier_type: Option<String>,
}

impl<'a> ResourceRepository<'a> {
    /// Construct a new repository bound to the given pool.
    #[must_use]
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new resource and record the initial status in the log.
    ///
    /// Writes to both tables inside a single transaction so callers
    /// never see a half-created resource.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error (FK, unique violation, …).
    pub async fn create(&self, input: NewResource, actor: Option<Uuid>) -> Result<Resource> {
        let mut tx = self.pool.begin().await?;
        let row = insert_resource(&mut tx, &input).await?;
        insert_status_log(&mut tx, row.id, None, input.status, actor, None).await?;
        tx.commit().await?;
        Ok(row)
    }

    /// Fetch one resource by id.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn get(&self, id: Uuid) -> Result<Option<Resource>> {
        let row = sqlx::query_as::<_, Resource>("SELECT * FROM org_resources WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(row)
    }

    /// Fetch one resource by QR token.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn get_by_qr_token(&self, qr_token: &str) -> Result<Option<Resource>> {
        let row = sqlx::query_as::<_, Resource>(
            "SELECT * FROM org_resources WHERE qr_token = $1 AND NOT archived",
        )
        .bind(qr_token)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Fetch one resource by slug.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn get_by_slug(&self, tenant_id: Uuid, slug: &str) -> Result<Option<Resource>> {
        let row = sqlx::query_as::<_, Resource>(
            "SELECT * FROM org_resources WHERE tenant_id = $1 AND slug = $2",
        )
        .bind(tenant_id)
        .bind(slug)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// List resources matching the given filters.
    ///
    /// Returns at most 500 rows ordered by `created_at DESC`. Use the
    /// `archived` flag on the filter to include soft-deleted items.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list(&self, filters: ResourceListFilters) -> Result<Vec<Resource>> {
        let kind_str = filters.kind.map(|k| k.as_str().to_string());
        let status_str = filters.status.map(|s| s.as_str().to_string());
        let rows = sqlx::query_as::<_, Resource>(
            r"
            SELECT * FROM org_resources
            WHERE tenant_id = $1
              AND ($2::bool OR NOT archived)
              AND ($3::text IS NULL OR kind = $3)
              AND ($4::text IS NULL OR status = $4)
              AND ($5::uuid IS NULL OR assigned_to_person_id = $5)
              AND ($6::uuid IS NULL OR assigned_to_node_id = $6)
              AND ($7::uuid IS NULL OR primary_site_id = $7)
            ORDER BY created_at DESC
            LIMIT 500
            ",
        )
        .bind(filters.tenant_id)
        .bind(filters.include_archived)
        .bind(kind_str)
        .bind(status_str)
        .bind(filters.assigned_to_person_id)
        .bind(filters.assigned_to_node_id)
        .bind(filters.primary_site_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// List resources assigned to a given person.
    ///
    /// Convenience wrapper used by `GET /me/inventory`.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_by_person(&self, person_id: Uuid) -> Result<Vec<Resource>> {
        let rows = sqlx::query_as::<_, Resource>(
            "SELECT * FROM org_resources
              WHERE assigned_to_person_id = $1 AND NOT archived
              ORDER BY kind, name",
        )
        .bind(person_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// List resources attached to a given node (hiérarchique — direct only).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_by_node(&self, node_id: Uuid) -> Result<Vec<Resource>> {
        let rows = sqlx::query_as::<_, Resource>(
            "SELECT * FROM org_resources
              WHERE assigned_to_node_id = $1 AND NOT archived
              ORDER BY kind, name",
        )
        .bind(node_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// List resources attached to a given site.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_by_site(&self, site_id: Uuid) -> Result<Vec<Resource>> {
        let rows = sqlx::query_as::<_, Resource>(
            "SELECT * FROM org_resources
              WHERE primary_site_id = $1 AND NOT archived
              ORDER BY kind, name",
        )
        .bind(site_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Apply a partial update to a resource.
    ///
    /// Status changes are NOT accepted here — they must go through
    /// [`ResourceRepository::transition`] for state-machine validation +
    /// history logging.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error. Returns `Ok(None)` if the row
    /// doesn't exist.
    #[allow(clippy::too_many_lines)]
    pub async fn update(&self, id: Uuid, patch: ResourceUpdate) -> Result<Option<Resource>> {
        let existing = self.get(id).await?;
        let Some(mut current) = existing else {
            return Ok(None);
        };

        // Apply patch to the current values (explicit field handling).
        if let Some(v) = patch.name {
            current.name = v;
        }
        if let Some(v) = patch.description {
            current.description = v;
        }
        if let Some(v) = patch.serial_or_ref {
            current.serial_or_ref = v;
        }
        if let Some(v) = patch.attributes {
            current.attributes = v;
        }
        if let Some(v) = patch.assigned_to_person_id {
            current.assigned_to_person_id = v;
            if v.is_some() {
                current.assigned_to_node_id = None;
            }
        }
        if let Some(v) = patch.assigned_to_node_id {
            current.assigned_to_node_id = v;
            if v.is_some() {
                current.assigned_to_person_id = None;
            }
        }
        if let Some(v) = patch.primary_site_id {
            current.primary_site_id = v;
        }
        if let Some(v) = patch.purchase_date {
            current.purchase_date = v;
        }
        if let Some(v) = patch.purchase_cost_cents {
            current.purchase_cost_cents = v;
        }
        if let Some(v) = patch.currency {
            current.currency = v;
        }
        if let Some(v) = patch.amortization_months {
            current.amortization_months = v;
        }
        if let Some(v) = patch.warranty_end_date {
            current.warranty_end_date = v;
        }
        if let Some(v) = patch.next_maintenance_date {
            current.next_maintenance_date = v;
        }
        if let Some(v) = patch.photo_url {
            current.photo_url = v;
        }
        if let Some(v) = patch.primary_identifier_type {
            current.primary_identifier_type = v;
        }

        let row = sqlx::query_as::<_, Resource>(
            r"
            UPDATE org_resources
               SET name                    = $2,
                   description             = $3,
                   serial_or_ref           = $4,
                   attributes              = $5,
                   assigned_to_person_id   = $6,
                   assigned_to_node_id     = $7,
                   primary_site_id         = $8,
                   purchase_date           = $9,
                   purchase_cost_cents     = $10,
                   currency                = $11,
                   amortization_months     = $12,
                   warranty_end_date       = $13,
                   next_maintenance_date   = $14,
                   photo_url               = $15,
                   primary_identifier_type = $16,
                   updated_at              = now()
             WHERE id = $1
             RETURNING *
            ",
        )
        .bind(id)
        .bind(&current.name)
        .bind(&current.description)
        .bind(&current.serial_or_ref)
        .bind(&current.attributes)
        .bind(current.assigned_to_person_id)
        .bind(current.assigned_to_node_id)
        .bind(current.primary_site_id)
        .bind(current.purchase_date)
        .bind(current.purchase_cost_cents)
        .bind(&current.currency)
        .bind(current.amortization_months)
        .bind(current.warranty_end_date)
        .bind(current.next_maintenance_date)
        .bind(&current.photo_url)
        .bind(&current.primary_identifier_type)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Set the photo URL on a resource (used by `/org/resources/:id/photo`).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn set_photo_url(
        &self,
        id: Uuid,
        photo_url: Option<&str>,
    ) -> Result<Option<Resource>> {
        let row = sqlx::query_as::<_, Resource>(
            "UPDATE org_resources SET photo_url = $2, updated_at = now()
              WHERE id = $1 RETURNING *",
        )
        .bind(id)
        .bind(photo_url)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Set the QR token on a row.
    ///
    /// Used by the handler right after creating a resource (when the
    /// keystore-derived token is computed from the newly generated id).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn set_qr_token(&self, id: Uuid, token: &str) -> Result<Option<Resource>> {
        let row = sqlx::query_as::<_, Resource>(
            "UPDATE org_resources SET qr_token = $2, updated_at = now()
              WHERE id = $1 RETURNING *",
        )
        .bind(id)
        .bind(token)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// Soft-archive a resource (archived = true).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn archive(&self, id: Uuid) -> Result<bool> {
        let res =
            sqlx::query("UPDATE org_resources SET archived = true, updated_at = now() WHERE id = $1")
                .bind(id)
                .execute(self.pool)
                .await?;
        Ok(res.rows_affected() > 0)
    }

    /// Apply a status transition and record it in the log.
    ///
    /// The caller MUST have validated the transition via
    /// [`ResourceStatus::can_transition_to`] before invoking this method.
    /// If the stored status no longer matches `from`, the transition is a
    /// no-op and returns `Ok(None)`.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn transition(
        &self,
        id: Uuid,
        from: ResourceStatus,
        to: ResourceStatus,
        actor: Option<Uuid>,
        reason: Option<String>,
    ) -> Result<Option<Resource>> {
        let mut tx = self.pool.begin().await?;
        let row = sqlx::query_as::<_, Resource>(
            r"
            UPDATE org_resources
               SET status = $3, updated_at = now()
             WHERE id = $1 AND status = $2
             RETURNING *
            ",
        )
        .bind(id)
        .bind(from.as_str())
        .bind(to.as_str())
        .fetch_optional(&mut *tx)
        .await?;
        let Some(updated) = row else {
            tx.rollback().await?;
            return Ok(None);
        };
        insert_status_log(&mut tx, id, Some(from), to, actor, reason).await?;
        tx.commit().await?;
        Ok(Some(updated))
    }

    /// List the status log of a resource, most recent first.
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn list_status_log(&self, resource_id: Uuid) -> Result<Vec<ResourceStatusLog>> {
        let rows = sqlx::query_as::<_, ResourceStatusLog>(
            "SELECT * FROM org_resource_status_log
              WHERE resource_id = $1 ORDER BY at DESC LIMIT 200",
        )
        .bind(resource_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Count resources by kind for a tenant. Returns a Vec of (kind, count).
    ///
    /// # Errors
    ///
    /// Returns the underlying sqlx error.
    pub async fn count_by_kind(&self, tenant_id: Uuid) -> Result<Vec<(String, i64)>> {
        let rows: Vec<(String, i64)> = sqlx::query_as(
            "SELECT kind, COUNT(*)::BIGINT FROM org_resources
              WHERE tenant_id = $1 AND NOT archived
              GROUP BY kind ORDER BY kind",
        )
        .bind(tenant_id)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }
}

async fn insert_resource(
    tx: &mut Transaction<'_, Postgres>,
    input: &NewResource,
) -> Result<Resource> {
    let row = sqlx::query_as::<_, Resource>(
        r"
        INSERT INTO org_resources (
            tenant_id, kind, slug, name, description, serial_or_ref,
            attributes, status, assigned_to_person_id, assigned_to_node_id,
            primary_site_id, purchase_date, purchase_cost_cents, currency,
            amortization_months, warranty_end_date, next_maintenance_date,
            qr_token, photo_url, primary_identifier_type
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19,
            COALESCE($20, 'none')
        )
        RETURNING *
        ",
    )
    .bind(input.tenant_id)
    .bind(input.kind.as_str())
    .bind(&input.slug)
    .bind(&input.name)
    .bind(&input.description)
    .bind(&input.serial_or_ref)
    .bind(&input.attributes)
    .bind(input.status.as_str())
    .bind(input.assigned_to_person_id)
    .bind(input.assigned_to_node_id)
    .bind(input.primary_site_id)
    .bind(input.purchase_date)
    .bind(input.purchase_cost_cents)
    .bind(&input.currency)
    .bind(input.amortization_months)
    .bind(input.warranty_end_date)
    .bind(input.next_maintenance_date)
    .bind(&input.qr_token)
    .bind(&input.photo_url)
    .bind(&input.primary_identifier_type)
    .fetch_one(&mut **tx)
    .await?;
    Ok(row)
}

async fn insert_status_log(
    tx: &mut Transaction<'_, Postgres>,
    resource_id: Uuid,
    from: Option<ResourceStatus>,
    to: ResourceStatus,
    actor: Option<Uuid>,
    reason: Option<String>,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO org_resource_status_log
            (resource_id, from_status, to_status, actor_user_id, reason)
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(resource_id)
    .bind(from.map(|s| s.as_str().to_string()))
    .bind(to.as_str())
    .bind(actor)
    .bind(reason)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
