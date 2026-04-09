/**
 * Reports API — Generateur de rapports personnalises
 *
 * Endpoints sous /reports, servis par le service Identity (port 3001).
 */
import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.IDENTITY);

// ============================================================================
// Types
// ============================================================================

export interface Report {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  report_type: string;
  query_config: Record<string, unknown>;
  schedule?: ReportSchedule;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReportSchedule {
  cron: string;
  timezone: string;
  recipients: string[];
  format: ReportFormat;
}

export type ReportFormat = "pdf" | "csv" | "xlsx" | "json";

export interface CreateReportRequest {
  name: string;
  description?: string;
  report_type: string;
  query_config: Record<string, unknown>;
  schedule?: ReportSchedule;
}

export interface UpdateReportRequest {
  name?: string;
  description?: string;
  query_config?: Record<string, unknown>;
  schedule?: ReportSchedule;
}

export interface ReportExecution {
  id: string;
  report_id: string;
  status: ExecutionStatus;
  format: ReportFormat;
  download_url?: string;
  row_count?: number;
  started_at: string;
  completed_at?: string;
  error?: string;
}

export type ExecutionStatus = "pending" | "running" | "completed" | "failed";

// ============================================================================
// API
// ============================================================================

export const reportsApi = {
  /** Liste tous les rapports */
  list: () => client.get<Report[]>("/reports"),

  /** Cree un nouveau rapport */
  create: (data: CreateReportRequest) => client.post<Report>("/reports", data),

  /** Met a jour un rapport existant */
  update: (id: string, data: UpdateReportRequest) =>
    client.put<Report>(`/reports/${id}`, data),

  /** Supprime un rapport */
  delete: (id: string) => client.delete(`/reports/${id}`),

  /** Execute un rapport et genere le fichier de sortie */
  execute: (id: string) =>
    client.post<ReportExecution>(`/reports/${id}/execute`),

  /** Liste les executions passees d'un rapport */
  getExecutions: (id: string) =>
    client.get<ReportExecution[]>(`/reports/${id}/executions`),
};
