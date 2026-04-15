/**
 * Tunnel/SecureLink API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from "./factory";

// Get the securelink service client (cached)
const securelinkClient = getClient(ServiceName.SECURELINK);

// Tunnel/SecureLink API (Web Tunnels - VPN sans client)
export const tunnelApi = {
  // Tunnels
  listTunnels: () => securelinkClient.get<TunnelsListResponse>("/tunnels"),
  getTunnel: (id: string) => securelinkClient.get<Tunnel>(`/tunnels/${id}`),
  createTunnel: (data: CreateTunnelRequest) =>
    securelinkClient.post<Tunnel>("/tunnels", data),
  updateTunnel: (id: string, data: Partial<CreateTunnelRequest>) =>
    securelinkClient.put<Tunnel>(`/tunnels/${id}`, data),
  deleteTunnel: (id: string) => securelinkClient.delete(`/tunnels/${id}`),
  reconnectTunnel: (id: string) =>
    securelinkClient.post(`/tunnels/${id}/reconnect`),
  getTunnelStats: (id: string) =>
    securelinkClient.get<TunnelStats>(`/tunnels/${id}/stats`),

  // Relays
  listRelays: () => securelinkClient.get<RelaysListResponse>("/relays"),
  getRelay: (id: string) => securelinkClient.get<Relay>(`/relays/${id}`),
  addRelay: (data: AddRelayRequest) =>
    securelinkClient.post<Relay>("/relays", data),
  updateRelay: (id: string, data: Partial<AddRelayRequest>) =>
    securelinkClient.put<Relay>(`/relays/${id}`, data),
  deleteRelay: (id: string) => securelinkClient.delete(`/relays/${id}`),
  testRelay: (id: string) =>
    securelinkClient.post<RelayTestResult>(`/relays/${id}/test`),
  setPrimaryRelay: (id: string) =>
    securelinkClient.post(`/relays/${id}/set-primary`),

  // DNS & Blocking
  getDnsConfig: () => securelinkClient.get<DnsConfig>("/dns/config"),
  updateDnsConfig: (data: Partial<DnsConfig>) =>
    securelinkClient.put<DnsConfig>("/dns/config", data),
  getDnsStats: () => securelinkClient.get<DnsStats>("/dns/stats"),
  addBlocklist: (data: AddBlocklistRequest) =>
    securelinkClient.post<Blocklist>("/dns/blocklists", data),
  removeBlocklist: (id: string) =>
    securelinkClient.delete(`/dns/blocklists/${id}`),
  toggleBlocklist: (id: string, enabled: boolean) =>
    securelinkClient.patch(`/dns/blocklists/${id}`, { enabled }),
  addDnsRecord: (data: CustomDnsRecord) =>
    securelinkClient.post<CustomDnsRecord>("/dns/records", data),
  updateDnsRecord: (id: string, data: Partial<CustomDnsRecord>) =>
    securelinkClient.put<CustomDnsRecord>(`/dns/records/${id}`, data),
  deleteDnsRecord: (id: string) =>
    securelinkClient.delete(`/dns/records/${id}`),

  // Dashboard stats
  getDashboardStats: () =>
    securelinkClient.get<TunnelDashboardStats>("/dashboard/stats"),
  getTrafficHistory: (period: "1h" | "24h" | "7d" | "30d") =>
    securelinkClient.get<TrafficDataPoint[]>("/dashboard/traffic", {
      params: { period },
    }),
  quickConnect: (data?: { local_addr?: string }) =>
    securelinkClient.post<Tunnel>("/tunnels/quick", data || {}),
};

// Tunnel types
export interface Tunnel {
  id: string;
  name: string;
  local_addr: string;
  subdomain: string;
  public_url: string;
  status: "connected" | "disconnected" | "connecting" | "error";
  relay_id: string;
  relay_name?: string;
  bytes_in: number;
  bytes_out: number;
  last_connected?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface TunnelsListResponse {
  tunnels: Tunnel[];
  total: number;
}

export interface CreateTunnelRequest {
  name: string;
  local_addr: string;
  subdomain: string;
  relay_id: string;
}

export interface TunnelStats {
  tunnel_id: string;
  bytes_in_total: number;
  bytes_out_total: number;
  requests_total: number;
  connections_active: number;
  uptime_seconds: number;
  last_activity?: string;
}

// Relay types
export interface Relay {
  id: string;
  name: string;
  url: string;
  is_primary: boolean;
  status: "connected" | "disconnected" | "error";
  tunnels_count: number;
  latency_ms?: number;
  region?: string;
  created_at: string;
  updated_at: string;
}

export interface RelaysListResponse {
  relays: Relay[];
  total: number;
}

export interface AddRelayRequest {
  name: string;
  url: string;
  token?: string;
  is_primary?: boolean;
}

export interface RelayTestResult {
  success: boolean;
  latency_ms?: number;
  error?: string;
}

// DNS types
export interface DnsConfig {
  enabled: boolean;
  upstream: string[];
  adblock_enabled: boolean;
  blocklists: Blocklist[];
  custom_records: CustomDnsRecord[];
}

export interface DnsStats {
  total_queries: number;
  blocked_queries: number;
  blocked_percent: number;
  queries_today: number;
  blocked_today: number;
  top_blocked_domains?: { domain: string; count: number }[];
}

export interface Blocklist {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  entries_count: number;
  last_updated?: string;
}

export interface AddBlocklistRequest {
  name: string;
  url: string;
  enabled?: boolean;
}

export interface CustomDnsRecord {
  id?: string;
  type: "A" | "AAAA" | "CNAME" | "TXT";
  name: string;
  value: string;
  ttl?: number;
}

// Dashboard types
export interface TunnelDashboardStats {
  tunnels_active: number;
  tunnels_total: number;
  relay_status: "connected" | "disconnected" | "partial";
  relay_connected_count: number;
  relay_total_count: number;
  dns_queries_today: number;
  ads_blocked_today: number;
  bytes_in_today: number;
  bytes_out_today: number;
}

export interface TrafficDataPoint {
  timestamp: string;
  bytes_in: number;
  bytes_out: number;
}
