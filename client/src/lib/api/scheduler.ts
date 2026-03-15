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
    runJob: (id: string) => schedulerClient.post(`/jobs/${id}/run`),
    // Job runs
    listRuns: (jobId: string) =>
        schedulerClient.get<JobRun[]>(`/jobs/${jobId}/runs`),
    getRunOutput: (jobId: string, runId: string) =>
        schedulerClient.get<JobRun>(`/jobs/${jobId}/runs/${runId}`),
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
