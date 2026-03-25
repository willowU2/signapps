//! Tenant repository for multi-tenant operations.

use crate::models::{
    AddWorkspaceMember, CreateLabel, CreateProject, CreateReservation, CreateResourceType,
    CreateTemplate, CreateTenant, CreateTenantCalendar, CreateTenantResource, CreateTenantTask,
    CreateWorkspace, EntityLabel, Label, Project, ProjectMember, ProjectWithStats, Reservation,
    ResourceType, Template, Tenant, TenantCalendar, TenantResource, TenantTask, UpdateProject,
    UpdateReservationStatus, UpdateTemplate, UpdateTenant, UpdateTenantResource, UpdateWorkspace,
    Workspace, WorkspaceMember, WorkspaceMemberWithUser,
};
use signapps_common::{Error, Result};
use sqlx::PgPool;
use uuid::Uuid;

// ============================================================================
// Tenant Repository
// ============================================================================

/// Repository for tenant operations.
pub struct TenantRepository;

impl TenantRepository {
    /// Set the current tenant context for RLS.
    pub async fn set_tenant_context(pool: &PgPool, tenant_id: Uuid) -> Result<()> {
        sqlx::query(&format!(
            "SET LOCAL app.current_tenant_id = '{}'",
            tenant_id
        ))
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Find tenant by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Tenant>> {
        let tenant = sqlx::query_as::<_, Tenant>("SELECT * FROM identity.tenants WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(tenant)
    }

    /// Find tenant by slug.
    pub async fn find_by_slug(pool: &PgPool, slug: &str) -> Result<Option<Tenant>> {
        let tenant = sqlx::query_as::<_, Tenant>("SELECT * FROM identity.tenants WHERE slug = $1")
            .bind(slug)
            .fetch_optional(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(tenant)
    }

    /// Find tenant by domain.
    pub async fn find_by_domain(pool: &PgPool, domain: &str) -> Result<Option<Tenant>> {
        let tenant =
            sqlx::query_as::<_, Tenant>("SELECT * FROM identity.tenants WHERE domain = $1")
                .bind(domain)
                .fetch_optional(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;
        Ok(tenant)
    }

    /// List all tenants with pagination.
    pub async fn list(pool: &PgPool, limit: i64, offset: i64) -> Result<Vec<Tenant>> {
        let tenants = sqlx::query_as::<_, Tenant>(
            "SELECT * FROM identity.tenants WHERE is_active = TRUE ORDER BY name LIMIT $1 OFFSET $2",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(tenants)
    }

    /// Create a new tenant.
    pub async fn create(pool: &PgPool, tenant: CreateTenant) -> Result<Tenant> {
        let created = sqlx::query_as::<_, Tenant>(
            r#"
            INSERT INTO identity.tenants (name, slug, domain, logo_url, plan)
            VALUES ($1, $2, $3, $4, COALESCE($5, 'free'))
            RETURNING *
            "#,
        )
        .bind(&tenant.name)
        .bind(&tenant.slug)
        .bind(&tenant.domain)
        .bind(&tenant.logo_url)
        .bind(&tenant.plan)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Update a tenant.
    pub async fn update(pool: &PgPool, id: Uuid, update: UpdateTenant) -> Result<Tenant> {
        let updated = sqlx::query_as::<_, Tenant>(
            r#"
            UPDATE identity.tenants
            SET name = COALESCE($2, name),
                domain = COALESCE($3, domain),
                logo_url = COALESCE($4, logo_url),
                settings = COALESCE($5, settings),
                plan = COALESCE($6, plan),
                max_users = COALESCE($7, max_users),
                max_resources = COALESCE($8, max_resources),
                max_workspaces = COALESCE($9, max_workspaces),
                is_active = COALESCE($10, is_active),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&update.name)
        .bind(&update.domain)
        .bind(&update.logo_url)
        .bind(&update.settings)
        .bind(&update.plan)
        .bind(update.max_users)
        .bind(update.max_resources)
        .bind(update.max_workspaces)
        .bind(update.is_active)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(updated)
    }

    /// Delete a tenant (soft delete by setting is_active to false).
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE identity.tenants SET is_active = FALSE, updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Count users in a tenant.
    pub async fn count_users(pool: &PgPool, tenant_id: Uuid) -> Result<i64> {
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM identity.users WHERE tenant_id = $1")
                .bind(tenant_id)
                .fetch_one(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;
        Ok(count.0)
    }
}

// ============================================================================
// Workspace Repository
// ============================================================================

/// Repository for workspace operations.
pub struct WorkspaceRepository;

impl WorkspaceRepository {
    /// Find workspace by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Workspace>> {
        let workspace =
            sqlx::query_as::<_, Workspace>("SELECT * FROM identity.workspaces WHERE id = $1")
                .bind(id)
                .fetch_optional(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;
        Ok(workspace)
    }

    /// List workspaces for a tenant.
    pub async fn list_by_tenant(
        pool: &PgPool,
        tenant_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Workspace>> {
        let workspaces = sqlx::query_as::<_, Workspace>(
            "SELECT * FROM identity.workspaces WHERE tenant_id = $1 ORDER BY name LIMIT $2 OFFSET $3",
        )
        .bind(tenant_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(workspaces)
    }

    /// List workspaces a user is member of.
    pub async fn list_by_user(pool: &PgPool, user_id: Uuid) -> Result<Vec<Workspace>> {
        let workspaces = sqlx::query_as::<_, Workspace>(
            r#"
            SELECT w.* FROM identity.workspaces w
            INNER JOIN identity.workspace_members wm ON w.id = wm.workspace_id
            WHERE wm.user_id = $1
            ORDER BY w.name
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(workspaces)
    }

    /// Create a new workspace.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        created_by: Uuid,
        workspace: CreateWorkspace,
    ) -> Result<Workspace> {
        let created = sqlx::query_as::<_, Workspace>(
            r#"
            INSERT INTO identity.workspaces (tenant_id, name, description, color, icon, is_default, created_by)
            VALUES ($1, $2, $3, COALESCE($4, '#3B82F6'), $5, COALESCE($6, FALSE), $7)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(&workspace.name)
        .bind(&workspace.description)
        .bind(&workspace.color)
        .bind(&workspace.icon)
        .bind(workspace.is_default)
        .bind(created_by)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Update a workspace.
    pub async fn update(pool: &PgPool, id: Uuid, update: UpdateWorkspace) -> Result<Workspace> {
        let updated = sqlx::query_as::<_, Workspace>(
            r#"
            UPDATE identity.workspaces
            SET name = COALESCE($2, name),
                description = COALESCE($3, description),
                color = COALESCE($4, color),
                icon = COALESCE($5, icon),
                is_default = COALESCE($6, is_default),
                settings = COALESCE($7, settings),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&update.name)
        .bind(&update.description)
        .bind(&update.color)
        .bind(&update.icon)
        .bind(update.is_default)
        .bind(&update.settings)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(updated)
    }

    /// Delete a workspace.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM identity.workspaces WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Add member to workspace.
    pub async fn add_member(
        pool: &PgPool,
        workspace_id: Uuid,
        member: AddWorkspaceMember,
    ) -> Result<WorkspaceMember> {
        let created = sqlx::query_as::<_, WorkspaceMember>(
            r#"
            INSERT INTO identity.workspace_members (workspace_id, user_id, role)
            VALUES ($1, $2, COALESCE($3, 'member'))
            RETURNING *
            "#,
        )
        .bind(workspace_id)
        .bind(member.user_id)
        .bind(&member.role)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// AQ-NP1Q: Batch-add a user to multiple workspaces in a single query.
    /// Uses unnest() to avoid N individual INSERT calls.
    pub async fn add_member_to_workspaces(
        pool: &PgPool,
        user_id: Uuid,
        workspace_ids: &[Uuid],
        role: &str,
    ) -> Result<()> {
        if workspace_ids.is_empty() {
            return Ok(());
        }
        // Build a single INSERT … SELECT unnest(…) statement
        sqlx::query(
            r#"
            INSERT INTO identity.workspace_members (workspace_id, user_id, role)
            SELECT unnest($1::uuid[]), $2, $3
            ON CONFLICT (workspace_id, user_id) DO NOTHING
            "#,
        )
        .bind(workspace_ids)
        .bind(user_id)
        .bind(role)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Remove member from workspace.
    pub async fn remove_member(pool: &PgPool, workspace_id: Uuid, user_id: Uuid) -> Result<()> {
        sqlx::query(
            "DELETE FROM identity.workspace_members WHERE workspace_id = $1 AND user_id = $2",
        )
        .bind(workspace_id)
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// List workspace members with user details.
    pub async fn list_members(
        pool: &PgPool,
        workspace_id: Uuid,
    ) -> Result<Vec<WorkspaceMemberWithUser>> {
        let members = sqlx::query_as::<_, WorkspaceMemberWithUser>(
            r#"
            SELECT wm.id, wm.workspace_id, wm.user_id, u.username, u.email,
                   u.display_name, u.avatar_url, wm.role, wm.joined_at
            FROM identity.workspace_members wm
            INNER JOIN identity.users u ON wm.user_id = u.id
            WHERE wm.workspace_id = $1
            ORDER BY wm.joined_at
            "#,
        )
        .bind(workspace_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(members)
    }

    /// Update member role.
    pub async fn update_member_role(
        pool: &PgPool,
        workspace_id: Uuid,
        user_id: Uuid,
        role: &str,
    ) -> Result<()> {
        sqlx::query(
            "UPDATE identity.workspace_members SET role = $3 WHERE workspace_id = $1 AND user_id = $2",
        )
        .bind(workspace_id)
        .bind(user_id)
        .bind(role)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}

// ============================================================================
// Project Repository
// ============================================================================

/// Repository for project operations.
pub struct ProjectRepository;

impl ProjectRepository {
    /// Find project by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Project>> {
        let project = sqlx::query_as::<_, Project>(
            "SELECT * FROM calendar.projects WHERE id = $1 AND deleted_at IS NULL",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(project)
    }

    /// List projects for a tenant with stats.
    pub async fn list_with_stats(
        pool: &PgPool,
        tenant_id: Uuid,
        workspace_id: Option<Uuid>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<ProjectWithStats>> {
        let projects = if let Some(ws_id) = workspace_id {
            sqlx::query_as::<_, ProjectWithStats>(
                r#"
                SELECT p.id, p.tenant_id, p.workspace_id, p.name, p.description, p.color,
                       p.status, p.start_date, p.due_date, p.owner_id, p.created_at,
                       COALESCE(COUNT(t.id), 0) as total_tasks,
                       COALESCE(COUNT(t.id) FILTER (WHERE t.status = 'completed'), 0) as completed_tasks
                FROM calendar.projects p
                LEFT JOIN calendar.tasks t ON p.id = t.project_id
                WHERE p.tenant_id = $1 AND p.workspace_id = $2 AND p.deleted_at IS NULL
                GROUP BY p.id
                ORDER BY p.created_at DESC
                LIMIT $3 OFFSET $4
                "#,
            )
            .bind(tenant_id)
            .bind(ws_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, ProjectWithStats>(
                r#"
                SELECT p.id, p.tenant_id, p.workspace_id, p.name, p.description, p.color,
                       p.status, p.start_date, p.due_date, p.owner_id, p.created_at,
                       COALESCE(COUNT(t.id), 0) as total_tasks,
                       COALESCE(COUNT(t.id) FILTER (WHERE t.status = 'completed'), 0) as completed_tasks
                FROM calendar.projects p
                LEFT JOIN calendar.tasks t ON p.id = t.project_id
                WHERE p.tenant_id = $1 AND p.deleted_at IS NULL
                GROUP BY p.id
                ORDER BY p.created_at DESC
                LIMIT $2 OFFSET $3
                "#,
            )
            .bind(tenant_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await
        }
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(projects)
    }

    /// Create a new project.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        owner_id: Uuid,
        project: CreateProject,
    ) -> Result<Project> {
        let created = sqlx::query_as::<_, Project>(
            r#"
            INSERT INTO calendar.projects (
                tenant_id, workspace_id, name, description, color, icon,
                status, start_date, due_date, template_id, owner_id
            )
            VALUES ($1, $2, $3, $4, COALESCE($5, '#3B82F6'), $6,
                    COALESCE($7, 'planning'), $8, $9, $10, $11)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(project.workspace_id)
        .bind(&project.name)
        .bind(&project.description)
        .bind(&project.color)
        .bind(&project.icon)
        .bind(&project.status)
        .bind(project.start_date)
        .bind(project.due_date)
        .bind(project.template_id)
        .bind(owner_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Update a project.
    pub async fn update(pool: &PgPool, id: Uuid, update: UpdateProject) -> Result<Project> {
        let updated = sqlx::query_as::<_, Project>(
            r#"
            UPDATE calendar.projects
            SET workspace_id = COALESCE($2, workspace_id),
                name = COALESCE($3, name),
                description = COALESCE($4, description),
                color = COALESCE($5, color),
                icon = COALESCE($6, icon),
                status = COALESCE($7, status),
                start_date = COALESCE($8, start_date),
                due_date = COALESCE($9, due_date),
                metadata = COALESCE($10, metadata),
                updated_at = NOW()
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(update.workspace_id)
        .bind(&update.name)
        .bind(&update.description)
        .bind(&update.color)
        .bind(&update.icon)
        .bind(&update.status)
        .bind(update.start_date)
        .bind(update.due_date)
        .bind(&update.metadata)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(updated)
    }

    /// Soft delete a project.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE calendar.projects SET deleted_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Add member to project.
    pub async fn add_member(
        pool: &PgPool,
        project_id: Uuid,
        user_id: Uuid,
        role: &str,
    ) -> Result<ProjectMember> {
        let created = sqlx::query_as::<_, ProjectMember>(
            r#"
            INSERT INTO calendar.project_members (project_id, user_id, role)
            VALUES ($1, $2, $3)
            RETURNING *
            "#,
        )
        .bind(project_id)
        .bind(user_id)
        .bind(role)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Remove member from project.
    pub async fn remove_member(pool: &PgPool, project_id: Uuid, user_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.project_members WHERE project_id = $1 AND user_id = $2")
            .bind(project_id)
            .bind(user_id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}

// ============================================================================
// Resource Type Repository
// ============================================================================

/// Repository for resource type operations.
pub struct ResourceTypeRepository;

impl ResourceTypeRepository {
    /// List resource types for a tenant.
    pub async fn list_by_tenant(pool: &PgPool, tenant_id: Uuid) -> Result<Vec<ResourceType>> {
        let types = sqlx::query_as::<_, ResourceType>(
            "SELECT * FROM calendar.resource_types WHERE tenant_id = $1 ORDER BY name",
        )
        .bind(tenant_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(types)
    }

    /// Create a new resource type.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        resource_type: CreateResourceType,
    ) -> Result<ResourceType> {
        let created = sqlx::query_as::<_, ResourceType>(
            r#"
            INSERT INTO calendar.resource_types (tenant_id, name, icon, color, requires_approval)
            VALUES ($1, $2, $3, $4, COALESCE($5, FALSE))
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(&resource_type.name)
        .bind(&resource_type.icon)
        .bind(&resource_type.color)
        .bind(resource_type.requires_approval)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Delete a resource type.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.resource_types WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}

// ============================================================================
// Tenant Resource Repository
// ============================================================================

/// Repository for tenant resource operations (rooms, equipment, etc.).
pub struct TenantResourceRepository;

impl TenantResourceRepository {
    /// Find resource by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<TenantResource>> {
        let resource = sqlx::query_as::<_, TenantResource>(
            "SELECT * FROM calendar.tenant_resources WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(resource)
    }

    /// List resources for a tenant.
    pub async fn list_by_tenant(
        pool: &PgPool,
        tenant_id: Uuid,
        resource_type: Option<&str>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<TenantResource>> {
        let resources = if let Some(rt) = resource_type {
            sqlx::query_as::<_, TenantResource>(
                r#"
                SELECT * FROM calendar.tenant_resources
                WHERE tenant_id = $1 AND resource_type = $2 AND is_available = TRUE
                ORDER BY name LIMIT $3 OFFSET $4
                "#,
            )
            .bind(tenant_id)
            .bind(rt)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, TenantResource>(
                r#"
                SELECT * FROM calendar.tenant_resources
                WHERE tenant_id = $1 AND is_available = TRUE
                ORDER BY name LIMIT $2 OFFSET $3
                "#,
            )
            .bind(tenant_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await
        }
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(resources)
    }

    /// Create a new resource.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        owner_id: Uuid,
        resource: CreateTenantResource,
    ) -> Result<TenantResource> {
        let created = sqlx::query_as::<_, TenantResource>(
            r#"
            INSERT INTO calendar.tenant_resources (
                tenant_id, resource_type_id, name, resource_type, description,
                capacity, location, floor, building, amenities,
                requires_approval, approver_ids, owner_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, FALSE), $12, $13)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(resource.resource_type_id)
        .bind(&resource.name)
        .bind(&resource.resource_type)
        .bind(&resource.description)
        .bind(resource.capacity)
        .bind(&resource.location)
        .bind(&resource.floor)
        .bind(&resource.building)
        .bind(&resource.amenities)
        .bind(resource.requires_approval)
        .bind(&resource.approver_ids)
        .bind(owner_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Update a resource.
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        update: UpdateTenantResource,
    ) -> Result<TenantResource> {
        let updated = sqlx::query_as::<_, TenantResource>(
            r#"
            UPDATE calendar.tenant_resources
            SET name = COALESCE($2, name),
                description = COALESCE($3, description),
                capacity = COALESCE($4, capacity),
                location = COALESCE($5, location),
                floor = COALESCE($6, floor),
                building = COALESCE($7, building),
                amenities = COALESCE($8, amenities),
                photo_urls = COALESCE($9, photo_urls),
                availability_rules = COALESCE($10, availability_rules),
                booking_rules = COALESCE($11, booking_rules),
                requires_approval = COALESCE($12, requires_approval),
                approver_ids = COALESCE($13, approver_ids),
                is_available = COALESCE($14, is_available),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&update.name)
        .bind(&update.description)
        .bind(update.capacity)
        .bind(&update.location)
        .bind(&update.floor)
        .bind(&update.building)
        .bind(&update.amenities)
        .bind(&update.photo_urls)
        .bind(&update.availability_rules)
        .bind(&update.booking_rules)
        .bind(update.requires_approval)
        .bind(&update.approver_ids)
        .bind(update.is_available)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(updated)
    }

    /// Delete a resource.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.tenant_resources WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}

// ============================================================================
// Reservation Repository
// ============================================================================

/// Repository for reservation operations.
pub struct ReservationRepository;

impl ReservationRepository {
    /// Find reservation by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Reservation>> {
        let reservation =
            sqlx::query_as::<_, Reservation>("SELECT * FROM calendar.reservations WHERE id = $1")
                .bind(id)
                .fetch_optional(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;
        Ok(reservation)
    }

    /// List reservations for a resource.
    pub async fn list_by_resource(
        pool: &PgPool,
        resource_id: Uuid,
        status: Option<&str>,
    ) -> Result<Vec<Reservation>> {
        let reservations = if let Some(s) = status {
            sqlx::query_as::<_, Reservation>(
                "SELECT * FROM calendar.reservations WHERE resource_id = $1 AND status = $2 ORDER BY created_at DESC",
            )
            .bind(resource_id)
            .bind(s)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, Reservation>(
                "SELECT * FROM calendar.reservations WHERE resource_id = $1 ORDER BY created_at DESC",
            )
            .bind(resource_id)
            .fetch_all(pool)
            .await
        }
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(reservations)
    }

    /// List pending reservations for approval.
    pub async fn list_pending_for_approver(
        pool: &PgPool,
        approver_id: Uuid,
    ) -> Result<Vec<Reservation>> {
        let reservations = sqlx::query_as::<_, Reservation>(
            r#"
            SELECT r.* FROM calendar.reservations r
            INNER JOIN calendar.tenant_resources tr ON r.resource_id = tr.id
            WHERE r.status = 'pending' AND $1 = ANY(tr.approver_ids)
            ORDER BY r.created_at
            "#,
        )
        .bind(approver_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(reservations)
    }

    /// List reservations for a user (my reservations).
    pub async fn list_by_user(
        pool: &PgPool,
        user_id: Uuid,
        status: Option<&str>,
    ) -> Result<Vec<Reservation>> {
        let reservations = if let Some(s) = status {
            sqlx::query_as::<_, Reservation>(
                "SELECT * FROM calendar.reservations WHERE requested_by = $1 AND status = $2 ORDER BY created_at DESC",
            )
            .bind(user_id)
            .bind(s)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, Reservation>(
                "SELECT * FROM calendar.reservations WHERE requested_by = $1 ORDER BY created_at DESC",
            )
            .bind(user_id)
            .fetch_all(pool)
            .await
        }
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(reservations)
    }

    /// Create a new reservation.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        requested_by: Uuid,
        reservation: CreateReservation,
    ) -> Result<Reservation> {
        // Check if resource requires approval
        let requires_approval: (bool,) =
            sqlx::query_as("SELECT requires_approval FROM calendar.tenant_resources WHERE id = $1")
                .bind(reservation.resource_id)
                .fetch_one(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;

        let status = if requires_approval.0 {
            "pending"
        } else {
            "approved"
        };

        let created = sqlx::query_as::<_, Reservation>(
            r#"
            INSERT INTO calendar.reservations (tenant_id, resource_id, event_id, requested_by, status, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(reservation.resource_id)
        .bind(reservation.event_id)
        .bind(requested_by)
        .bind(status)
        .bind(&reservation.notes)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Update reservation status (approve/reject/cancel).
    pub async fn update_status(
        pool: &PgPool,
        id: Uuid,
        approver_id: Uuid,
        update: UpdateReservationStatus,
    ) -> Result<Reservation> {
        let updated = sqlx::query_as::<_, Reservation>(
            r#"
            UPDATE calendar.reservations
            SET status = $2,
                approved_by = $3,
                approved_at = CASE WHEN $2 IN ('approved', 'rejected') THEN NOW() ELSE approved_at END,
                rejection_reason = $4,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&update.status)
        .bind(approver_id)
        .bind(&update.rejection_reason)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(updated)
    }
}

// ============================================================================
// Template Repository
// ============================================================================

/// Repository for template operations.
pub struct TemplateRepository;

impl TemplateRepository {
    /// Find template by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Template>> {
        let template = sqlx::query_as::<_, Template>(
            "SELECT * FROM calendar.templates WHERE id = $1 AND deleted_at IS NULL",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(template)
    }

    /// List templates for a tenant (including global templates).
    pub async fn list_by_tenant(
        pool: &PgPool,
        tenant_id: Uuid,
        template_type: Option<&str>,
    ) -> Result<Vec<Template>> {
        let templates = if let Some(tt) = template_type {
            sqlx::query_as::<_, Template>(
                r#"
                SELECT * FROM calendar.templates
                WHERE (tenant_id = $1 OR tenant_id IS NULL) AND template_type = $2 AND deleted_at IS NULL
                ORDER BY usage_count DESC, name
                "#,
            )
            .bind(tenant_id)
            .bind(tt)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, Template>(
                r#"
                SELECT * FROM calendar.templates
                WHERE (tenant_id = $1 OR tenant_id IS NULL) AND deleted_at IS NULL
                ORDER BY usage_count DESC, name
                "#,
            )
            .bind(tenant_id)
            .fetch_all(pool)
            .await
        }
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(templates)
    }

    /// Create a new template.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        created_by: Uuid,
        template: CreateTemplate,
    ) -> Result<Template> {
        let created = sqlx::query_as::<_, Template>(
            r#"
            INSERT INTO calendar.templates (
                tenant_id, workspace_id, name, description, template_type,
                content, icon, color, is_public, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, FALSE), $10)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(template.workspace_id)
        .bind(&template.name)
        .bind(&template.description)
        .bind(&template.template_type)
        .bind(&template.content)
        .bind(&template.icon)
        .bind(&template.color)
        .bind(template.is_public)
        .bind(created_by)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Update a template.
    pub async fn update(pool: &PgPool, id: Uuid, update: UpdateTemplate) -> Result<Template> {
        let updated = sqlx::query_as::<_, Template>(
            r#"
            UPDATE calendar.templates
            SET name = COALESCE($2, name),
                description = COALESCE($3, description),
                content = COALESCE($4, content),
                icon = COALESCE($5, icon),
                color = COALESCE($6, color),
                is_public = COALESCE($7, is_public),
                updated_at = NOW()
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&update.name)
        .bind(&update.description)
        .bind(&update.content)
        .bind(&update.icon)
        .bind(&update.color)
        .bind(update.is_public)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(updated)
    }

    /// Increment usage count.
    pub async fn increment_usage(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE calendar.templates SET usage_count = usage_count + 1 WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Soft delete a template.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE calendar.templates SET deleted_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}

// ============================================================================
// Label Repository
// ============================================================================

/// Repository for label operations.
pub struct LabelRepository;

impl LabelRepository {
    /// List labels for a tenant.
    pub async fn list_by_tenant(
        pool: &PgPool,
        tenant_id: Uuid,
        workspace_id: Option<Uuid>,
    ) -> Result<Vec<Label>> {
        let labels = if let Some(ws_id) = workspace_id {
            sqlx::query_as::<_, Label>(
                "SELECT * FROM calendar.labels WHERE tenant_id = $1 AND (workspace_id = $2 OR workspace_id IS NULL) ORDER BY name",
            )
            .bind(tenant_id)
            .bind(ws_id)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, Label>(
                "SELECT * FROM calendar.labels WHERE tenant_id = $1 ORDER BY name",
            )
            .bind(tenant_id)
            .fetch_all(pool)
            .await
        }
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(labels)
    }

    /// Create a new label.
    pub async fn create(pool: &PgPool, tenant_id: Uuid, label: CreateLabel) -> Result<Label> {
        let created = sqlx::query_as::<_, Label>(
            r#"
            INSERT INTO calendar.labels (tenant_id, workspace_id, name, color)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(label.workspace_id)
        .bind(&label.name)
        .bind(&label.color)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Delete a label.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.labels WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Add label to entity.
    pub async fn add_to_entity(
        pool: &PgPool,
        label_id: Uuid,
        entity_type: &str,
        entity_id: Uuid,
    ) -> Result<EntityLabel> {
        let created = sqlx::query_as::<_, EntityLabel>(
            r#"
            INSERT INTO calendar.entity_labels (label_id, entity_type, entity_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (label_id, entity_type, entity_id) DO NOTHING
            RETURNING *
            "#,
        )
        .bind(label_id)
        .bind(entity_type)
        .bind(entity_id)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Remove label from entity.
    pub async fn remove_from_entity(
        pool: &PgPool,
        label_id: Uuid,
        entity_type: &str,
        entity_id: Uuid,
    ) -> Result<()> {
        sqlx::query(
            "DELETE FROM calendar.entity_labels WHERE label_id = $1 AND entity_type = $2 AND entity_id = $3",
        )
        .bind(label_id)
        .bind(entity_type)
        .bind(entity_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Get labels for entity.
    pub async fn get_for_entity(
        pool: &PgPool,
        entity_type: &str,
        entity_id: Uuid,
    ) -> Result<Vec<Label>> {
        let labels = sqlx::query_as::<_, Label>(
            r#"
            SELECT l.* FROM calendar.labels l
            INNER JOIN calendar.entity_labels el ON l.id = el.label_id
            WHERE el.entity_type = $1 AND el.entity_id = $2
            ORDER BY l.name
            "#,
        )
        .bind(entity_type)
        .bind(entity_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(labels)
    }
}

// ============================================================================
// Tenant Task Repository
// ============================================================================

/// Repository for tenant task operations.
pub struct TenantTaskRepository;

impl TenantTaskRepository {
    /// Find task by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<TenantTask>> {
        let task = sqlx::query_as::<_, TenantTask>(
            "SELECT * FROM calendar.tasks WHERE id = $1 AND deleted_at IS NULL",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(task)
    }

    /// List tasks for a project.
    pub async fn list_by_project(pool: &PgPool, project_id: Uuid) -> Result<Vec<TenantTask>> {
        let tasks = sqlx::query_as::<_, TenantTask>(
            r#"
            SELECT * FROM calendar.tasks
            WHERE project_id = $1 AND deleted_at IS NULL
            ORDER BY position, created_at
            "#,
        )
        .bind(project_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(tasks)
    }

    /// List subtasks for a parent task.
    pub async fn list_subtasks(pool: &PgPool, parent_task_id: Uuid) -> Result<Vec<TenantTask>> {
        let tasks = sqlx::query_as::<_, TenantTask>(
            r#"
            SELECT * FROM calendar.tasks
            WHERE parent_task_id = $1 AND deleted_at IS NULL
            ORDER BY position, created_at
            "#,
        )
        .bind(parent_task_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(tasks)
    }

    /// Create a new task.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        created_by: Uuid,
        task: CreateTenantTask,
    ) -> Result<TenantTask> {
        let created = sqlx::query_as::<_, TenantTask>(
            r#"
            INSERT INTO calendar.tasks (
                tenant_id, calendar_id, project_id, parent_task_id, title, description,
                priority, position, due_date, estimated_hours, assigned_to, template_id, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 0), COALESCE($8, 0),
                    $9, $10, $11, $12, $13)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(task.calendar_id)
        .bind(task.project_id)
        .bind(task.parent_task_id)
        .bind(&task.title)
        .bind(&task.description)
        .bind(task.priority)
        .bind(task.position)
        .bind(task.due_date)
        .bind(task.estimated_hours)
        .bind(task.assigned_to)
        .bind(task.template_id)
        .bind(created_by)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Update task status.
    pub async fn update_status(pool: &PgPool, id: Uuid, status: &str) -> Result<TenantTask> {
        let completed_at = if status == "completed" {
            "NOW()"
        } else {
            "NULL"
        };

        let updated = sqlx::query_as::<_, TenantTask>(&format!(
            r#"
            UPDATE calendar.tasks
            SET status = $2,
                completed_at = {},
                updated_at = NOW()
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING *
            "#,
            completed_at
        ))
        .bind(id)
        .bind(status)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(updated)
    }

    /// Update task position (for drag & drop).
    pub async fn update_position(pool: &PgPool, id: Uuid, position: i32) -> Result<()> {
        sqlx::query("UPDATE calendar.tasks SET position = $2, updated_at = NOW() WHERE id = $1")
            .bind(id)
            .bind(position)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Soft delete a task.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE calendar.tasks SET deleted_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}

// ============================================================================
// Tenant Calendar Repository
// ============================================================================

/// Repository for tenant calendar operations.
pub struct TenantCalendarRepository;

impl TenantCalendarRepository {
    /// Find calendar by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<TenantCalendar>> {
        let calendar =
            sqlx::query_as::<_, TenantCalendar>("SELECT * FROM calendar.calendars WHERE id = $1")
                .bind(id)
                .fetch_optional(pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;
        Ok(calendar)
    }

    /// List calendars for a tenant.
    pub async fn list_by_tenant(
        pool: &PgPool,
        tenant_id: Uuid,
        calendar_type: Option<&str>,
    ) -> Result<Vec<TenantCalendar>> {
        let calendars = if let Some(ct) = calendar_type {
            sqlx::query_as::<_, TenantCalendar>(
                "SELECT * FROM calendar.calendars WHERE tenant_id = $1 AND calendar_type = $2 ORDER BY name",
            )
            .bind(tenant_id)
            .bind(ct)
            .fetch_all(pool)
            .await
        } else {
            sqlx::query_as::<_, TenantCalendar>(
                "SELECT * FROM calendar.calendars WHERE tenant_id = $1 ORDER BY name",
            )
            .bind(tenant_id)
            .fetch_all(pool)
            .await
        }
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(calendars)
    }

    /// List calendars for a user (owned + shared).
    pub async fn list_by_user(pool: &PgPool, user_id: Uuid) -> Result<Vec<TenantCalendar>> {
        let calendars = sqlx::query_as::<_, TenantCalendar>(
            r#"
            SELECT DISTINCT c.* FROM calendar.calendars c
            LEFT JOIN calendar.calendar_members cm ON c.id = cm.calendar_id
            WHERE c.owner_id = $1 OR cm.user_id = $1 OR c.is_public = TRUE
            ORDER BY c.is_default DESC, c.name
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(calendars)
    }

    /// Create a new calendar.
    pub async fn create(
        pool: &PgPool,
        tenant_id: Uuid,
        owner_id: Uuid,
        calendar: CreateTenantCalendar,
    ) -> Result<TenantCalendar> {
        let created = sqlx::query_as::<_, TenantCalendar>(
            r#"
            INSERT INTO calendar.calendars (
                tenant_id, workspace_id, owner_id, name, description, timezone, color,
                calendar_type, is_shared, is_public
            )
            VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'UTC'), COALESCE($7, '#3B82F6'),
                    COALESCE($8, 'personal'), COALESCE($9, FALSE), COALESCE($10, FALSE))
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(calendar.workspace_id)
        .bind(owner_id)
        .bind(&calendar.name)
        .bind(&calendar.description)
        .bind(&calendar.timezone)
        .bind(&calendar.color)
        .bind(&calendar.calendar_type)
        .bind(calendar.is_shared)
        .bind(calendar.is_public)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(created)
    }

    /// Delete a calendar.
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.calendars WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }
}
