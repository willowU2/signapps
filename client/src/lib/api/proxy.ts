import { proxyApiClient } from './core';

// Proxy API (Routes)
export const routesApi = {
    list: () => proxyApiClient.get<Route[]>('/routes'),
    get: (id: string) => proxyApiClient.get<Route>(`/routes/${id}`),
    create: (data: CreateRouteRequest) => proxyApiClient.post<Route>('/routes', data),
    update: (id: string, data: Partial<CreateRouteRequest>) =>
        proxyApiClient.put<Route>(`/routes/${id}`, data),
    delete: (id: string) => proxyApiClient.delete(`/routes/${id}`),
    // Certificates
    listCertificates: () => proxyApiClient.get<Certificate[]>('/certificates'),
    verifyDomain: (domain: string) =>
        proxyApiClient.post(`/certificates/verify`, { domain }),
    requestCertificate: (domain: string) =>
        proxyApiClient.post(`/certificates/verify`, { domain }),
    renewCertificate: (id: string) =>
        proxyApiClient.post(`/certificates/${id}/renew`),
    deleteCertificate: (id: string) =>
        proxyApiClient.delete(`/certificates/${id}`),
    // Shield stats
    shieldStats: () => proxyApiClient.get<ShieldStats>('/shield/stats'),
    // Proxy status
    proxyStatus: () => proxyApiClient.get<ProxyStatus>('/proxy/status'),
};

export interface Route {
    id: string;
    name: string;
    host: string;
    target: string;
    mode: 'proxy' | 'redirect' | 'static' | 'loadbalancer';
    tls_enabled: boolean;
    tls_config?: TlsConfig;
    auth_required: boolean;
    enabled: boolean;
    shield_config?: ShieldConfig;
    headers?: HeadersConfig;
    dns_records?: DnsRecord[];
    created_at: string;
    updated_at: string;
}

export interface CreateRouteRequest {
    name: string;
    host: string;
    target: string;
    mode?: 'proxy' | 'redirect' | 'static' | 'loadbalancer';
    tls_enabled?: boolean;
    tls_config?: TlsConfig;
    auth_required?: boolean;
    shield_config?: ShieldConfig;
    headers?: HeadersConfig;
    dns_records?: DnsRecord[];
    enabled?: boolean;
}

export interface TlsConfig {
    wildcard: boolean;
    force_https: boolean;
    min_version?: 'TLS1.2' | 'TLS1.3';
    covered_domains?: string[];
}

export interface DnsRecord {
    type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'NS';
    name: string;
    value: string;
    ttl: number;
    priority?: number;
}

export interface ShieldConfig {
    enabled: boolean;
    requests_per_second: number;
    burst_size: number;
    block_duration_seconds: number;
    whitelist: string[];
    blacklist: string[];
    geo_block?: GeoBlockConfig;
}

export interface GeoBlockConfig {
    enabled: boolean;
    blocked_countries: string[];
}

export interface HeadersConfig {
    request_headers: HeaderEntry[];
    response_headers: HeaderEntry[];
    remove_request_headers: string[];
    remove_response_headers: string[];
}

export interface HeaderEntry {
    name: string;
    value: string;
}

export interface Certificate {
    id: string;
    domain: string;
    issuer: string;
    expires_at: string;
    auto_renew: boolean;
}

export interface ShieldStats {
    requests_total: number;
    requests_blocked: number;
    active_rules: number;
}

export interface ProxyStatus {
    http_listener: { port: number; active: boolean };
    https_listener: { port: number; active: boolean };
    routes_cached: number;
    certificates_loaded: number;
    requests_total: number;
}
