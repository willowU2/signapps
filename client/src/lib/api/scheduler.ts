import { schedulerApiClient } from './core';

// Scheduler API
export const schedulerApi = {
    // Jobs
    listJobs: () => schedulerApiClient.get<ScheduledJob[]>('/jobs'),
    getJob: (id: string) => schedulerApiClient.get<ScheduledJob>(`/jobs/${id}`),
    createJob: (data: CreateJobRequest) =>
        schedulerApiClient.post<ScheduledJob>('/jobs', data),
    updateJob: (id: string, data: Partial<CreateJobRequest>) =>
        schedulerApiClient.put<ScheduledJob>(`/jobs/${id}`, data),
    deleteJob: (id: string) => schedulerApiClient.delete(`/jobs/${id}`),
    enableJob: (id: string) => schedulerApiClient.post(`/jobs/${id}/enable`),
    disableJob: (id: string) => schedulerApiClient.post(`/jobs/${id}/disable`),
    runJob: (id: string) => schedulerApiClient.post(`/jobs/${id}/run`),
    // Job runs
    listRuns: (jobId: string) =>
        schedulerApiClient.get<JobRun[]>(`/jobs/${jobId}/runs`),
    getRunOutput: (jobId: string, runId: string) =>
        schedulerApiClient.get<JobRun>(`/jobs/${jobId}/runs/${runId}`),
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
