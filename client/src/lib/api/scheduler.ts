/**
 * Scheduler API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from './factory';

// Get the scheduler service client (cached)
const schedulerClient = getClient(ServiceName.SCHEDULER);

// Scheduler API
export const schedulerApi = {
    // Jobs
    listJobs: () => schedulerClient.get<ScheduledJob[]>('/jobs'),
    getJob: (id: string) => schedulerClient.get<ScheduledJob>(`/jobs/${id}`),
    createJob: (data: CreateJobRequest) =>
        schedulerClient.post<ScheduledJob>('/jobs', data),
    updateJob: (id: string, data: Partial<CreateJobRequest>) =>
        schedulerClient.put<ScheduledJob>(`/jobs/${id}`, data),
    deleteJob: (id: string) => schedulerClient.delete(`/jobs/${id}`),
    enableJob: (id: string) => schedulerClient.post(`/jobs/${id}/enable`),
    disableJob: (id: string) => schedulerClient.post(`/jobs/${id}/disable`),
    runJob: (id: string) => schedulerClient.post<RunJobResponse>(`/jobs/${id}/run`),

    // Job runs
    listRuns: (jobId: string, limit?: number) =>
        schedulerClient.get<JobRun[]>(`/jobs/${jobId}/runs`, { params: { limit } }),
    getRun: (runId: string) =>
        schedulerClient.get<JobRun>(`/runs/${runId}`),

    // Stats & monitoring
    getStats: () => schedulerClient.get<JobStats>('/stats'),
    getRunning: () => schedulerClient.get<RunningJob[]>('/running'),
    getHealth: () => schedulerClient.get<HealthResponse>('/health'),

    // Maintenance
    cleanupRuns: (days?: number) =>
        schedulerClient.post<CleanupResponse>('/cleanup', { days: days ?? 30 }),
};

export interface ScheduledJob {
    id: string;
    name: string;
    cron_expression: string;
    command: string;
    description?: string;
    target_type: 'container' | 'host';
    target_id?: string;
    enabled: boolean;
    last_run?: string;
    last_status?: 'success' | 'failed' | 'running';
    created_at: string;
}

export interface JobRun {
    id: string;
    job_id: string;
    started_at: string;
    finished_at?: string;
    status: 'running' | 'success' | 'failed';
    output?: string;
    error?: string;
}

export interface CreateJobRequest {
    name: string;
    cron_expression: string;
    command: string;
    description?: string;
    target_type: 'container' | 'host';
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
