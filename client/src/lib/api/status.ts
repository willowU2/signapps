/**
 * Status API — Page de statut des services et incidents
 *
 * Endpoints sous /status, servis par le service Metrics (port 3008).
 */
import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.METRICS);

// ============================================================================
// Types
// ============================================================================

export interface ServiceStatus {
  name: string;
  status: ServiceHealthStatus;
  latency_ms?: number;
  last_checked: string;
  message?: string;
}

export type ServiceHealthStatus =
  | "operational"
  | "degraded"
  | "partial_outage"
  | "major_outage"
  | "maintenance";

export interface StatusHistoryEntry {
  date: string;
  status: ServiceHealthStatus;
  uptime_percent: number;
}

export interface Incident {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  affected_services: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export type IncidentStatus =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved";

export type IncidentSeverity = "minor" | "major" | "critical";

export interface CreateIncidentRequest {
  title: string;
  description: string;
  severity: IncidentSeverity;
  affected_services: string[];
}

// ============================================================================
// API
// ============================================================================

export const statusApi = {
  /** Recupere le statut actuel de tous les services */
  getServices: () => client.get<ServiceStatus[]>("/status/services"),

  /** Recupere l'historique de disponibilite */
  getHistory: () => client.get<StatusHistoryEntry[]>("/status/history"),

  /** Liste les incidents en cours et passes */
  getIncidents: () => client.get<Incident[]>("/status/incidents"),

  /** Cree un nouvel incident (admin) */
  createIncident: (data: CreateIncidentRequest) =>
    client.post<Incident>("/status/incidents", data),
};
