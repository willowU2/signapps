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
  DeployProfile,
  DeployHistory,
} from "@/types/active-directory";

const client = getClient(ServiceName.WORKFORCE);

export const adApi = {
  // ── Domains ──
  domains: {
    list: () => client.get<AdDomain[]>("/workforce/ad/domains"),
    get: (id: string) => client.get<AdDomain>(`/workforce/ad/domains/${id}`),
    create: (data: CreateDomainRequest) =>
      client.post<DomainCreationResult>("/workforce/ad/domains", data),
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
    deleteScope: (scopeId: string) =>
      client.delete(`/workforce/ad/dhcp/scopes/${scopeId}`),
    leases: (scopeId: string) =>
      client.get<DhcpLease[]>(`/workforce/ad/dhcp/scopes/${scopeId}/leases`),
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
    deleteProfile: (profileId: string) =>
      client.delete(`/workforce/ad/deploy/profiles/${profileId}`),
    history: (profileId: string) =>
      client.get<DeployHistory[]>(
        `/workforce/ad/deploy/profiles/${profileId}/history`,
      ),
  },

  // ── Domain Config ──
  updateConfig: (domainId: string, config: Record<string, unknown>) =>
    client.put(`/workforce/ad/domains/${domainId}/config`, config),
};
