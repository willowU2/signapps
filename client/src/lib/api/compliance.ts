/**
 * Compliance API — signapps-compliance (port 3032)
 *
 * Tableau de bord conformité : logs d'audit, exports RGPD, politiques de rétention.
 */
import { getClient, ServiceName } from "./factory";

const client = () => getClient(ServiceName.COMPLIANCE_SVC);

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  action: string;
  actor_id: string;
  actor_email: string;
  resource_type: string;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogFilters {
  action?: string;
  actor_id?: string;
  resource_type?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface RetentionPolicy {
  id: string;
  name: string;
  resource_type: string;
  retention_days: number;
  enabled: boolean;
  last_run_at: string | null;
  created_at: string;
}

export interface GdprExportRequest {
  id: string;
  subject_id: string;
  subject_email: string;
  status: "pending" | "processing" | "ready" | "expired";
  requested_at: string;
  ready_at: string | null;
  download_url: string | null;
}

export interface ComplianceStats {
  total_audit_logs: number;
  logs_last_24h: number;
  pending_gdpr_requests: number;
  active_retention_policies: number;
}

// ─── API ────────────────────────────────────────────────────────────────────

export const complianceApi = {
  // ── Audit logs ────────────────────────────────────────────────────────
  audit: {
    /** Liste les logs d'audit avec filtres optionnels */
    list: (filters?: AuditLogFilters) =>
      client().get<AuditLog[]>("/compliance/audit", { params: filters }),

    /** Exporte les logs d'audit en CSV */
    export: (filters?: AuditLogFilters) =>
      client().get<Blob>("/compliance/audit/export", {
        params: filters,
        responseType: "blob",
      }),
  },

  // ── Statistiques ─────────────────────────────────────────────────────
  stats: () => client().get<ComplianceStats>("/compliance/stats"),

  // ── RGPD / DSAR ──────────────────────────────────────────────────────
  gdpr: {
    /** Demande un export RGPD pour un sujet */
    requestExport: (data: { subject_email: string }) =>
      client().post<GdprExportRequest>("/compliance/gdpr/export", data),

    /** Liste les demandes d'export RGPD en attente */
    listRequests: () =>
      client().get<GdprExportRequest[]>("/compliance/gdpr/export"),

    /** Supprime les données d'un utilisateur (droit à l'oubli) */
    deleteSubject: (subjectId: string) =>
      client().delete(`/compliance/gdpr/subjects/${subjectId}`),
  },

  // ── Politiques de rétention ───────────────────────────────────────────
  retention: {
    list: () => client().get<RetentionPolicy[]>("/compliance/retention"),

    create: (data: {
      name: string;
      resource_type: string;
      retention_days: number;
    }) => client().post<RetentionPolicy>("/compliance/retention", data),

    update: (
      id: string,
      data: Partial<{ name: string; retention_days: number; enabled: boolean }>,
    ) => client().put<RetentionPolicy>(`/compliance/retention/${id}`, data),

    delete: (id: string) => client().delete(`/compliance/retention/${id}`),

    /** Déclenche l'application manuelle d'une politique */
    run: (id: string) => client().post(`/compliance/retention/${id}/run`),
  },
};
