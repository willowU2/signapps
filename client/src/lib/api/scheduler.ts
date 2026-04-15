/**
 * Scheduler API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from "./factory";

// Get the scheduler service client (cached)
const schedulerClient = getClient(ServiceName.SCHEDULER);

// Scheduler API
export const schedulerApi = {
  // Jobs
  listJobs: () => schedulerClient.get<ScheduledJob[]>("/jobs"),
  getJob: (id: string) => schedulerClient.get<ScheduledJob>(`/jobs/${id}`),
  createJob: (data: CreateJobRequest) =>
    schedulerClient.post<ScheduledJob>("/jobs", data),
  updateJob: (id: string, data: Partial<CreateJobRequest>) =>
    schedulerClient.put<ScheduledJob>(`/jobs/${id}`, data),
  deleteJob: (id: string) => schedulerClient.delete(`/jobs/${id}`),
  enableJob: (id: string) => schedulerClient.post(`/jobs/${id}/enable`),
  disableJob: (id: string) => schedulerClient.post(`/jobs/${id}/disable`),
  runJob: (id: string) =>
    schedulerClient.post<RunJobResponse>(`/jobs/${id}/run`),

  // Job runs
  listRuns: (jobId: string, limit?: number) =>
    schedulerClient.get<JobRun[]>(`/jobs/${jobId}/runs`, { params: { limit } }),
  getRun: (runId: string) => schedulerClient.get<JobRun>(`/runs/${runId}`),

  // Stats & monitoring
  getStats: () => schedulerClient.get<JobStats>("/stats"),
  getRunning: () => schedulerClient.get<RunningJob[]>("/running"),
  getHealth: () => schedulerClient.get<HealthResponse>("/health"),

  // Maintenance
  cleanupRuns: (days?: number) =>
    schedulerClient.post<CleanupResponse>("/cleanup", { days: days ?? 30 }),
};

export interface ScheduledJob {
  id: string;
  name: string;
  cron_expression: string;
  command: string;
  description?: string;
  target_type: "container" | "host";
  target_id?: string;
  enabled: boolean;
  last_run?: string;
  last_status?: "success" | "failed" | "running";
  created_at: string;
}

export interface JobRun {
  id: string;
  job_id: string;
  started_at: string;
  finished_at?: string;
  status: "running" | "success" | "failed";
  output?: string;
  error?: string;
}

export interface CreateJobRequest {
  name: string;
  cron_expression: string;
  command: string;
  description?: string;
  target_type: "container" | "host";
  target_id?: string;
  enabled?: boolean;
}

export interface RunJobResponse {
  status: string;
  output?: string;
  error?: string;
  duration_ms: number;
}

export interface JobStats {
  total_jobs: number;
  enabled_jobs: number;
  disabled_jobs: number;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  average_duration_ms: number;
}

export interface RunningJob {
  job_id: string;
  job_name: string;
  started_at: string;
  elapsed_ms: number;
}

export interface HealthResponse {
  status: string;
  total_jobs: number;
  enabled_jobs: number;
  running_jobs: number;
}

export interface CleanupResponse {
  deleted_runs: number;
}

// ============================================================================
// Task Attachments API
// ============================================================================

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_url: string;
  file_name?: string;
  file_size_bytes?: number;
  created_at: string;
}

export interface AddAttachmentRequest {
  file_url: string;
  file_name?: string;
  file_size_bytes?: number;
}

export const taskAttachmentsApi = {
  /** Add an attachment to a task */
  addAttachment: (taskId: string, data: AddAttachmentRequest) =>
    schedulerClient.post<TaskAttachment>(`/tasks/${taskId}/attachments`, data),

  /** List all attachments for a task */
  listAttachments: (taskId: string) =>
    schedulerClient.get<TaskAttachment[]>(`/tasks/${taskId}/attachments`),

  /** Delete an attachment */
  deleteAttachment: (taskId: string, attachmentId: string) =>
    schedulerClient.delete(`/tasks/${taskId}/attachments/${attachmentId}`),
};

// ============================================================================
// Time Items (Unified Scheduling API)
// ============================================================================

