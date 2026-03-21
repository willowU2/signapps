import { schedulerApiClient as apiClient } from './core';

export interface WorkloadMetrics {
  total_tasks: number;
  pending: number;
  in_progress: number;
  completed: number;
  blocked: number;
}

export interface ResourceMetrics {
  total_bookings: number;
  hours_booked: number;
}

export interface MetricsQuery {
  start_date?: string;
  end_date?: string;
}

export const metricsApi = {
  getWorkload: (params?: MetricsQuery) =>
    apiClient.get<WorkloadMetrics>('/metrics/workload', { params }).then((res: any) => res.data),

  getResources: () =>
    apiClient.get<ResourceMetrics>('/metrics/resources').then((res: any) => res.data),
};
