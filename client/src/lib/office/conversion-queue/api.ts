/**
 * Conversion Queue API
 *
 * API client for managing asynchronous conversion jobs.
 */

import { getClient, ServiceName } from "@/lib/api/factory";

const api = getClient(ServiceName.OFFICE);
import type {
  ConversionJob,
  BatchJob,
  QueueStats,
  QueueHealth,
  CreateJobRequest,
  CreateJobResponse,
  CreateBatchJobRequest,
  CreateBatchJobResponse,
  ListJobsParams,
  ListJobsResponse,
  JobEvent,
} from "./types";

const QUEUE_BASE = "/api/v1/office/conversion-queue";

// ============================================================================
// Job Management
// ============================================================================

/**
 * Create a new conversion job
 */
export async function createJob(
  request: CreateJobRequest,
): Promise<CreateJobResponse> {
  const response = await api.post<CreateJobResponse>(
    `${QUEUE_BASE}/jobs`,
    request,
  );
  return response.data;
}

/**
 * Get a specific job by ID
 */
export async function getJob(jobId: string): Promise<ConversionJob> {
  const response = await api.get<ConversionJob>(`${QUEUE_BASE}/jobs/${jobId}`);
  return response.data;
}

/**
 * List jobs with optional filters
 */
export async function listJobs(
  params?: ListJobsParams,
): Promise<ListJobsResponse> {
  const queryParams = new URLSearchParams();

  if (params?.status) queryParams.append("status", params.status);
  if (params?.type) queryParams.append("type", params.type);
  if (params?.limit) queryParams.append("limit", String(params.limit));
  if (params?.offset) queryParams.append("offset", String(params.offset));
  if (params?.sortBy) queryParams.append("sortBy", params.sortBy);
  if (params?.sortOrder) queryParams.append("sortOrder", params.sortOrder);

  const response = await api.get<ListJobsResponse>(
    `${QUEUE_BASE}/jobs?${queryParams.toString()}`,
  );
  return response.data;
}

/**
 * Cancel a pending or queued job
 */
export async function cancelJob(jobId: string): Promise<ConversionJob> {
  const response = await api.post<ConversionJob>(
    `${QUEUE_BASE}/jobs/${jobId}/cancel`,
  );
  return response.data;
}

/**
 * Retry a failed job
 */
export async function retryJob(jobId: string): Promise<ConversionJob> {
  const response = await api.post<ConversionJob>(
    `${QUEUE_BASE}/jobs/${jobId}/retry`,
  );
  return response.data;
}

/**
 * Delete a completed or cancelled job
 */
export async function deleteJob(jobId: string): Promise<void> {
  await api.delete(`${QUEUE_BASE}/jobs/${jobId}`);
}

/**
 * Get download URL for completed job
 */
export async function getJobDownloadUrl(
  jobId: string,
): Promise<{ url: string; expiresAt: string }> {
  const response = await api.get<{ url: string; expiresAt: string }>(
    `${QUEUE_BASE}/jobs/${jobId}/download`,
  );
  return response.data;
}

// ============================================================================
// Batch Jobs
// ============================================================================

/**
 * Create a batch conversion job
 */
export async function createBatchJob(
  request: CreateBatchJobRequest,
): Promise<CreateBatchJobResponse> {
  const response = await api.post<CreateBatchJobResponse>(
    `${QUEUE_BASE}/batch`,
    request,
  );
  return response.data;
}

/**
 * Get a batch job by ID
 */
export async function getBatchJob(batchId: string): Promise<BatchJob> {
  const response = await api.get<BatchJob>(`${QUEUE_BASE}/batch/${batchId}`);
  return response.data;
}

/**
 * List all batch jobs
 */
export async function listBatchJobs(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ batches: BatchJob[]; total: number }> {
  const queryParams = new URLSearchParams();

  if (params?.limit) queryParams.append("limit", String(params.limit));
  if (params?.offset) queryParams.append("offset", String(params.offset));

  const response = await api.get<{ batches: BatchJob[]; total: number }>(
    `${QUEUE_BASE}/batch?${queryParams.toString()}`,
  );
  return response.data;
}

