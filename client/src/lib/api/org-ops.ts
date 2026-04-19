/**
 * Org Operations API module (S1 W5 Task 34).
 *
 * Client for the admin dashboard that surfaces AD sync activity,
 * pending cross-service provisioning rows and active access grants.
 * Hits the `signapps-org` service directly.
 */
import { getClient, ServiceName } from "./factory";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * One row from `org_ad_sync_log`. A single sync cycle produces many
 * rows sharing the same `run_id`.
 */
export interface AdSyncLogEntry {
  id: string;
  tenant_id: string;
  run_id: string;
  entry_dn: string;
  direction: string;
  status: string;
  diff: unknown;
  error: string | null;
  created_at: string;
}

/**
 * One row from `org_provisioning_log`. Used to show the cross-service
 * provisioning queue and drive retries.
 */
export interface ProvisioningLogEntry {
  id: string;
  tenant_id: string;
  person_id: string;
  topic: string;
  service: string;
  status: string;
  error: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
}

/**
 * One row from `org_access_grants`. `token_hash` is deliberately
 * omitted from this view because it is never needed client-side.
 */
export interface AccessGrantView {
  id: string;
  tenant_id: string;
  granted_by: string;
  granted_to: string | null;
  resource_type: string;
  resource_id: string;
  permissions: unknown;
  token_hash: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  last_used_at: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════

const client = getClient(ServiceName.ORG_SVC);

export const orgOpsApi = {
  /** Last N AD sync log entries, newest first. */
  adSyncRuns: (params?: { tenant_id?: string; limit?: number }) =>
    client.get<AdSyncLogEntry[]>("/api/v1/org/ad/sync-log", {
      params,
    }),

  /** Provisioning rows still needing action (status != succeeded). */
  provisioningPending: (params?: { tenant_id?: string; limit?: number }) =>
    client.get<ProvisioningLogEntry[]>("/api/v1/org/provisioning/pending", {
      params,
    }),

  /** Re-emit the source event for a failed provisioning attempt. */
  provisioningRetry: (id: string) =>
    client.post<void>(`/api/v1/org/provisioning/${id}/retry`),

  /** Active (non-revoked, non-expired) grants for a tenant. */
  activeGrants: (tenantId: string) =>
    client.get<AccessGrantView[]>("/api/v1/org/grants", {
      params: { tenant_id: tenantId, active: true },
    }),

  /** Revoke a grant by id. */
  revokeGrant: (id: string) => client.delete<void>(`/api/v1/org/grants/${id}`),
};
