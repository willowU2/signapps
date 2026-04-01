//! OpenAPI specification for the SignApps Scheduler service.

use utoipa::OpenApi;

use super::backups::{BackupConfig, BackupJob, BackupStatus, BackupType, TriggerBackupRequest};
use super::devops::{
    ChangelogEntry, CreateChangelogRequest, CreateDeploymentRequest, CreatePipelineRequest,
    Deployment, Pipeline, UpdatePipelineRequest,
};
use super::events::UpdateRsvpPayload;
use super::health_stream::{HealthSnapshot, ServiceStatus};
use super::jobs::{CleanupRequest, CleanupResponse, HealthResponse, RunJobResponse};
use crate::scheduler::service::RunningJob;
use super::tasks::{AddAttachmentRequest, TaskAttachmentResponse};
use super::time_items::{QueryUsersEventsInput, UpdateRsvpInput, UpdateStatusInput};

#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Scheduler",
        version = "1.0.0",
        description = "CRON job scheduler — jobs, tasks, calendars, events, time items, metrics, DevOps, backups"
    ),
    servers(
        (url = "http://localhost:3007", description = "Local development")
    ),
    paths(
        // Jobs — list/get/delete/enable/disable/run/runs/stats/running/cleanup/health
        // create_job and update_job omitted: CreateJob/UpdateJob lack ToSchema
        super::jobs::list_jobs,
        super::jobs::get_job,
        super::jobs::delete_job,
        super::jobs::enable_job,
        super::jobs::disable_job,
        super::jobs::run_job,
        super::jobs::get_job_runs,
        super::jobs::get_run,
        super::jobs::get_stats,
        super::jobs::get_running,
        super::jobs::cleanup_runs,
        super::jobs::health_check,
        // Calendars — list/get/delete
        // create_calendar and update_calendar omitted: CreateCalendar/UpdateCalendar
        super::calendars::list_calendars,
        super::calendars::get_calendar,
        super::calendars::delete_calendar,
        // Events — list/get/delete/list_attendees/update_rsvp/remove_attendee
        // create_event, update_event, add_attendee omitted: CreateEvent/UpdateEvent/AddEventAttendee
        super::events::list_events,
        super::events::get_event,
        super::events::delete_event,
        super::events::list_attendees,
        super::events::update_rsvp,
        super::events::remove_attendee,
        // Tasks — list/get_by_id/delete/add_attachment/list_attachments/delete_attachment
        // create and update omitted: CreateTimeItem/UpdateTimeItem
        super::tasks::list,
        super::tasks::get_by_id,
        super::tasks::delete,
        super::tasks::add_attachment,
        super::tasks::list_attachments,
        super::tasks::delete_attachment,
        // Projects — list/get_by_id/delete
        // create and update omitted: CreateProject/UpdateProject
        super::projects::list,
        super::projects::get_by_id,
        super::projects::delete,
        // TimeItems — read/delete operations with ToSchema types
        // Omitted: create_time_item, update_time_item, move_time_item,
        //   add_time_item_user, add_time_item_group, share_time_item, add_dependency,
        //   create_scheduling_resource, create_template, update_preferences
        super::time_items::list_time_items,
        super::time_items::get_time_item,
        super::time_items::delete_time_item,
        super::time_items::update_time_item_status,
        super::time_items::query_users_events,
        super::time_items::list_children,
        super::time_items::list_time_item_users,
        super::time_items::remove_time_item_user,
        super::time_items::update_rsvp,
        super::time_items::list_time_item_groups,
        super::time_items::remove_time_item_group,
        super::time_items::list_dependencies,
        super::time_items::remove_dependency,
        super::time_items::get_recurrence,
        super::time_items::delete_recurrence,
        super::time_items::list_scheduling_resources,
        super::time_items::get_scheduling_resource,
        super::time_items::delete_scheduling_resource,
        super::time_items::list_templates,
        super::time_items::get_template,
        super::time_items::delete_template,
        super::time_items::get_preferences,
        // Metrics
        super::metrics::get_workload,
        super::metrics::get_resources,
        // Tenants
        super::tenants::list_tenants,
        super::tenants::get_tenant,
        // Workspaces
        super::workspaces::list_workspaces,
        super::workspaces::get_workspace,
        // Users
        super::users::list_users,
        // Resources
        super::resources::list_resources,
        super::resources::get_resource,
        // Backups
        super::backups::list_backups,
        super::backups::trigger_backup,
        super::backups::get_backup,
        super::backups::delete_backup,
        super::backups::update_backup_config,
        super::backups::get_backup_config,
        // Notifications
        super::notifications::sse_handler,
        // Health stream
        super::health_stream::health_stream,
        // DevOps
        super::devops::list_changelog,
        super::devops::create_changelog,
        super::devops::list_pipelines,
        super::devops::create_pipeline,
        super::devops::update_pipeline,
        super::devops::list_deployments,
        super::devops::create_deployment,
    ),
    components(schemas(
        RunningJob,
        RunJobResponse,
        CleanupRequest,
        CleanupResponse,
        HealthResponse,
        AddAttachmentRequest,
        TaskAttachmentResponse,
        UpdateRsvpPayload,
        UpdateStatusInput,
        UpdateRsvpInput,
        QueryUsersEventsInput,
        BackupType,
        BackupStatus,
        BackupJob,
        BackupConfig,
        TriggerBackupRequest,
        ChangelogEntry,
        CreateChangelogRequest,
        Pipeline,
        CreatePipelineRequest,
        UpdatePipelineRequest,
        Deployment,
        CreateDeploymentRequest,
        ServiceStatus,
        HealthSnapshot,
    )),
    tags(
        (name = "Jobs", description = "CRON job management"),
        (name = "Calendars", description = "Calendar management"),
        (name = "Events", description = "Calendar event management"),
        (name = "Tasks", description = "Task management"),
        (name = "Projects", description = "Project management"),
        (name = "TimeItems", description = "Unified scheduling — time items"),
        (name = "Scheduling", description = "Scheduling resources, templates and preferences"),
        (name = "Metrics", description = "Workload and resource metrics"),
        (name = "Tenants", description = "Tenant management"),
        (name = "Workspaces", description = "Workspace management"),
        (name = "Users", description = "User management"),
        (name = "Resources", description = "Resource management"),
        (name = "Backups", description = "Automatic backup system"),
        (name = "Notifications", description = "Real-time SSE notifications"),
        (name = "Health", description = "Health check endpoints"),
        (name = "DevOps", description = "DevOps — changelog, pipelines, deployments"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct SchedulerApiDoc;

struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(c) = openapi.components.as_mut() {
            use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
            c.add_security_scheme(
                "bearer",
                SecurityScheme::Http(
                    HttpBuilder::new()
                        .scheme(HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .build(),
                ),
            );
        }
    }
}