/**
 * Cancel a batch job (cancels all pending jobs in batch)
 */
export async function cancelBatchJob(batchId: string): Promise<BatchJob> {
  const response = await api.post<BatchJob>(
    `${QUEUE_BASE}/batch/${batchId}/cancel`,
  );
  return response.data;
}

/**
 * Get download URL for completed batch (ZIP file)
 */
export async function getBatchDownloadUrl(
  batchId: string,
): Promise<{ url: string; expiresAt: string }> {
  const response = await api.get<{ url: string; expiresAt: string }>(
    `${QUEUE_BASE}/batch/${batchId}/download`,
  );
  return response.data;
}

// ============================================================================
// Queue Statistics
// ============================================================================

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<QueueStats> {
  const response = await api.get<QueueStats>(`${QUEUE_BASE}/stats`);
  return response.data;
}

/**
 * Get queue health status
 */
export async function getQueueHealth(): Promise<QueueHealth> {
  const response = await api.get<QueueHealth>(`${QUEUE_BASE}/health`);
  return response.data;
}

// ============================================================================
// Real-time Updates
// ============================================================================

/**
 * Subscribe to job updates via Server-Sent Events
 */
export function subscribeToJobUpdates(
  jobId: string,
  onEvent: (event: JobEvent) => void,
  onError?: (error: Event) => void,
): () => void {
  const eventSource = new EventSource(`${QUEUE_BASE}/jobs/${jobId}/events`);

  eventSource.onmessage = (event) => {
    try {
      const jobEvent: JobEvent = JSON.parse(event.data);
      onEvent(jobEvent);
    } catch (e) {
      console.error("Failed to parse job event:", e);
    }
  };

  eventSource.onerror = (error) => {
    onError?.(error);
  };

  return () => {
    eventSource.close();
  };
}

/**
 * Subscribe to all user's job updates
 */
export function subscribeToAllJobUpdates(
  onEvent: (event: JobEvent) => void,
  onError?: (error: Event) => void,
): () => void {
  const eventSource = new EventSource(`${QUEUE_BASE}/events`);

  eventSource.onmessage = (event) => {
    try {
      const jobEvent: JobEvent = JSON.parse(event.data);
      onEvent(jobEvent);
    } catch (e) {
      console.error("Failed to parse job event:", e);
    }
  };

  eventSource.onerror = (error) => {
    onError?.(error);
  };

  return () => {
    eventSource.close();
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get estimated conversion time based on file size and type
 */
export async function estimateConversionTime(
  documentId: string,
  targetFormat: string,
): Promise<{ estimatedSeconds: number; queuePosition: number }> {
  const response = await api.post<{
    estimatedSeconds: number;
    queuePosition: number;
  }>(`${QUEUE_BASE}/estimate`, { documentId, targetFormat });
  return response.data;
}

/**
 * Check if a format conversion is supported
 */
export async function getSupportedConversions(): Promise<{
  conversions: Array<{
    source: string;
    target: string;
    type: string;
  }>;
}> {
  const response = await api.get<{
    conversions: Array<{
      source: string;
      target: string;
      type: string;
    }>;
  }>(`${QUEUE_BASE}/supported`);
  return response.data;
}

// ============================================================================
// Export All
// ============================================================================

export const conversionQueueApi = {
  // Jobs
  createJob,
  getJob,
  listJobs,
  cancelJob,
  retryJob,
  deleteJob,
  getJobDownloadUrl,
  // Batch
  createBatchJob,
  getBatchJob,
  listBatchJobs,
  cancelBatchJob,
  getBatchDownloadUrl,
  // Stats
  getQueueStats,
  getQueueHealth,
  // Real-time
  subscribeToJobUpdates,
  subscribeToAllJobUpdates,
  // Utility
  estimateConversionTime,
  getSupportedConversions,
};

export default conversionQueueApi;
