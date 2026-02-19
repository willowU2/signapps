import { securelinkApiClient } from './core';

// Tunnel/SecureLink API (Web Tunnels - VPN sans client)
export const tunnelApi = {
    // Tunnels
    listTunnels: () => securelinkApiClient.get<TunnelsListResponse>('/tunnels'),
    getTunnel: (id: string) => securelinkApiClient.get<Tunnel>(`/tunnels/${id}`),
    createTunnel: (data: CreateTunnelRequest) =>
        securelinkApiClient.post<Tunnel>('/tunnels', data),
    updateTunnel: (id: string, data: Partial<CreateTunnelRequest>) =>
        securelinkApiClient.put<Tunnel>(`/tunnels/${id}`, data),
    deleteTunnel: (id: string) => securelinkApiClient.delete(`/tunnels/${id}`),
    reconnectTunnel: (id: string) => securelinkApiClient.post(`/tunnels/${id}/reconnect`),
    getTunnelStats: (id: string) => securelinkApiClient.get<TunnelStats>(`/tunnels/${id}/stats`),

    // Relays
    listRelays: () => securelinkApiClient.get<RelaysListResponse>('/relays'),
    getRelay: (id: string) => securelinkApiClient.get<Relay>(`/relays/${id}`),
    addRelay: (data: AddRelayRequest) =>
        securelinkApiClient.post<Relay>('/relays', data),
    updateRelay: (id: string, data: Partial<AddRelayRequest>) =>
        securelinkApiClient.put<Relay>(`/relays/${id}`, data),
    deleteRelay: (id: string) => securelinkApiClient.delete(`/relays/${id}`),
    testRelay: (id: string) => securelinkApiClient.post<RelayTestResult>(`/relays/${id}/test`),
    setPrimaryRelay: (id: string) => securelinkApiClient.post(`/relays/${id}/set-primary`),

    // DNS & Blocking
    getDnsConfig: () => securelinkApiClient.get<DnsConfig>('/dns/config'),
    updateDnsConfig: (data: Partial<DnsConfig>) =>
        securelinkApiClient.put<DnsConfig>('/dns/config', data),
    getDnsStats: () => securelinkApiClient.get<DnsStats>('/dns/stats'),
    addBlocklist: (data: AddBlocklistRequest) =>
        securelinkApiClient.post<Blocklist>('/dns/blocklists', data),
    removeBlocklist: (id: string) => securelinkApiClient.delete(`/dns/blocklists/${id}`),
    toggleBlocklist: (id: string, enabled: boolean) =>
        securelinkApiClient.patch(`/dns/blocklists/${id}`, { enabled }),
    addDnsRecord: (data: CustomDnsRecord) =>
        securelinkApiClient.post<CustomDnsRecord>('/dns/records', data),
    updateDnsRecord: (id: string, data: Partial<CustomDnsRecord>) =>
        securelinkApiClient.put<CustomDnsRecord>(`/dns/records/${id}`, data),
    deleteDnsRecord: (id: string) => securelinkApiClient.delete(`/dns/records/${id}`),

    // Dashboard stats
    getDashboardStats: () => securelinkApiClient.get<TunnelDashboardStats>('/dashboard/stats'),
    getTrafficHistory: (period: '1h' | '24h' | '7d' | '30d') =>
        securelinkApiClient.get<TrafficDataPoint[]>('/dashboard/traffic', { params: { period } }),
    quickConnect: (data?: { local_addr?: string }) =>
        securelinkApiClient.post<Tunnel>('/tunnels/quick', data || {}),
};

// Tunnel types
export interface Tunnel {
    id: string;
    name: string;
    local_addr: string;
    subdomain: string;
    public_url: string;
    status: 'connected' | 'disconnected' | 'connecting' | 'error';
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
    status: 'connected' | 'disconnected' | 'error';
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
    type: 'A' | 'AAAA' | 'CNAME' | 'TXT';
    name: string;
    value: string;
    ttl?: number;
}

// Dashboard types
export interface TunnelDashboardStats {
    tunnels_active: number;
    tunnels_total: number;
    relay_status: 'connected' | 'disconnected' | 'partial';
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
