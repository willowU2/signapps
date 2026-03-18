/**
 * Conversion Queue Store
 *
 * Zustand store for managing conversion job state.
 */

import { create } from 'zustand';
import type {
  ConversionJob,
  BatchJob,
  QueueStats,
  QueueHealth,
  JobStatus,
  JobEvent,
  CreateJobRequest,
  CreateBatchJobRequest,
  ListJobsParams,
} from '@/lib/office/conversion-queue/types';
import { conversionQueueApi } from '@/lib/office/conversion-queue/api';

// ============================================================================
// Types
// ============================================================================

interface ConversionQueueState {
  // Jobs
  jobs: ConversionJob[];
  activeJobs: ConversionJob[];
  completedJobs: ConversionJob[];
  failedJobs: ConversionJob[];
  selectedJob: ConversionJob | null;

  // Batch
  batches: BatchJob[];
  selectedBatch: BatchJob | null;

  // Queue
  stats: QueueStats | null;
  health: QueueHealth | null;

  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isLoadingStats: boolean;

  // Pagination
  hasMoreJobs: boolean;
  totalJobs: number;
  currentOffset: number;

  // Filters
  statusFilter: JobStatus | null;

  // Real-time
  eventSubscription: (() => void) | null;

  // Error
  error: string | null;

  // Actions - Jobs
  loadJobs: (params?: ListJobsParams) => Promise<void>;
  loadMoreJobs: () => Promise<void>;
  refreshJobs: () => Promise<void>;
  createJob: (request: CreateJobRequest) => Promise<ConversionJob | null>;
  cancelJob: (jobId: string) => Promise<boolean>;
  retryJob: (jobId: string) => Promise<boolean>;
  deleteJob: (jobId: string) => Promise<boolean>;
  selectJob: (job: ConversionJob | null) => void;
  downloadJob: (jobId: string) => Promise<string | null>;

  // Actions - Batch
  loadBatches: () => Promise<void>;
  createBatchJob: (request: CreateBatchJobRequest) => Promise<BatchJob | null>;
  cancelBatchJob: (batchId: string) => Promise<boolean>;
  selectBatch: (batch: BatchJob | null) => void;
  downloadBatch: (batchId: string) => Promise<string | null>;

  // Actions - Stats
  loadStats: () => Promise<void>;
  loadHealth: () => Promise<void>;

  // Actions - Real-time
  subscribeToUpdates: () => void;
  unsubscribeFromUpdates: () => void;
  handleJobEvent: (event: JobEvent) => void;

  // Actions - Filters
  setStatusFilter: (status: JobStatus | null) => void;

