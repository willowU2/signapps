//! Calendar repository for database operations.

use crate::models::*;
use crate::DatabasePool;
use signapps_common::Result;
use uuid::Uuid;

// ============================================================================
// Calendar Repository
// ============================================================================
/// Repository for calendar CRUD and membership operations.
pub struct CalendarRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> CalendarRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Find calendar by ID.
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<Calendar>> {
        let calendar =
            sqlx::query_as::<_, Calendar>("SELECT * FROM calendar.calendars WHERE id = $1")
                .bind(id)
                .fetch_optional(self.pool.inner())
                .await?;

        Ok(calendar)
    }

    /// List all calendars for a user (owned + shared).
    pub async fn list_for_user(&self, user_id: Uuid) -> Result<Vec<Calendar>> {
        let calendars = sqlx::query_as::<_, Calendar>(
            r#"
            SELECT DISTINCT c.* FROM calendar.calendars c
            LEFT JOIN calendar.calendar_members m ON c.id = m.calendar_id
            WHERE c.owner_id = $1 OR m.user_id = $1
            ORDER BY c.created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(calendars)
    }

    /// List calendars owned by user.
    pub async fn list_owned(&self, user_id: Uuid) -> Result<Vec<Calendar>> {
        let calendars = sqlx::query_as::<_, Calendar>(
            "SELECT * FROM calendar.calendars WHERE owner_id = $1 ORDER BY created_at DESC",
        )
        .bind(user_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(calendars)
    }

    /// Create a new calendar.
    pub async fn create(&self, calendar: CreateCalendar, owner_id: Uuid) -> Result<Calendar> {
        let created = sqlx::query_as::<_, Calendar>(
            r#"
            INSERT INTO calendar.calendars (owner_id, name, description, timezone, color, is_shared)
            VALUES ($1, $2, $3, COALESCE($4, 'UTC'), COALESCE($5, '#3b82f6'), COALESCE($6, false))
            RETURNING *
            "#,
        )
        .bind(owner_id)
        .bind(&calendar.name)
        .bind(&calendar.description)
        .bind(&calendar.timezone)
        .bind(&calendar.color)
        .bind(calendar.is_shared.unwrap_or(false))
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Update a calendar.
    pub async fn update(&self, id: Uuid, calendar: UpdateCalendar) -> Result<Calendar> {
        let updated = sqlx::query_as::<_, Calendar>(
            r#"
            UPDATE calendar.calendars
            SET
                name = COALESCE($2, name),
                description = COALESCE($3, description),
                timezone = COALESCE($4, timezone),
                color = COALESCE($5, color),
                is_shared = COALESCE($6, is_shared),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&calendar.name)
        .bind(&calendar.description)
        .bind(&calendar.timezone)
        .bind(&calendar.color)
        .bind(calendar.is_shared)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(updated)
    }

    /// Delete a calendar and all its content.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.calendars WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }
}

// ============================================================================
// Calendar Member Repository (Sharing)
// ============================================================================
/// Repository for managing calendar sharing and member roles.
pub struct CalendarMemberRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> CalendarMemberRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Get all members of a calendar.
    pub async fn list_members(&self, calendar_id: Uuid) -> Result<Vec<CalendarMemberWithUser>> {
        let members = sqlx::query_as::<_, CalendarMemberWithUser>(
            r#"
            SELECT
                cm.id, cm.user_id, u.username, u.email, cm.role
            FROM calendar.calendar_members cm
            JOIN identity.users u ON cm.user_id = u.id
            WHERE cm.calendar_id = $1
            ORDER BY cm.created_at
            "#,
        )
        .bind(calendar_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(members)
    }

    /// Add a member to a calendar.
    pub async fn add_member(
        &self,
        calendar_id: Uuid,
        user_id: Uuid,
        role: &str,
    ) -> Result<CalendarMember> {
        let member = sqlx::query_as::<_, CalendarMember>(
            r#"
            INSERT INTO calendar.calendar_members (calendar_id, user_id, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (calendar_id, user_id) DO UPDATE SET
                role = $3,
                updated_at = NOW()
            RETURNING *
            "#,
        )
        .bind(calendar_id)
        .bind(user_id)
        .bind(role)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(member)
    }

    /// Remove a member from a calendar.
    pub async fn remove_member(&self, calendar_id: Uuid, user_id: Uuid) -> Result<()> {
        sqlx::query(
            "DELETE FROM calendar.calendar_members WHERE calendar_id = $1 AND user_id = $2",
        )
        .bind(calendar_id)
        .bind(user_id)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Update member role.
    pub async fn update_role(&self, calendar_id: Uuid, user_id: Uuid, role: &str) -> Result<()> {
        sqlx::query("UPDATE calendar.calendar_members SET role = $3, updated_at = NOW() WHERE calendar_id = $1 AND user_id = $2")
            .bind(calendar_id)
            .bind(user_id)
            .bind(role)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }
}

// ============================================================================
// Event Repository
// ============================================================================
/// Repository for calendar event CRUD operations.
pub struct EventRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> EventRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Find event by ID.
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<Event>> {
        let event = sqlx::query_as::<_, Event>(
            "SELECT * FROM calendar.events WHERE id = $1 AND is_deleted = false",
        )
        .bind(id)
        .fetch_optional(self.pool.inner())
        .await?;

        Ok(event)
    }

    /// List events in a calendar within a date range.
    pub async fn list_by_date_range(
        &self,
        calendar_id: Uuid,
        start: chrono::DateTime<chrono::Utc>,
        end: chrono::DateTime<chrono::Utc>,
    ) -> Result<Vec<Event>> {
        let events = sqlx::query_as::<_, Event>(
            r#"
            SELECT * FROM calendar.events
            WHERE calendar_id = $1
              AND is_deleted = false
              AND start_time < $3
              AND end_time > $2
            ORDER BY start_time
            "#,
        )
        .bind(calendar_id)
        .bind(start)
        .bind(end)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(events)
    }

    /// List all events in a calendar.
    pub async fn list_by_calendar(&self, calendar_id: Uuid) -> Result<Vec<Event>> {
        let events = sqlx::query_as::<_, Event>(
            "SELECT * FROM calendar.events WHERE calendar_id = $1 AND is_deleted = false ORDER BY start_time",
        )
        .bind(calendar_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(events)
    }

    /// Create a new event.
    pub async fn create(
        &self,
        calendar_id: Uuid,
        event: CreateEvent,
        created_by: Uuid,
    ) -> Result<Event> {
        let created = sqlx::query_as::<_, Event>(
            r#"
            INSERT INTO calendar.events
            (calendar_id, title, description, location, start_time, end_time, rrule, timezone,
             created_by, is_all_day, event_type, scope, status, priority, parent_event_id,
             resource_id, category_id, leave_type, presence_mode, approval_by, approval_comment,
             energy_level, cron_expression, cron_target, assigned_to, project_id, tags)
            VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'UTC'), $9, COALESCE($10, false),
                    $11::calendar.event_type, $12::calendar.event_scope, $13::calendar.event_status,
                    $14::calendar.event_priority, $15, $16, $17, $18::calendar.leave_type,
                    $19::calendar.presence_mode, $20, $21, $22::calendar.energy_level,
                    $23, $24, $25, $26, COALESCE($27, '{}'))
            RETURNING *
            "#,
        )
        .bind(calendar_id)
        .bind(&event.title)
        .bind(&event.description)
        .bind(&event.location)
        .bind(event.start_time)
        .bind(event.end_time)
        .bind(&event.rrule)
        .bind(&event.timezone)
        .bind(created_by)
        .bind(event.is_all_day.unwrap_or(false))
        .bind(event.event_type.as_deref())
        .bind(event.scope.as_deref())
        .bind(event.status.as_deref())
        .bind(event.priority.as_deref())
        .bind(event.parent_event_id)
        .bind(event.resource_id)
        .bind(event.category_id)
        .bind(event.leave_type.as_deref())
        .bind(event.presence_mode.as_deref())
        .bind(event.approval_by)
        .bind(event.approval_comment.as_deref())
        .bind(event.energy_level.as_deref())
        .bind(event.cron_expression.as_deref())
        .bind(event.cron_target.as_deref())
        .bind(event.assigned_to)
        .bind(event.project_id)
        .bind(event.tags.as_deref())
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Update an event.
    pub async fn update(&self, id: Uuid, event: UpdateEvent) -> Result<Event> {
        let updated = sqlx::query_as::<_, Event>(
            r#"
            UPDATE calendar.events
            SET
                title = COALESCE($2, title),
                description = COALESCE($3, description),
                location = COALESCE($4, location),
                start_time = COALESCE($5, start_time),
                end_time = COALESCE($6, end_time),
                rrule = COALESCE($7, rrule),
                timezone = COALESCE($8, timezone),
                is_all_day = COALESCE($9, is_all_day),
                event_type = COALESCE($10::calendar.event_type, event_type),
                scope = COALESCE($11::calendar.event_scope, scope),
                status = COALESCE($12::calendar.event_status, status),
                priority = COALESCE($13::calendar.event_priority, priority),
                parent_event_id = COALESCE($14, parent_event_id),
                resource_id = COALESCE($15, resource_id),
                category_id = COALESCE($16, category_id),
                leave_type = COALESCE($17::calendar.leave_type, leave_type),
                presence_mode = COALESCE($18::calendar.presence_mode, presence_mode),
                approval_by = COALESCE($19, approval_by),
                approval_comment = COALESCE($20, approval_comment),
                energy_level = COALESCE($21::calendar.energy_level, energy_level),
                cron_expression = COALESCE($22, cron_expression),
                cron_target = COALESCE($23, cron_target),
                assigned_to = COALESCE($24, assigned_to),
                project_id = COALESCE($25, project_id),
                tags = COALESCE($26, tags),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&event.title)
        .bind(&event.description)
        .bind(&event.location)
        .bind(event.start_time)
        .bind(event.end_time)
        .bind(&event.rrule)
        .bind(&event.timezone)
        .bind(event.is_all_day)
        .bind(event.event_type.as_deref())
        .bind(event.scope.as_deref())
        .bind(event.status.as_deref())
        .bind(event.priority.as_deref())
        .bind(event.parent_event_id)
        .bind(event.resource_id)
        .bind(event.category_id)
        .bind(event.leave_type.as_deref())
        .bind(event.presence_mode.as_deref())
        .bind(event.approval_by)
        .bind(event.approval_comment.as_deref())
        .bind(event.energy_level.as_deref())
        .bind(event.cron_expression.as_deref())
        .bind(event.cron_target.as_deref())
        .bind(event.assigned_to)
        .bind(event.project_id)
        .bind(event.tags.as_deref())
        .fetch_one(self.pool.inner())
        .await?;

        Ok(updated)
    }

    /// Soft delete (mark as deleted).
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE calendar.events SET is_deleted = true, updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }
}

// ============================================================================
// Event Attendee Repository
// ============================================================================
/// Repository for event attendee and RSVP operations.
pub struct EventAttendeeRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> EventAttendeeRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Get all attendees for an event.
    pub async fn list_attendees(&self, event_id: Uuid) -> Result<Vec<EventAttendee>> {
        let attendees = sqlx::query_as::<_, EventAttendee>(
            "SELECT * FROM calendar.event_attendees WHERE event_id = $1 ORDER BY created_at",
        )
        .bind(event_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(attendees)
    }

    /// Add an attendee to an event.
    pub async fn add_attendee(
        &self,
        event_id: Uuid,
        attendee: AddEventAttendee,
    ) -> Result<EventAttendee> {
        let added = sqlx::query_as::<_, EventAttendee>(
            r#"
            INSERT INTO calendar.event_attendees (event_id, user_id, email)
            VALUES ($1, $2, $3)
            ON CONFLICT (event_id, user_id) DO UPDATE SET
                email = COALESCE($3, event_attendees.email),
                updated_at = NOW()
            RETURNING *
            "#,
        )
        .bind(event_id)
        .bind(attendee.user_id)
        .bind(&attendee.email)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(added)
    }

    /// Update attendee RSVP status.
    pub async fn update_rsvp(&self, attendee_id: Uuid, status: &str) -> Result<()> {
        sqlx::query(
            "UPDATE calendar.event_attendees SET rsvp_status = $2, response_date = NOW(), updated_at = NOW() WHERE id = $1",
        )
        .bind(attendee_id)
        .bind(status)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Remove an attendee.
    pub async fn remove_attendee(&self, attendee_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.event_attendees WHERE id = $1")
            .bind(attendee_id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }
}

// ============================================================================
// Task Repository
// ============================================================================
/// Repository for hierarchical task CRUD operations.
pub struct TaskRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> TaskRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Find task by ID.
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<Task>> {
        let task = sqlx::query_as::<_, Task>("SELECT * FROM calendar.tasks WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool.inner())
            .await?;

        Ok(task)
    }

    /// List all tasks in a calendar.
    pub async fn list_by_calendar(&self, calendar_id: Uuid) -> Result<Vec<Task>> {
        let tasks = sqlx::query_as::<_, Task>(
            "SELECT * FROM calendar.tasks WHERE calendar_id = $1 ORDER BY parent_task_id NULLS FIRST, position ASC, created_at DESC",
        )
        .bind(calendar_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(tasks)
    }

    /// List root tasks (parent_task_id IS NULL).
    pub async fn list_root_tasks(&self, calendar_id: Uuid) -> Result<Vec<Task>> {
        let tasks = sqlx::query_as::<_, Task>(
            "SELECT * FROM calendar.tasks WHERE calendar_id = $1 AND parent_task_id IS NULL ORDER BY position ASC, priority DESC",
        )
        .bind(calendar_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(tasks)
    }

    /// List child tasks.
    pub async fn list_children(&self, parent_task_id: Uuid) -> Result<Vec<Task>> {
        let tasks = sqlx::query_as::<_, Task>(
            "SELECT * FROM calendar.tasks WHERE parent_task_id = $1 ORDER BY position ASC, priority DESC",
        )
        .bind(parent_task_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(tasks)
    }

    /// Get all descendants (recursive).
    pub async fn get_all_descendants(&self, task_id: Uuid) -> Result<Vec<Uuid>> {
        let rows = sqlx::query_scalar::<_, Uuid>(
            r#"
            WITH RECURSIVE descendants AS (
                SELECT id FROM calendar.tasks WHERE parent_task_id = $1
                UNION ALL
                SELECT t.id FROM calendar.tasks t
                JOIN descendants d ON t.parent_task_id = d.id
            )
            SELECT id FROM descendants
            "#,
        )
        .bind(task_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(rows)
    }

    /// Create a new task.
    pub async fn create(
        &self,
        calendar_id: Uuid,
        task: CreateTask,
        created_by: Uuid,
    ) -> Result<Task> {
        let created = sqlx::query_as::<_, Task>(
            r#"
            INSERT INTO calendar.tasks
            (calendar_id, parent_task_id, title, description, priority, position, due_date, assigned_to, created_by)
            VALUES ($1, $2, $3, $4, COALESCE($5, 0), COALESCE($6, 0), $7, $8, $9)
            RETURNING *
            "#,
        )
        .bind(calendar_id)
        .bind(task.parent_task_id)
        .bind(&task.title)
        .bind(&task.description)
        .bind(task.priority)
        .bind(task.position)
        .bind(task.due_date)
        .bind(task.assigned_to)
        .bind(created_by)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Update a task.
    pub async fn update(&self, id: Uuid, task: UpdateTask) -> Result<Task> {
        let updated = sqlx::query_as::<_, Task>(
            r#"
            UPDATE calendar.tasks
            SET
                title = COALESCE($2, title),
                description = COALESCE($3, description),
                status = COALESCE($4, status),
                priority = COALESCE($5, priority),
                position = COALESCE($6, position),
                due_date = COALESCE($7, due_date),
                assigned_to = COALESCE($8, assigned_to),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&task.title)
        .bind(&task.description)
        .bind(&task.status)
        .bind(task.priority)
        .bind(task.position)
        .bind(task.due_date)
        .bind(task.assigned_to)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(updated)
    }

    /// Move task to a new parent.
    pub async fn move_task(
        &self,
        id: Uuid,
        new_parent_id: Option<Uuid>,
        position: Option<i32>,
    ) -> Result<Task> {
        let updated = sqlx::query_as::<_, Task>(
            "UPDATE calendar.tasks SET parent_task_id = $2, position = COALESCE($3, position), updated_at = NOW() WHERE id = $1 RETURNING *",
        )
        .bind(id)
        .bind(new_parent_id)
        .bind(position)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(updated)
    }

    /// Mark task as completed.
    pub async fn complete(&self, id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE calendar.tasks SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .execute(self.pool.inner())
        .await?;

        Ok(())
    }

    /// Delete a task and all its children (cascade).
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        // Delete all descendants first
        let descendants = self.get_all_descendants(id).await?;
        for desc_id in descendants {
            sqlx::query("DELETE FROM calendar.task_attachments WHERE task_id = $1")
                .bind(desc_id)
                .execute(self.pool.inner())
                .await?;
        }

        // Delete the task and cascade to children
        sqlx::query("DELETE FROM calendar.tasks WHERE id = $1 OR parent_task_id IN (SELECT id FROM calendar.tasks WHERE id = $1)")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }

    // =========================================================================
    // Task Attachments
    // =========================================================================

    /// Add an attachment to a task.
    pub async fn add_attachment(
        &self,
        task_id: Uuid,
        file_url: &str,
        file_name: Option<&str>,
        file_size_bytes: Option<i32>,
    ) -> Result<TaskAttachment> {
        let attachment = sqlx::query_as::<_, TaskAttachment>(
            r#"
            INSERT INTO calendar.task_attachments (task_id, file_url, file_name, file_size_bytes)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(task_id)
        .bind(file_url)
        .bind(file_name)
        .bind(file_size_bytes)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(attachment)
    }

    /// List all attachments for a task.
    pub async fn list_attachments(&self, task_id: Uuid) -> Result<Vec<TaskAttachment>> {
        let attachments = sqlx::query_as::<_, TaskAttachment>(
            "SELECT * FROM calendar.task_attachments WHERE task_id = $1 ORDER BY created_at DESC",
        )
        .bind(task_id)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(attachments)
    }

    /// Delete an attachment.
    pub async fn delete_attachment(&self, attachment_id: Uuid) -> Result<u64> {
        let result = sqlx::query("DELETE FROM calendar.task_attachments WHERE id = $1")
            .bind(attachment_id)
            .execute(self.pool.inner())
            .await?;

        Ok(result.rows_affected())
    }
}

// ============================================================================
// Resource Repository
// ============================================================================
/// Repository for bookable resource CRUD operations.
pub struct ResourceRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> ResourceRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Find resource by ID.
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<Resource>> {
        let resource =
            sqlx::query_as::<_, Resource>("SELECT * FROM calendar.resources WHERE id = $1")
                .bind(id)
                .fetch_optional(self.pool.inner())
                .await?;

        Ok(resource)
    }

    /// List all resources.
    pub async fn list(&self) -> Result<Vec<Resource>> {
        let resources =
            sqlx::query_as::<_, Resource>("SELECT * FROM calendar.resources ORDER BY name")
                .fetch_all(self.pool.inner())
                .await?;

        Ok(resources)
    }

    /// List resources by type.
    pub async fn list_by_type(&self, resource_type: &str) -> Result<Vec<Resource>> {
        let resources = sqlx::query_as::<_, Resource>(
            "SELECT * FROM calendar.resources WHERE resource_type = $1 ORDER BY name",
        )
        .bind(resource_type)
        .fetch_all(self.pool.inner())
        .await?;

        Ok(resources)
    }

    /// Create a new resource.
    pub async fn create(
        &self,
        resource: CreateResource,
        owner_id: Option<Uuid>,
    ) -> Result<Resource> {
        let created = sqlx::query_as::<_, Resource>(
            r#"
            INSERT INTO calendar.resources (name, resource_type, description, capacity, location, owner_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(&resource.name)
        .bind(&resource.resource_type)
        .bind(&resource.description)
        .bind(resource.capacity)
        .bind(&resource.location)
        .bind(owner_id)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Update a resource.
    pub async fn update(
        &self,
        id: Uuid,
        name: Option<&str>,
        is_available: Option<bool>,
    ) -> Result<Resource> {
        let updated = sqlx::query_as::<_, Resource>(
            r#"
            UPDATE calendar.resources
            SET
                name = COALESCE($2, name),
                is_available = COALESCE($3, is_available),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(name)
        .bind(is_available)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(updated)
    }

    /// Delete a resource.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.resources WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }
}

// ============================================================================
// Floor Plan Repository
// ============================================================================
/// Repository for floor plan CRUD operations.
pub struct FloorPlanRepository<'a> {
    pool: &'a DatabasePool,
}

impl<'a> FloorPlanRepository<'a> {
    pub fn new(pool: &'a DatabasePool) -> Self {
        Self { pool }
    }

    /// Find floor plan by ID.
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<FloorPlan>> {
        let floor_plan =
            sqlx::query_as::<_, FloorPlan>("SELECT * FROM calendar.floor_plans WHERE id = $1")
                .bind(id)
                .fetch_optional(self.pool.inner())
                .await?;

        Ok(floor_plan)
    }

    /// List all floor plans.
    pub async fn list(&self) -> Result<Vec<FloorPlan>> {
        let floor_plans = sqlx::query_as::<_, FloorPlan>(
            "SELECT * FROM calendar.floor_plans ORDER BY created_at DESC",
        )
        .fetch_all(self.pool.inner())
        .await?;

        Ok(floor_plans)
    }

    /// Create a new floor plan.
    pub async fn create(&self, floor_plan: CreateFloorPlan) -> Result<FloorPlan> {
        let created = sqlx::query_as::<_, FloorPlan>(
            r#"
            INSERT INTO calendar.floor_plans (name, floor, width, height, resources, svg_content)
            VALUES ($1, $2, $3, $4, COALESCE($5, '[]'::jsonb), $6)
            RETURNING *
            "#,
        )
        .bind(&floor_plan.name)
        .bind(&floor_plan.floor)
        .bind(floor_plan.width)
        .bind(floor_plan.height)
        .bind(&floor_plan.resources)
        .bind(&floor_plan.svg_content)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(created)
    }

    /// Update a floor plan.
    pub async fn update(&self, id: Uuid, floor_plan: UpdateFloorPlan) -> Result<FloorPlan> {
        let updated = sqlx::query_as::<_, FloorPlan>(
            r#"
            UPDATE calendar.floor_plans
            SET
                name = COALESCE($2, name),
                floor = COALESCE($3, floor),
                width = COALESCE($4, width),
                height = COALESCE($5, height),
                resources = COALESCE($6, resources),
                svg_content = COALESCE($7, svg_content),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&floor_plan.name)
        .bind(&floor_plan.floor)
        .bind(floor_plan.width)
        .bind(floor_plan.height)
        .bind(&floor_plan.resources)
        .bind(&floor_plan.svg_content)
        .fetch_one(self.pool.inner())
        .await?;

        Ok(updated)
    }

    /// Delete a floor plan.
    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM calendar.floor_plans WHERE id = $1")
            .bind(id)
            .execute(self.pool.inner())
            .await?;

        Ok(())
    }
}