export interface TimeItem {
  id: string;
  item_type: string; // 'task', 'event', 'meeting', 'block'
  title: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  deadline?: string;
  duration_minutes?: number;
  all_day: boolean;
  timezone: string;

  // Ownership
  tenant_id: string;
  project_id?: string;
  owner_id: string;

  // Status & Priority
  status: string; // 'todo', 'in_progress', 'done', 'cancelled'
  priority: string; // 'low', 'medium', 'high', 'urgent'

  // Common properties
  location_name?: string;
  location_address?: string;
  location_url?: string;

  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TimeItemsQuery {
  start?: string;
  end?: string;
  types?: string[];
  statuses?: string[];
  priorities?: string[];
  project_id?: string;
  search?: string;
  scope?: string; // 'moi', 'eux', 'tous', etc.
  unscheduled_only?: boolean;
  include_completed?: boolean;
  include_cancelled?: boolean;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: string;
}

export interface TimeItemsResponse {
  items: TimeItem[];
  total: number;
  limit: number;
  offset: number;
}

export const timeItemsApi = {
  list: (query?: TimeItemsQuery) => {
    // Axios serializes arrays as types[]=a&types[]=b. We can pass params normally
    // but let's transform arrays to comma-separated if needed by backend or just pass array.
    // Rust Axum Query extractor expects either multiple query params `?types=a&types=b` or `?types=a,b`.
    return schedulerClient.get<TimeItemsResponse>("/time_items", {
      params: query,
    });
  },
  get: (id: string) => schedulerClient.get<TimeItem>(`/time_items/${id}`),
  create: (data: any) => schedulerClient.post<TimeItem>("/time_items", data),
  update: (id: string, data: any) =>
    schedulerClient.put<TimeItem>(`/time_items/${id}`, data),
  move: (
    id: string,
    data: { start_time: string; end_time?: string; duration_minutes?: number },
  ) => schedulerClient.put<TimeItem>(`/time_items/${id}/move`, data),
  updateStatus: (id: string, status: string) =>
    schedulerClient.put<TimeItem>(`/time_items/${id}/status`, { status }),
  delete: (id: string) => schedulerClient.delete(`/time_items/${id}`),
  queryUsersEvents: (user_ids: string[], start: string, end: string) =>
    schedulerClient.post<{ items: TimeItem[] }>("/time_items/availability", {
      user_ids,
      start,
      end,
    }),
};

// ============================================================================
// DevOps API — /api/v1/devops/*
// ============================================================================

export interface ChangelogEntry {
  id: string;
  version: string;
  change_type: string;
  description: string;
  author: string;
  created_at: string;
}

export interface Pipeline {
  id: string;
  repo_name: string;
  branch: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface Deployment {
  id: string;
  service_name: string;
  version: string;
  commit_message: string;
  status: string;
  deployed_by?: string;
  created_at: string;
}

export interface CreateChangelogRequest {
  version: string;
  change_type?: string;
  description: string;
  author?: string;
}

export interface CreatePipelineRequest {
  repo_name: string;
  branch?: string;
  status?: string;
}

export interface CreateDeploymentRequest {
  service_name: string;
  version: string;
  commit_message: string;
  status?: string;
}

export const schedulerDevopsApi = {
  // Changelog — /api/v1/devops/changelog
  changelog: {
    list: () => schedulerClient.get<ChangelogEntry[]>("/devops/changelog"),
    create: (data: CreateChangelogRequest) =>
      schedulerClient.post<ChangelogEntry>("/devops/changelog", data),
  },

  // Pipelines — /api/v1/devops/pipelines
  pipelines: {
    list: () => schedulerClient.get<Pipeline[]>("/devops/pipelines"),
    create: (data: CreatePipelineRequest) =>
      schedulerClient.post<Pipeline>("/devops/pipelines", data),
    update: (
      id: string,
      data: { status?: string; started_at?: string; completed_at?: string },
    ) => schedulerClient.put<Pipeline>(`/devops/pipelines/${id}`, data),
  },

  // Deployments — /api/v1/devops/deployments
  deployments: {
    list: () => schedulerClient.get<Deployment[]>("/devops/deployments"),
    create: (data: CreateDeploymentRequest) =>
      schedulerClient.post<Deployment>("/devops/deployments", data),
  },
};
