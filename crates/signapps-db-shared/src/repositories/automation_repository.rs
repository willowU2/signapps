//! AutomationRepository -- CRUD for `core.automations`, `core.automation_steps`,
//! `core.automation_runs`, `core.extensions`, and `core.action_catalog`.

use crate::models::automation::{
    ActionCatalogEntry, Automation, AutomationRun, AutomationStep, CreateAutomation,
    CreateExtension, CreateStep, Extension, UpdateAutomation,
};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for automations, steps, runs, extensions, and the action catalog.
pub struct AutomationRepository;

impl AutomationRepository {
    // ========================================================================
    // Automations
    // ========================================================================

    /// List automations for a tenant, optionally filtering to active ones only.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    pub async fn list(
        pool: &PgPool,
        tenant_id: Uuid,
        active_only: bool,
    ) -> Result<Vec<Automation>> {
        let rows = if active_only {
            sqlx::query_as::<_, Automation>(
                r#"SELECT * FROM core.automations
                   WHERE tenant_id = $1 AND is_active = TRUE
                   ORDER BY created_at DESC"#,
            )
            .bind(tenant_id)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, Automation>(
                r#"SELECT * FROM core.automations
                   WHERE tenant_id = $1
                   ORDER BY created_at DESC"#,
            )
            .bind(tenant_id)
            .fetch_all(pool)
            .await
        };
        rows.map_err(|e| Error::Database(e.to_string()))
    }

    /// Fetch a single automation by ID.
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no automation with the given ID exists.
    /// Returns `Error::Database` on query failure.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Automation> {
        sqlx::query_as::<_, Automation>("SELECT * FROM core.automations WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?
            .ok_or_else(|| Error::NotFound(format!("Automation {id} not found")))
    }

    /// Find active automations matching a specific trigger type within a tenant.
    ///
    /// Used by the automation engine to discover which automations should fire
    /// when a particular event occurs.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    pub async fn find_by_trigger(
        pool: &PgPool,
        tenant_id: Uuid,
        trigger_type: &str,
    ) -> Result<Vec<Automation>> {
        sqlx::query_as::<_, Automation>(
            r#"SELECT * FROM core.automations
               WHERE tenant_id = $1 AND trigger_type = $2 AND is_active = TRUE
               ORDER BY created_at DESC"#,
        )
        .bind(tenant_id)
        .bind(trigger_type)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Create a new automation.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure or constraint violations.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        user_id: Uuid,
        input: CreateAutomation,
    ) -> Result<Automation> {
        sqlx::query_as::<_, Automation>(
            r#"INSERT INTO core.automations
                (tenant_id, name, description, trigger_type, trigger_config, created_by)
               VALUES ($1, $2, COALESCE($3, ''), $4, COALESCE($5, '{}'), $6)
               RETURNING *"#,
        )
        .bind(tenant_id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(&input.trigger_type)
        .bind(&input.trigger_config)
        .bind(user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Update an existing automation.
    ///
    /// Only provided (non-`None`) fields are updated; others keep their
    /// current values.
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no automation with the given ID exists.
    /// Returns `Error::Database` on query failure.
    pub async fn update(pool: &PgPool, id: Uuid, input: UpdateAutomation) -> Result<Automation> {
        sqlx::query_as::<_, Automation>(
            r#"UPDATE core.automations SET
                name = COALESCE($2, name),
                description = COALESCE($3, description),
                trigger_type = COALESCE($4, trigger_type),
                trigger_config = COALESCE($5, trigger_config),
                is_active = COALESCE($6, is_active),
                updated_at = NOW()
               WHERE id = $1
               RETURNING *"#,
        )
        .bind(id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(&input.trigger_type)
        .bind(&input.trigger_config)
        .bind(input.is_active)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or_else(|| Error::NotFound(format!("Automation {id} not found")))
    }

    /// Delete an automation and all associated steps and runs (via CASCADE).
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no automation with the given ID exists.
    /// Returns `Error::Database` on query failure.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        let result = sqlx::query("DELETE FROM core.automations WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(Error::NotFound(format!("Automation {id} not found")));
        }
        Ok(())
    }

    // ========================================================================
    // Steps
    // ========================================================================

    /// List all steps for an automation, ordered by `step_order`.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    pub async fn list_steps(
        pool: &PgPool,
        automation_id: Uuid,
    ) -> Result<Vec<AutomationStep>> {
        sqlx::query_as::<_, AutomationStep>(
            r#"SELECT * FROM core.automation_steps
               WHERE automation_id = $1
               ORDER BY step_order"#,
        )
        .bind(automation_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Add a step to an automation pipeline.
    ///
    /// If `step_order` is not provided, the step is appended at the end.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure or constraint violations.
    pub async fn add_step(
        pool: &PgPool,
        automation_id: Uuid,
        input: CreateStep,
    ) -> Result<AutomationStep> {
        sqlx::query_as::<_, AutomationStep>(
            r#"INSERT INTO core.automation_steps
                (automation_id, step_order, step_type, action_type, config, condition)
               VALUES (
                $1,
                COALESCE($2, (SELECT COALESCE(MAX(step_order), -1) + 1
                              FROM core.automation_steps WHERE automation_id = $1)),
                $3, $4, COALESCE($5, '{}'), $6
               )
               RETURNING *"#,
        )
        .bind(automation_id)
        .bind(input.step_order)
        .bind(&input.step_type)
        .bind(&input.action_type)
        .bind(&input.config)
        .bind(&input.condition)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Update an existing step.
    ///
    /// Only provided (non-`None`) fields are updated.
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no step with the given ID exists.
    /// Returns `Error::Database` on query failure.
    pub async fn update_step(
        pool: &PgPool,
        step_id: Uuid,
        input: CreateStep,
    ) -> Result<AutomationStep> {
        sqlx::query_as::<_, AutomationStep>(
            r#"UPDATE core.automation_steps SET
                step_order = COALESCE($2, step_order),
                step_type = COALESCE($3, step_type),
                action_type = COALESCE($4, action_type),
                config = COALESCE($5, config),
                condition = COALESCE($6, condition)
               WHERE id = $1
               RETURNING *"#,
        )
        .bind(step_id)
        .bind(input.step_order)
        .bind(&input.step_type)
        .bind(&input.action_type)
        .bind(&input.config)
        .bind(&input.condition)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or_else(|| Error::NotFound(format!("Step {step_id} not found")))
    }

    /// Delete a step by ID.
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no step with the given ID exists.
    /// Returns `Error::Database` on query failure.
    pub async fn delete_step(pool: &PgPool, step_id: Uuid) -> Result<()> {
        let result = sqlx::query("DELETE FROM core.automation_steps WHERE id = $1")
            .bind(step_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(Error::NotFound(format!("Step {step_id} not found")));
        }
        Ok(())
    }

    /// Reorder steps by applying `step_order` from the position in the given ID list.
    ///
    /// Each step ID in `step_ids` receives a `step_order` equal to its
    /// zero-based index in the vector. Steps not in the list keep their
    /// current order.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    pub async fn reorder_steps(
        pool: &PgPool,
        automation_id: Uuid,
        step_ids: Vec<Uuid>,
    ) -> Result<()> {
        for (idx, step_id) in step_ids.iter().enumerate() {
            sqlx::query(
                r#"UPDATE core.automation_steps
                   SET step_order = $1
                   WHERE id = $2 AND automation_id = $3"#,
            )
            .bind(idx as i32)
            .bind(step_id)
            .bind(automation_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        }
        Ok(())
    }

    // ========================================================================
    // Runs
    // ========================================================================

    /// Start a new automation run with status `running`.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    pub async fn start_run(
        pool: &PgPool,
        automation_id: Uuid,
        trigger_payload: Option<serde_json::Value>,
    ) -> Result<AutomationRun> {
        sqlx::query_as::<_, AutomationRun>(
            r#"INSERT INTO core.automation_runs
                (automation_id, status, trigger_payload)
               VALUES ($1, 'running', COALESCE($2, '{}'))
               RETURNING *"#,
        )
        .bind(automation_id)
        .bind(&trigger_payload)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Mark a run as completed with step results and duration.
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no run with the given ID exists.
    /// Returns `Error::Database` on query failure.
    pub async fn complete_run(
        pool: &PgPool,
        run_id: Uuid,
        step_results: serde_json::Value,
        duration_ms: i32,
    ) -> Result<AutomationRun> {
        sqlx::query_as::<_, AutomationRun>(
            r#"UPDATE core.automation_runs SET
                status = 'completed',
                step_results = $2,
                duration_ms = $3,
                completed_at = NOW()
               WHERE id = $1
               RETURNING *"#,
        )
        .bind(run_id)
        .bind(&step_results)
        .bind(duration_ms)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or_else(|| Error::NotFound(format!("Run {run_id} not found")))
    }

    /// Mark a run as failed with an error message.
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no run with the given ID exists.
    /// Returns `Error::Database` on query failure.
    pub async fn fail_run(
        pool: &PgPool,
        run_id: Uuid,
        error: &str,
    ) -> Result<AutomationRun> {
        sqlx::query_as::<_, AutomationRun>(
            r#"UPDATE core.automation_runs SET
                status = 'failed',
                error = $2,
                completed_at = NOW()
               WHERE id = $1
               RETURNING *"#,
        )
        .bind(run_id)
        .bind(error)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or_else(|| Error::NotFound(format!("Run {run_id} not found")))
    }

    /// List recent runs for an automation, most recent first.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    pub async fn list_runs(
        pool: &PgPool,
        automation_id: Uuid,
        limit: i64,
    ) -> Result<Vec<AutomationRun>> {
        sqlx::query_as::<_, AutomationRun>(
            r#"SELECT * FROM core.automation_runs
               WHERE automation_id = $1
               ORDER BY started_at DESC
               LIMIT $2"#,
        )
        .bind(automation_id)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    // ========================================================================
    // Extensions
    // ========================================================================

    /// List all extensions installed in a tenant.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    pub async fn list_extensions(
        pool: &PgPool,
        tenant_id: Uuid,
    ) -> Result<Vec<Extension>> {
        sqlx::query_as::<_, Extension>(
            r#"SELECT * FROM core.extensions
               WHERE tenant_id = $1
               ORDER BY created_at DESC"#,
        )
        .bind(tenant_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Install a new extension (initially inactive and unapproved).
    ///
    /// The extension is created with `is_active = false` and `is_approved = false`.
    /// An admin must call `approve_extension` to activate it.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure or unique constraint violation.
    pub async fn install_extension(
        pool: &PgPool,
        tenant_id: Uuid,
        user_id: Uuid,
        input: CreateExtension,
    ) -> Result<Extension> {
        sqlx::query_as::<_, Extension>(
            r#"INSERT INTO core.extensions
                (tenant_id, name, description, version, entry_point,
                 permissions, hooks, installed_by)
               VALUES ($1, $2, COALESCE($3, ''), COALESCE($4, '1.0.0'),
                       $5, COALESCE($6, '{}'), COALESCE($7, '{}'), $8)
               RETURNING *"#,
        )
        .bind(tenant_id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(&input.version)
        .bind(&input.entry_point)
        .bind(&input.permissions.as_deref().unwrap_or(&[]))
        .bind(&input.hooks)
        .bind(user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Approve an extension and activate it.
    ///
    /// Sets `is_approved = true` and `is_active = true`.
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no extension with the given ID exists.
    /// Returns `Error::Database` on query failure.
    pub async fn approve_extension(
        pool: &PgPool,
        extension_id: Uuid,
        approver_id: Uuid,
    ) -> Result<Extension> {
        sqlx::query_as::<_, Extension>(
            r#"UPDATE core.extensions SET
                is_approved = TRUE,
                is_active = TRUE,
                approved_by = $2,
                updated_at = NOW()
               WHERE id = $1
               RETURNING *"#,
        )
        .bind(extension_id)
        .bind(approver_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or_else(|| Error::NotFound(format!("Extension {extension_id} not found")))
    }

    /// Deactivate an extension without uninstalling it.
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no extension with the given ID exists.
    /// Returns `Error::Database` on query failure.
    pub async fn deactivate_extension(
        pool: &PgPool,
        extension_id: Uuid,
    ) -> Result<Extension> {
        sqlx::query_as::<_, Extension>(
            r#"UPDATE core.extensions SET
                is_active = FALSE,
                updated_at = NOW()
               WHERE id = $1
               RETURNING *"#,
        )
        .bind(extension_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or_else(|| Error::NotFound(format!("Extension {extension_id} not found")))
    }

    /// Uninstall (delete) an extension.
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no extension with the given ID exists.
    /// Returns `Error::Database` on query failure.
    pub async fn uninstall_extension(pool: &PgPool, extension_id: Uuid) -> Result<()> {
        let result = sqlx::query("DELETE FROM core.extensions WHERE id = $1")
            .bind(extension_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(Error::NotFound(format!("Extension {extension_id} not found")));
        }
        Ok(())
    }

    // ========================================================================
    // Action Catalog
    // ========================================================================

    /// List available actions, optionally filtered by category.
    ///
    /// # Errors
    ///
    /// Returns `Error::Database` on query failure.
    pub async fn list_actions(
        pool: &PgPool,
        category: Option<&str>,
    ) -> Result<Vec<ActionCatalogEntry>> {
        match category {
            Some(cat) => {
                sqlx::query_as::<_, ActionCatalogEntry>(
                    r#"SELECT * FROM core.action_catalog
                       WHERE category = $1
                       ORDER BY name"#,
                )
                .bind(cat)
                .fetch_all(pool)
                .await
            }
            None => {
                sqlx::query_as::<_, ActionCatalogEntry>(
                    "SELECT * FROM core.action_catalog ORDER BY name",
                )
                .fetch_all(pool)
                .await
            }
        }
        .map_err(|e| Error::Database(e.to_string()))
    }

    /// Find a single action by its unique name.
    ///
    /// # Errors
    ///
    /// Returns `Error::NotFound` if no action with the given name exists.
    /// Returns `Error::Database` on query failure.
    pub async fn find_action(pool: &PgPool, name: &str) -> Result<ActionCatalogEntry> {
        sqlx::query_as::<_, ActionCatalogEntry>(
            "SELECT * FROM core.action_catalog WHERE name = $1",
        )
        .bind(name)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or_else(|| Error::NotFound(format!("Action '{name}' not found")))
    }
}
