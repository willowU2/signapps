/**
 * SecureLink API Client — SignApps Platform
 *
 * Covers all 4 endpoint groups on port 3006:
 *   - Dashboard (stats, traffic)
 *   - Tunnels (CRUD + quick connect, bulk, reconnect)
 *   - Relays (CRUD + connect/disconnect/test/stats)
 *   - DNS (config, blocklists, records, cache, query)
 */

import { getClient, ServiceName } from './factory';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface DashboardStats {
  active_tunnels: number;
  active_relays: number;
  dns_queries_today: number;
  blocked_queries_today: number;
}

export interface DashboardTraffic {
  timestamp: string;
  bytes_in: number;
  bytes_out: number;
}

export interface Tunnel {
  id: string;
  name: string;
  target_host: string;
  target_port: number;
  local_port?: number;
  protocol: string;
  status: 'connected' | 'disconnected' | 'error';
  created_at: string;
}

export interface TunnelStatus {
  id: string;
  status: 'connected' | 'disconnected' | 'error';
  uptime_seconds?: number;
  bytes_transferred?: number;
}

export interface QuickConnectPayload {
  target_host: string;
  target_port: number;
}

export interface BulkTunnelPayload {
  action: string;
  ids: string[];
}

export interface Relay {
  id: string;
  name: string;
  host: string;
  port: number;
  status: 'connected' | 'disconnected';
  latency_ms?: number;
}

export interface RelayStats {
  id: string;
  bytes_in: number;
  bytes_out: number;
  connected_at?: string;
  latency_ms?: number;
}

export interface DnsConfig {
  upstream_servers: string[];
  blocking_enabled: boolean;
  cache_size: number;
}

export interface DnsBlocklist {
  id: string;
  name: string;
  url: string;
  entries_count: number;
  last_refresh?: string;
  enabled: boolean;
}

export interface DnsRecord {
  name: string;
  record_type: string;
  value: string;
}

export interface DnsStats {
  total_queries: number;
  blocked_queries: number;
  cache_hits: number;
  cache_misses: number;
}

export interface DnsQueryPayload {
  domain: string;
  type?: string;
}

export interface DnsQueryResult {
  domain: string;
  type: string;
  answers: string[];
  blocked: boolean;
}

export interface DnsDeleteRecordPayload {
  name: string;
  record_type: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT
// ═══════════════════════════════════════════════════════════════════════════

const client = () => getClient(ServiceName.SECURELINK);

export const securelinkApi = {
  // ─── Dashboard ────────────────────────────────────────────────────────────
  dashboard: {
    stats: () =>
      client().get<DashboardStats>('/dashboard/stats'),

    traffic: () =>
      client().get<DashboardTraffic[]>('/dashboard/traffic'),
  },

  // ─── Tunnels ──────────────────────────────────────────────────────────────
  tunnels: {
    list: () =>
      client().get<Tunnel[]>('/tunnels'),

    create: (data: Partial<Tunnel>) =>
      client().post<Tunnel>('/tunnels', data),

    bulk: (payload: BulkTunnelPayload) =>
      client().post('/tunnels/bulk', payload),

    quickConnect: (data: QuickConnectPayload) =>
      client().post<Tunnel>('/tunnels/quick', data),

    get: (id: string) =>
      client().get<Tunnel>(`/tunnels/${id}`),

    delete: (id: string) =>
      client().delete(`/tunnels/${id}`),

    status: (id: string) =>
      client().get<TunnelStatus>(`/tunnels/${id}/status`),

    reconnect: (id: string) =>
      client().post(`/tunnels/${id}/reconnect`),
  },

  // ─── Relays ───────────────────────────────────────────────────────────────
  relays: {
    list: () =>
      client().get<Relay[]>('/relays'),

    create: (data: Partial<Relay>) =>
      client().post<Relay>('/relays', data),

    get: (id: string) =>
      client().get<Relay>(`/relays/${id}`),

    delete: (id: string) =>
      client().delete(`/relays/${id}`),

    test: (id: string) =>
      client().post(`/relays/${id}/test`),

    connect: (id: string) =>
      client().post(`/relays/${id}/connect`),

    disconnect: (id: string) =>
      client().post(`/relays/${id}/disconnect`),

    stats: (id: string) =>
      client().get<RelayStats>(`/relays/${id}/stats`),
  },

  // ─── DNS ──────────────────────────────────────────────────────────────────
  dns: {
    config: () =>
      client().get<DnsConfig>('/dns/config'),

    updateConfig: (data: Partial<DnsConfig>) =>
      client().put<DnsConfig>('/dns/config', data),

    blocklists: () =>
      client().get<DnsBlocklist[]>('/dns/blocklists'),

    addBlocklist: (data: { name: string; url: string }) =>
      client().post<DnsBlocklist>('/dns/blocklists', data),

    getBlocklist: (id: string) =>
      client().get<DnsBlocklist>(`/dns/blocklists/${id}`),

    deleteBlocklist: (id: string) =>
      client().delete(`/dns/blocklists/${id}`),

    refreshBlocklist: (id: string) =>
      client().post(`/dns/blocklists/${id}/refresh`),

    records: () =>
      client().get<DnsRecord[]>('/dns/records'),

    addRecord: (data: DnsRecord) =>
      client().post<DnsRecord>('/dns/records', data),

    deleteRecord: (data: DnsDeleteRecordPayload) =>
      client().delete('/dns/records', { data }),

    stats: () =>
      client().get<DnsStats>('/dns/stats'),

    resetStats: () =>
      client().post('/dns/stats/reset'),

    query: (domain: string, type?: string) =>
      client().post<DnsQueryResult>('/dns/query', { domain, type } as DnsQueryPayload),

    flushCache: () =>
      client().post('/dns/cache/flush'),
  },
};
