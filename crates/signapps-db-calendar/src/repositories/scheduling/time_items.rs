//! TimeItemRepository — time item CRUD and query operations.

use crate::models::{
    CreateTimeItem, TimeItem, TimeItemWithRelations, TimeItemsQuery, TimeItemsResponse,
    UpdateTimeItem,
};
use signapps_db_shared::DatabasePool;
use chrono::{DateTime, Utc};
use signapps_common::Result;
use uuid::Uuid;

use super::{
    RecurrenceRuleRepository, TimeItemDependencyRepository, TimeItemGroupRepository,
    TimeItemUserRepository,
};

/// Repository for time item CRUD and query operations.
pub struct TimeItemRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> TimeItemRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Find a time item by ID.
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<TimeItem>> {
        let item = sqlx::query_as::<_, TimeItem>(
            "SELECT * FROM scheduling.time_items WHERE id = $1 AND deleted_at IS NULL",
        )
        .bind(id)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(item)
    }

    /// Find a time item with all relations.
    pub async fn find_by_id_with_relations(
        &self,
        id: Uuid,
    ) -> Result<Option<TimeItemWithRelations>> {
        let item = self.find_by_id(id).await?;

        match item {
            Some(item) => {
                let users_repo = TimeItemUserRepository::new(self.pool);
                let groups_repo = TimeItemGroupRepository::new(self.pool);
                let deps_repo = TimeItemDependencyRepository::new(self.pool);
                let recurrence_repo = RecurrenceRuleRepository::new(self.pool);

                let users = users_repo.list_users(id).await?;
                let groups = groups_repo.list_groups(id).await?;
                let dependencies = deps_repo.list_dependencies(id).await?;
                let recurrence = recurrence_repo.find_by_time_item(id).await?;

                Ok(Some(TimeItemWithRelations {
                    item,
                    users,
                    groups,
                    dependencies,
                    recurrence,
                }))
            },
            None => Ok(None),
        }
    }

    /// Query time items with filters.
    pub async fn query(
        &self,
        tenant_id: Uuid,
        owner_id: Uuid,
        query: &TimeItemsQuery,
    ) -> Result<TimeItemsResponse> {
        let limit = query.limit.unwrap_or(100).min(500);
        let offset = query.offset.unwrap_or(0);

        // Parse optional date filters
        let start_date: Option<DateTime<Utc>> = query
            .start
            .as_ref()
            .and_then(|s| s.parse::<DateTime<Utc>>().ok());
        let end_date: Option<DateTime<Utc>> = query
            .end
            .as_ref()
            .and_then(|s| s.parse::<DateTime<Utc>>().ok());

        // Build optional WHERE fragments (safe: values are whitelisted or parameterised)
        let mut extra_where = String::new();

        if start_date.is_some() {
            extra_where.push_str(
                " AND (t.start_time >= $5 OR (t.start_time IS NULL AND t.deadline >= $5))",
            );
        }
        if end_date.is_some() {
            extra_where.push_str(
                " AND (t.start_time <= $6 OR (t.start_time IS NULL AND t.deadline <= $6))",
            );
        }

        // Unscheduled only
        if query.unscheduled_only == Some(true) {
            extra_where.push_str(" AND t.start_time IS NULL");
        }

        // Exclude completed/cancelled unless explicitly requested
        if query.include_completed != Some(true) {
            extra_where.push_str(" AND t.status != 'done'");
        }
        if query.include_cancelled != Some(true) {
            extra_where.push_str(" AND t.status != 'cancelled'");
        }

        // Search filter (parameterised via $7)
        let search_pattern = query.search.as_ref().map(|s| format!("%{}%", s));
        if search_pattern.is_some() {
            extra_where.push_str(" AND (t.title ILIKE $7 OR t.description ILIKE $7)");
        }

        // Sort (whitelisted column names only)
        let sort_col = match query.sort_by.as_deref().unwrap_or("start_time") {
            "title" => "t.title",
            "priority" => "t.priority",
            "status" => "t.status",
            "deadline" => "t.deadline",
            "created_at" => "t.created_at",
            _ => "t.start_time",
        };
        let sort_dir = if query.sort_order.as_deref().unwrap_or("ASC").to_uppercase() == "DESC" {
            "DESC"
        } else {
            "ASC"
        };

        let base_where = format!(
            "t.tenant_id = $1 AND (t.owner_id = $2 OR EXISTS (SELECT 1 FROM scheduling.time_item_users tu WHERE tu.time_item_id = t.id AND tu.user_id = $2)) AND t.deleted_at IS NULL{}",
            extra_where
        );

        // Count query
        let count_sql = format!(
            "SELECT COUNT(t.id) FROM scheduling.time_items t \
             WHERE {}",
            base_where
        );
        let mut count_q = sqlx::query_scalar::<_, i64>(&count_sql)
            .bind(tenant_id)
            .bind(owner_id)
            .bind(limit)    // $3 (unused in count but keeps indices aligned)
            .bind(offset); // $4
        if let Some(sd) = start_date {
            count_q = count_q.bind(sd);
        } // $5
        if let Some(ed) = end_date {
            count_q = count_q.bind(ed);
        } // $6
        if let Some(ref sp) = search_pattern {
            count_q = count_q.bind(sp);
        } // $7

        let total = count_q.fetch_one(self.pool.inner()).await?;

        // Items query
        let items_sql = format!(
            "SELECT t.* FROM scheduling.time_items t \
             WHERE {} ORDER BY {} {} NULLS LAST LIMIT $3 OFFSET $4",
            base_where, sort_col, sort_dir
        );
        let mut items_q = sqlx::query_as::<_, TimeItem>(&items_sql)
            .bind(tenant_id)
            .bind(owner_id)
            .bind(limit)
            .bind(offset);
        if let Some(sd) = start_date {
            items_q = items_q.bind(sd);
        }
        if let Some(ed) = end_date {
            items_q = items_q.bind(ed);
        }
        if let Some(ref sp) = search_pattern {
            items_q = items_q.bind(sp);
        }

        let items = items_q.fetch_all(self.pool.inner()).await?;

        Ok(TimeItemsResponse {
            items,
            total,
            limit,
            offset,
        })
    }

    /// List time items for a user in a date range.
    pub async fn list_by_date_range(
        &self,
        owner_id: Uuid,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Result<Vec<TimeItem>> {
        let items = sqlx::query_as::<_, TimeItem>(
            r#"
            SELECT * FROM scheduling.time_items
            WHERE owner_id = $1
              AND deleted_at IS NULL
              AND (
                  (start_time IS NOT NULL AND start_time < $3 AND (end_time IS NULL OR end_time > $2))
                  OR (start_time IS NULL AND deadline BETWEEN $2 AND $3)
              )
            ORDER BY COALESCE(start_time, deadline) ASC
            "#,
        )
        .bind(owner_id)
        .bind(start)
        .bind(end)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(items)
    }

    /// List time items for a list of users in a date range. (For Availability Finder)
    pub async fn fetch_events_for_users(
        &self,
        tenant_id: Uuid,
        user_ids: &[Uuid],
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Result<Vec<TimeItem>> {
        if user_ids.is_empty() {
            return Ok(vec![]);
        }

        // We use ANY to check if owner is in the array, OR if user is in time_item_users array
        let items = sqlx::query_as::<_, TimeItem>(
            r#"
            SELECT t.* FROM scheduling.time_items t
            WHERE t.tenant_id = $1
              AND t.deleted_at IS NULL
              AND (t.owner_id = ANY($2) OR EXISTS (SELECT 1 FROM scheduling.time_item_users tu WHERE tu.time_item_id = t.id AND tu.user_id = ANY($2)))
              AND (
                  (t.start_time IS NOT NULL AND t.start_time < $4 AND (t.end_time IS NULL OR t.end_time > $3))
                  OR (t.start_time IS NULL AND t.deadline BETWEEN $3 AND $4)
              )
            ORDER BY COALESCE(t.start_time, t.deadline) ASC
            "#,
        )
        .bind(tenant_id)
        .bind(user_ids)
        .bind(start)
        .bind(end)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(items)
    }

    /// List unscheduled tasks for a user.
    pub async fn list_unscheduled(&self, owner_id: Uuid) -> Result<Vec<TimeItem>> {
        let items = sqlx::query_as::<_, TimeItem>(
            r#"
            SELECT t.* FROM scheduling.time_items t
            WHERE t.deleted_at IS NULL
              AND (t.owner_id = $1 OR EXISTS (SELECT 1 FROM scheduling.time_item_users tu WHERE tu.time_item_id = t.id AND tu.user_id = $1))
              AND t.start_time IS NULL
              AND t.item_type = 'task'
              AND t.status NOT IN ('done', 'cancelled')
            ORDER BY COALESCE(t.deadline, t.created_at) ASC
            "#,
        )
        .bind(owner_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(items)
    }

    /// List children of a parent time item.
    pub async fn list_children(&self, parent_id: Uuid) -> Result<Vec<TimeItem>> {
        let items = sqlx::query_as::<_, TimeItem>(
            "SELECT * FROM scheduling.time_items WHERE parent_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC",
        )
        .bind(parent_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(items)
    }

    /// Create a new time item.
    pub async fn create(
        &self,
        tenant_id: Uuid,
        owner_id: Uuid,
        created_by: Uuid,
        item: CreateTimeItem,
    ) -> Result<TimeItem> {
        let created = sqlx::query_as::<_, TimeItem>(
            r#"
            INSERT INTO scheduling.time_items (
                item_type, title, description, tags, color,
                start_time, end_time, deadline, duration_minutes, all_day, timezone,
                location_name, location_address, location_url,
                tenant_id, project_id, owner_id,
                scope, visibility, status, priority,
                focus_level, energy_required, value_score,
                estimated_pomodoros, preferred_time_of_day,
                min_block_duration_minutes, max_block_duration_minutes,
                parent_id, resource_id, metadata, created_by
            )
            VALUES (
                $1, $2, $3, COALESCE($4, '{}'), $5,
                $6, $7, $8, $9, COALESCE($10, false), COALESCE($11, 'UTC'),
                $12, $13, $14,
                $15, $16, $17,
                COALESCE($18, 'moi'), COALESCE($19, 'private'), COALESCE($20, 'todo'), $21,
                $22, $23, $24,
                $25, $26,
                $27, $28,
                $29, $30, $31, $32
            )
            RETURNING *
            "#,
        )
        .bind(&item.item_type)
        .bind(&item.title)
        .bind(&item.description)
        .bind(item.tags.clone().unwrap_or_default())
        .bind(&item.color)
        .bind(item.start_time)
        .bind(item.end_time)
        .bind(item.deadline)
        .bind(item.duration_minutes)
        .bind(item.all_day)
        .bind(&item.timezone)
        .bind(item.location.as_ref().and_then(|l| l.name.clone()))
        .bind(item.location.as_ref().and_then(|l| l.address.clone()))
        .bind(item.location.as_ref().and_then(|l| l.url.clone()))
        .bind(tenant_id)
        .bind(item.project_id)
        .bind(owner_id)
        .bind(&item.scope)
        .bind(&item.visibility)
        .bind(&item.status)
        .bind(&item.priority)
        .bind(&item.focus_level)
        .bind(&item.energy_required)
        .bind(item.value_score)
        .bind(item.estimated_pomodoros)
        .bind(&item.preferred_time_of_day)
        .bind(item.min_block_duration_minutes)
        .bind(item.max_block_duration_minutes)
        .bind(item.parent_id)
        .bind(item.resource_id)
        .bind(&item.metadata)
        .bind(created_by)
        .fetch_one(self.pool.inner())
        .await?;

        // Create recurrence rule if provided
        if let Some(recurrence) = &item.recurrence {
            let recurrence_repo = RecurrenceRuleRepository::new(self.pool);
            recurrence_repo
                .create(created.id, recurrence.clone())
                .await?;
        }

        Ok(created)
    }

    /// Update a time item.
    pub async fn update(&self, id: Uuid, item: UpdateTimeItem) -> Result<TimeItem> {
        let updated = sqlx::query_as::<_, TimeItem>(
            r#"
            UPDATE scheduling.time_items
            SET
                item_type = COALESCE($2, item_type),
                title = COALESCE($3, title),
                description = COALESCE($4, description),
                tags = COALESCE($5, tags),
                color = COALESCE($6, color),
                start_time = COALESCE($7, start_time),
                end_time = COALESCE($8, end_time),
                deadline = COALESCE($9, deadline),
                duration_minutes = COALESCE($10, duration_minutes),
                all_day = COALESCE($11, all_day),
                timezone = COALESCE($12, timezone),
                location_name = COALESCE($13, location_name),
                location_address = COALESCE($14, location_address),
                location_url = COALESCE($15, location_url),
                project_id = COALESCE($16, project_id),
                scope = COALESCE($17, scope),
                visibility = COALESCE($18, visibility),
                status = COALESCE($19, status),
                priority = COALESCE($20, priority),
                focus_level = COALESCE($21, focus_level),
                energy_required = COALESCE($22, energy_required),
                value_score = COALESCE($23, value_score),
                estimated_pomodoros = COALESCE($24, estimated_pomodoros),
                actual_pomodoros = COALESCE($25, actual_pomodoros),
                preferred_time_of_day = COALESCE($26, preferred_time_of_day),
                min_block_duration_minutes = COALESCE($27, min_block_duration_minutes),
                max_block_duration_minutes = COALESCE($28, max_block_duration_minutes),
                resource_id = COALESCE($29, resource_id),
                metadata = COALESCE($30, metadata),
                updated_at = NOW()
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&item.item_type)
        .bind(&item.title)
        .bind(&item.description)
        .bind(&item.tags)
        .bind(&item.color)
        .bind(item.start_time)
        .bind(item.end_time)
        .bind(item.deadline)
        .bind(item.duration_minutes)
        .bind(item.all_day)
        .bind(&item.timezone)
        .bind(item.location.as_ref().and_then(|l| l.name.clone()))
        .bind(item.location.as_ref().and_then(|l| l.address.clone()))
        .bind(item.location.as_ref().and_then(|l| l.url.clone()))
        .bind(item.project_id)
        .bind(&item.scope)
        .bind(&item.visibility)
        .bind(&item.status)
        .bind(&item.priority)
        .bind(&item.focus_level)
        .bind(&item.energy_required)
        .bind(item.value_score)
        .bind(item.estimated_pomodoros)
        .bind(item.actual_pomodoros)
        .bind(&item.preferred_time_of_day)
        .bind(item.min_block_duration_minutes)
        .bind(item.max_block_duration_minutes)
        .bind(item.resource_id)
        .bind(&item.metadata)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(updated)
    }

    /// Move a time item to a new time.
    pub async fn move_item(
        &self,
        id: Uuid,
        start_time: DateTime<Utc>,
        end_time: Option<DateTime<Utc>>,
        duration_minutes: Option<i32>,
    ) -> Result<TimeItem> {
        let updated = sqlx::query_as::<_, TimeItem>(
            r#"
            UPDATE scheduling.time_items
            SET
                start_time = $2,
                end_time = COALESCE($3, end_time),
                duration_minutes = COALESCE($4, duration_minutes),
                updated_at = NOW()
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(start_time)
        .bind(end_time)
        .bind(duration_minutes)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(updated)
    }

    /// Update time item status.
    pub async fn update_status(&self, id: Uuid, status: &str) -> Result<TimeItem> {
        let updated = sqlx::query_as::<_, TimeItem>(
            "UPDATE scheduling.time_items SET status = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *",
        )
        .bind(id)
        .bind(status)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(updated)
    }

    /// Soft delete a time item.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE scheduling.time_items SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Hard delete a time item (permanent).
    pub async fn delete_permanent(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM scheduling.time_items WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }
}
