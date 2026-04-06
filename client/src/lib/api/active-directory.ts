/**
 * Active Directory Administration API Module
 *
 * API client for managing AD domains, Kerberos keys, DNS zones,
 * computer accounts, and GPOs.
 */
import { getClient, ServiceName } from "./factory";
import type {
  AdDomain,
  CreateDomainRequest,
  DomainCreationResult,
  AdPrincipalKey,
  AdDnsZone,
  AdDnsRecord,
  CreateDnsRecordRequest,
  ComputerAccount,
  DcStatus,
  GroupPolicyObject,
  InfraCertificate,
  DhcpScope,
  DhcpLease,
  DhcpReservation,
  DeployProfile,
  DeployHistory,
  AdOu,
  AdUserAccountInfo,
  AdSyncEvent,
  AdSyncQueueStats,
  AdDcSiteInfo,
  AdSnapshot,
  SnapshotPreview,
  ReconcileReport,
} from "@/types/active-directory";

const client = getClient(ServiceName.WORKFORCE);

export const adApi = {
  // ── Domains ──
  domains: {
    list: () => client.get<AdDomain[]>("/workforce/ad/domains"),
    get: (id: string) => client.get<AdDomain>(`/workforce/ad/domains/${id}`),
    create: (data: CreateDomainRequest) =>
      client.post<DomainCreationResult>("/workforce/ad/domains", data),
    update: (id: string, data: Partial<AdDomain>) =>
      client.put(`/workforce/ad/domains/${id}`, data),
    delete: (id: string) => client.delete(`/workforce/ad/domains/${id}`),
  },

  // ── Principal Keys ──
  keys: {
    list: (domainId: string) =>
      client.get<AdPrincipalKey[]>(`/workforce/ad/domains/${domainId}/keys`),
    listByPrincipal: (domainId: string, principal: string) =>
      client.get<AdPrincipalKey[]>(
        `/workforce/ad/domains/${domainId}/keys?principal=${encodeURIComponent(principal)}`,
      ),
    rotate: (domainId: string, principal: string) =>
      client.post(`/workforce/ad/domains/${domainId}/keys/rotate`, {
        principal,
      }),
    delete: (domainId: string, principal: string) =>
      client.delete(
        `/workforce/ad/domains/${domainId}/keys?principal=${encodeURIComponent(principal)}`,
      ),
  },

  // ── DNS Zones ──
  dns: {
    zones: (domainId: string) =>
      client.get<AdDnsZone[]>(`/workforce/ad/domains/${domainId}/dns/zones`),
    records: (zoneId: string) =>
      client.get<AdDnsRecord[]>(`/workforce/ad/dns/zones/${zoneId}/records`),
    addRecord: (zoneId: string, data: CreateDnsRecordRequest) =>
      client.post<AdDnsRecord>(
        `/workforce/ad/dns/zones/${zoneId}/records`,
        data,
      ),
    deleteRecord: (recordId: string) =>
      client.delete(`/workforce/ad/dns/records/${recordId}`),
    scavenge: (zoneId: string) =>
      client.post(`/workforce/ad/dns/zones/${zoneId}/scavenge`),
  },

  // ── Computer Accounts ──
  computers: {
    list: (domainId: string) =>
      client.get<ComputerAccount[]>(
        `/workforce/ad/domains/${domainId}/computers`,
      ),
    get: (id: string) =>
      client.get<ComputerAccount>(`/workforce/ad/computers/${id}`),
    delete: (id: string) => client.delete(`/workforce/ad/computers/${id}`),
    resetPassword: (id: string) =>
      client.post(`/workforce/ad/computers/${id}/reset-password`),
  },

  // ── DC Status ──
  status: () => client.get<DcStatus>("/workforce/ad/status"),

  // ── GPOs ──
  gpos: {
    list: (domainId: string) =>
      client.get<GroupPolicyObject[]>(`/workforce/ad/domains/${domainId}/gpos`),
    get: (id: string) =>
      client.get<GroupPolicyObject>(`/workforce/ad/gpos/${id}`),
    create: (domainId: string, data: Partial<GroupPolicyObject>) =>
      client.post<GroupPolicyObject>(
        `/workforce/ad/domains/${domainId}/gpos`,
        data,
      ),
    update: (id: string, data: Partial<GroupPolicyObject>) =>
      client.put<GroupPolicyObject>(`/workforce/ad/gpos/${id}`, data),
    delete: (id: string) => client.delete(`/workforce/ad/gpos/${id}`),
  },

  // ── Certificates ──
  certificates: {
    list: (domainId: string) =>
      client.get<InfraCertificate[]>(
        `/workforce/ad/domains/${domainId}/certificates`,
      ),
    issue: (
      domainId: string,
      data: { subject: string; cert_type: string; san?: string[] },
    ) =>
      client.post<InfraCertificate>(
        `/workforce/ad/domains/${domainId}/certificates`,
        data,
      ),
    revoke: (certId: string) =>
      client.post(`/workforce/ad/certificates/${certId}/revoke`),
    renew: (certId: string) =>
      client.post(`/workforce/ad/certificates/${certId}/renew`),
  },

  // ── DHCP ──
  dhcp: {
    scopes: (domainId: string) =>
      client.get<DhcpScope[]>(`/workforce/ad/domains/${domainId}/dhcp/scopes`),
    createScope: (domainId: string, data: Partial<DhcpScope>) =>
      client.post<DhcpScope>(
        `/workforce/ad/domains/${domainId}/dhcp/scopes`,
        data,
      ),
    updateScope: (scopeId: string, data: Partial<DhcpScope>) =>
      client.put(`/workforce/ad/dhcp/scopes/${scopeId}`, data),
    deleteScope: (scopeId: string) =>
      client.delete(`/workforce/ad/dhcp/scopes/${scopeId}`),
    leases: (scopeId: string) =>
      client.get<DhcpLease[]>(`/workforce/ad/dhcp/scopes/${scopeId}/leases`),
    reservations: (scopeId: string) =>
      client.get<DhcpReservation[]>(
        `/workforce/ad/dhcp/scopes/${scopeId}/reservations`,
      ),
    createReservation: (scopeId: string, data: Partial<DhcpReservation>) =>
      client.post<DhcpReservation>(
        `/workforce/ad/dhcp/scopes/${scopeId}/reservations`,
        data,
      ),
    deleteReservation: (reservationId: string) =>
      client.delete(`/workforce/ad/dhcp/reservations/${reservationId}`),
    expireLeases: () =>
      client.post<{ expired: number }>(`/workforce/ad/dhcp/leases/expire`),
  },

  // ── Deployment ──
  deploy: {
    profiles: (domainId: string) =>
      client.get<DeployProfile[]>(
        `/workforce/ad/domains/${domainId}/deploy/profiles`,
      ),
    createProfile: (domainId: string, data: Partial<DeployProfile>) =>
      client.post<DeployProfile>(
        `/workforce/ad/domains/${domainId}/deploy/profiles`,
        data,
      ),
    updateProfile: (profileId: string, data: Partial<DeployProfile>) =>
      client.put(`/workforce/ad/deploy/profiles/${profileId}`, data),
    deleteProfile: (profileId: string) =>
      client.delete(`/workforce/ad/deploy/profiles/${profileId}`),
    history: (profileId: string) =>
      client.get<DeployHistory[]>(
        `/workforce/ad/deploy/profiles/${profileId}/history`,
      ),
    assignments: (profileId: string) =>
      client.get(`/workforce/ad/deploy/profiles/${profileId}/assignments`),
    createAssignment: (
      profileId: string,
      data: { target_type: string; target_id: string },
    ) =>
      client.post(
        `/workforce/ad/deploy/profiles/${profileId}/assignments`,
        data,
      ),
    deleteAssignment: (assignmentId: string) =>
      client.delete(`/workforce/ad/deploy/assignments/${assignmentId}`),
  },

  // ── Domain Config ──
  updateConfig: (domainId: string, config: Record<string, unknown>) =>
    client.put(`/workforce/ad/domains/${domainId}/config`, config),

  // ── AD Sync ──
  sync: {
    queueStats: (domainId: string) =>
      client.get<AdSyncQueueStats>(
        `/workforce/ad/domains/${domainId}/sync/stats`,
      ),
    events: (domainId: string) =>
      client.get<AdSyncEvent[]>(
        `/workforce/ad/domains/${domainId}/sync/events`,
      ),
    ous: (domainId: string) =>
      client.get<AdOu[]>(`/workforce/ad/domains/${domainId}/ad-ous`),
    users: (domainId: string) =>
      client.get<AdUserAccountInfo[]>(
        `/workforce/ad/domains/${domainId}/ad-users`,
      ),
    dcSites: (domainId: string) =>
      client.get<AdDcSiteInfo[]>(`/workforce/ad/domains/${domainId}/dc-sites`),
    setMailDomain: (nodeId: string, domainId: string) =>
      client.put(`/workforce/ad/org-nodes/${nodeId}/mail-domain`, {
        domain_id: domainId,
      }),
    removeMailDomain: (nodeId: string) =>
      client.delete(`/workforce/ad/org-nodes/${nodeId}/mail-domain`),
    promoteDc: (
      domainId: string,
      data: { hostname: string; ip: string; site_id?: string; role?: string },
    ) => client.post(`/workforce/ad/domains/${domainId}/dc-sites`, data),
    demoteDc: (dcId: string) =>
      client.post(`/workforce/ad/dc-sites/${dcId}/demote`),
    transferFsmo: (domainId: string, data: { role: string; dc_id: string }) =>
      client.post(`/workforce/ad/domains/${domainId}/fsmo/transfer`, data),
    reconcile: () =>
      client.post<ReconcileReport>(`/workforce/ad/sync/reconcile`),
    snapshots: (domainId: string) =>
      client.get<AdSnapshot[]>(`/workforce/ad/domains/${domainId}/snapshots`),
    createSnapshot: (domainId: string, data: { snapshot_type: string }) =>
      client.post<AdSnapshot>(
        `/workforce/ad/domains/${domainId}/snapshots`,
        data,
      ),
    restorePreview: (
      snapshotId: string,
      data: { target_dn?: string; include_children?: boolean },
    ) =>
      client.post<SnapshotPreview>(
        `/workforce/ad/snapshots/${snapshotId}/preview`,
        data,
      ),
    restoreExecute: (
      snapshotId: string,
      data: { target_dn?: string; include_children?: boolean },
    ) => client.post(`/workforce/ad/snapshots/${snapshotId}/restore`, data),
    userMailAliases: (userId: string) =>
      client.get(`/workforce/ad/ad-users/${userId}/mail-aliases`),
    sharedMailboxes: (domainId: string) =>
      client.get(`/workforce/ad/domains/${domainId}/shared-mailboxes`),
  },

  // ── Monitoring & Maintenance ──
  monitoring: {
    expiringCerts: (days?: number) =>
      client.get(
        `/workforce/ad/certificates/expiring${days ? `?days=${days}` : ""}`,
      ),
    infrastructureHealth: () =>
      client.get(`/workforce/ad/health/infrastructure`),
    expireLeases: () =>
      client.post<{ expired: number }>(`/workforce/ad/dhcp/leases/expire`),
  },
};