  // Utility
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useConversionQueueStore = create<ConversionQueueState>()((set, get) => ({
  // Initial state
  jobs: [],
  activeJobs: [],
  completedJobs: [],
  failedJobs: [],
  selectedJob: null,

  batches: [],
  selectedBatch: null,

  stats: null,
  health: null,

  isLoading: false,
  isCreating: false,
  isLoadingStats: false,

  hasMoreJobs: false,
  totalJobs: 0,
  currentOffset: 0,

  statusFilter: null,

  eventSubscription: null,

  error: null,

  // Job Actions
  loadJobs: async (params?: ListJobsParams) => {
    set({ isLoading: true, error: null, currentOffset: 0 });

    try {
      const response = await conversionQueueApi.listJobs({
        ...params,
        status: get().statusFilter ?? params?.status,
        limit: 20,
        offset: 0,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      const jobs = response.jobs;
      set({
        jobs,
        activeJobs: jobs.filter((j) => ['pending', 'queued', 'processing'].includes(j.status)),
        completedJobs: jobs.filter((j) => j.status === 'completed'),
        failedJobs: jobs.filter((j) => j.status === 'failed'),
        totalJobs: response.total,
        hasMoreJobs: response.hasMore,
        currentOffset: 20,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Erreur de chargement',
      });
    }
  },

  loadMoreJobs: async () => {
    const { hasMoreJobs, isLoading, currentOffset, statusFilter } = get();
    if (!hasMoreJobs || isLoading) return;

    set({ isLoading: true });

    try {
      const response = await conversionQueueApi.listJobs({
        status: statusFilter ?? undefined,
        limit: 20,
        offset: currentOffset,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      const allJobs = [...get().jobs, ...response.jobs];
      set({
        jobs: allJobs,
        activeJobs: allJobs.filter((j) => ['pending', 'queued', 'processing'].includes(j.status)),
        completedJobs: allJobs.filter((j) => j.status === 'completed'),
        failedJobs: allJobs.filter((j) => j.status === 'failed'),
        hasMoreJobs: response.hasMore,
        currentOffset: currentOffset + 20,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Erreur de chargement',
      });
    }
  },

  refreshJobs: async () => {
    await get().loadJobs();
  },

  createJob: async (request: CreateJobRequest) => {
    set({ isCreating: true, error: null });

    try {
      const response = await conversionQueueApi.createJob(request);
      const job = response.job;

      set((state) => ({
        jobs: [job, ...state.jobs],
        activeJobs: [job, ...state.activeJobs],
        totalJobs: state.totalJobs + 1,
        isCreating: false,
      }));

      return job;
    } catch (error) {
      set({
        isCreating: false,
        error: error instanceof Error ? error.message : 'Erreur de création',
      });
      return null;
    }
  },

  cancelJob: async (jobId: string) => {
    try {
      const updatedJob = await conversionQueueApi.cancelJob(jobId);
      get().updateJobInState(updatedJob);
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erreur d\'annulation',
      });
      return false;
    }
  },

  retryJob: async (jobId: string) => {
    try {
      const updatedJob = await conversionQueueApi.retryJob(jobId);
      get().updateJobInState(updatedJob);
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erreur de relance',
      });
      return false;
    }
  },

  deleteJob: async (jobId: string) => {
    try {
      await conversionQueueApi.deleteJob(jobId);

      set((state) => ({
        jobs: state.jobs.filter((j) => j.id !== jobId),
        completedJobs: state.completedJobs.filter((j) => j.id !== jobId),
        failedJobs: state.failedJobs.filter((j) => j.id !== jobId),
        totalJobs: state.totalJobs - 1,
        selectedJob: state.selectedJob?.id === jobId ? null : state.selectedJob,
      }));

      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erreur de suppression',
      });
      return false;
    }
  },

  selectJob: (job: ConversionJob | null) => {
    set({ selectedJob: job });
  },

  downloadJob: async (jobId: string) => {
    try {
      const { url } = await conversionQueueApi.getJobDownloadUrl(jobId);
      return url;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erreur de téléchargement',
      });
      return null;
    }
  },

  // Batch Actions
  loadBatches: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await conversionQueueApi.listBatchJobs({ limit: 50 });
      set({ batches: response.batches, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Erreur de chargement',
      });
    }
  },

  createBatchJob: async (request: CreateBatchJobRequest) => {
    set({ isCreating: true, error: null });

    try {
      const response = await conversionQueueApi.createBatchJob(request);

      set((state) => ({
        batches: [response.batch, ...state.batches],
        jobs: [...response.jobs, ...state.jobs],
        activeJobs: [...response.jobs, ...state.activeJobs],
        totalJobs: state.totalJobs + response.jobs.length,
        isCreating: false,
      }));

      return response.batch;
    } catch (error) {
      set({
        isCreating: false,
        error: error instanceof Error ? error.message : 'Erreur de création',
      });
      return null;
    }
  },

  cancelBatchJob: async (batchId: string) => {
    try {
      const updatedBatch = await conversionQueueApi.cancelBatchJob(batchId);

      set((state) => ({
        batches: state.batches.map((b) => (b.id === batchId ? updatedBatch : b)),
      }));

      // Refresh jobs to get updated statuses
      get().refreshJobs();

      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erreur d\'annulation',
      });
      return false;
    }
  },

  selectBatch: (batch: BatchJob | null) => {
    set({ selectedBatch: batch });
  },

  downloadBatch: async (batchId: string) => {
    try {
      const { url } = await conversionQueueApi.getBatchDownloadUrl(batchId);
      return url;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erreur de téléchargement',
      });
      return null;
    }
  },

  // Stats Actions
  loadStats: async () => {
    set({ isLoadingStats: true });

    try {
      const stats = await conversionQueueApi.getQueueStats();
      set({ stats, isLoadingStats: false });
    } catch (error) {
      set({ isLoadingStats: false });
    }
  },

  loadHealth: async () => {
    try {
      const health = await conversionQueueApi.getQueueHealth();
      set({ health });
    } catch (error) {
      // Silent fail for health check
    }
  },

  // Real-time Actions
  subscribeToUpdates: () => {
    const { eventSubscription } = get();
    if (eventSubscription) return;

    const unsubscribe = conversionQueueApi.subscribeToAllJobUpdates(
      (event) => get().handleJobEvent(event),
      () => {
        // Reconnect on error
        setTimeout(() => {
          get().unsubscribeFromUpdates();
          get().subscribeToUpdates();
        }, 5000);
      }
    );

    set({ eventSubscription: unsubscribe });
  },

  unsubscribeFromUpdates: () => {
    const { eventSubscription } = get();
    if (eventSubscription) {
      eventSubscription();
      set({ eventSubscription: null });
    }
  },

  handleJobEvent: (event: JobEvent) => {
    const updatedJob = event.data as ConversionJob;
    if (!updatedJob.id) return;

    set((state) => {
      const jobIndex = state.jobs.findIndex((j) => j.id === event.jobId);

      if (jobIndex === -1) {
        // New job
        if (event.type === 'job:created') {
          return {
            jobs: [updatedJob, ...state.jobs],
            activeJobs: [updatedJob, ...state.activeJobs],
            totalJobs: state.totalJobs + 1,
          };
        }
        return state;
      }

      // Update existing job
      const newJobs = [...state.jobs];
      newJobs[jobIndex] = { ...newJobs[jobIndex], ...updatedJob };

      return {
        jobs: newJobs,
        activeJobs: newJobs.filter((j) => ['pending', 'queued', 'processing'].includes(j.status)),
        completedJobs: newJobs.filter((j) => j.status === 'completed'),
        failedJobs: newJobs.filter((j) => j.status === 'failed'),
        selectedJob:
          state.selectedJob?.id === event.jobId
            ? { ...state.selectedJob, ...updatedJob }
            : state.selectedJob,
      };
    });
  },

  // Filter Actions
  setStatusFilter: (status: JobStatus | null) => {
    set({ statusFilter: status });
    get().loadJobs();
  },

  // Utility
  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    const { eventSubscription } = get();
    if (eventSubscription) {
      eventSubscription();
    }

    set({
      jobs: [],
      activeJobs: [],
      completedJobs: [],
      failedJobs: [],
      selectedJob: null,
      batches: [],
      selectedBatch: null,
      stats: null,
      health: null,
      hasMoreJobs: false,
      totalJobs: 0,
      currentOffset: 0,
      statusFilter: null,
      eventSubscription: null,
      error: null,
    });
  },
}));

// Helper function (internal)
const updateJobInState = (job: ConversionJob) => {
  useConversionQueueStore.setState((state) => {
    const newJobs = state.jobs.map((j) => (j.id === job.id ? job : j));

    return {
      jobs: newJobs,
      activeJobs: newJobs.filter((j) => ['pending', 'queued', 'processing'].includes(j.status)),
      completedJobs: newJobs.filter((j) => j.status === 'completed'),
      failedJobs: newJobs.filter((j) => j.status === 'failed'),
      selectedJob: state.selectedJob?.id === job.id ? job : state.selectedJob,
    };
  });
};

// Extend the store with the helper
useConversionQueueStore.getState().updateJobInState = updateJobInState;

// ============================================================================
// Selectors
// ============================================================================

export const selectActiveJobs = (state: ConversionQueueState) => state.activeJobs;
export const selectCompletedJobs = (state: ConversionQueueState) => state.completedJobs;
export const selectFailedJobs = (state: ConversionQueueState) => state.failedJobs;
export const selectQueueStats = (state: ConversionQueueState) => state.stats;
export const selectQueueHealth = (state: ConversionQueueState) => state.health;

export default useConversionQueueStore;
