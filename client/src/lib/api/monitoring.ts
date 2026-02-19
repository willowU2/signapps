import { metricsApiClient } from './core';

// Metrics API
export const metricsApi = {
    all: () => metricsApiClient.get<SystemMetrics>('/metrics'),
    summary: () => metricsApiClient.get<SystemMetrics>('/metrics/summary'),
    health: () => metricsApiClient.get('/health'),
    cpu: () => metricsApiClient.get<CpuMetrics>('/metrics/cpu'),
    memory: () => metricsApiClient.get<MemoryMetrics>('/metrics/memory'),
    disk: () => metricsApiClient.get<DiskMetrics[]>('/metrics/disk'),
    network: () => metricsApiClient.get<NetworkMetrics>('/metrics/network'),
    // Alias for backward compatibility
    system: () => metricsApiClient.get<SystemMetrics>('/metrics/summary'),
    // History for charts
    history: (period: '5m' | '15m' | '1h' | '24h') =>
        metricsApiClient.get<MetricHistoryPoint[]>('/metrics/history', { params: { period } }),
};

export interface SystemMetrics {
    // API response fields
    hostname?: string;
    os_name?: string;
    uptime_seconds?: number;
    cpu_cores?: number;
    cpu_usage_percent?: number;
    memory_total_bytes?: number;
    memory_used_bytes?: number;
    memory_usage_percent?: number;
    disk_total_bytes?: number;
    disk_used_bytes?: number;
    disk_usage_percent?: number;
    network_rx_bytes?: number;
    network_tx_bytes?: number;
    // Legacy fields for compatibility
    cpu?: number;
    memory?: number;
    disk?: number;
    uptime?: number;
    load_average?: number[];
}

export interface CpuMetrics {
    usage_percent: number;
    cores: number;
    frequency_mhz?: number;
}

export interface MemoryMetrics {
    total: number;
    used: number;
    available: number;
    percent: number;
}

export interface DiskMetrics {
    name?: string;
    mount_point: string;
    file_system?: string;
    total: number;
    used: number;
    available: number;
    percent: number;
    // API returns these field names
    total_bytes?: number;
    used_bytes?: number;
    available_bytes?: number;
    usage_percent?: number;
    is_removable?: boolean;
}

export interface NetworkMetrics {
    bytes_sent: number;
    bytes_recv: number;
    packets_sent: number;
    packets_recv: number;
}

export interface MetricHistoryPoint {
    timestamp: string;
    cpu: number;
    memory: number;
    disk: number;
    network_rx: number;
    network_tx: number;
}

// Alerts API
export const alertsApi = {
    // Alert configurations
    listConfigs: () => metricsApiClient.get<AlertConfig[]>('/alerts/configs'),
    getConfig: (id: string) => metricsApiClient.get<AlertConfig>(`/alerts/configs/${id}`),
    createConfig: (data: CreateAlertConfigRequest) =>
        metricsApiClient.post<AlertConfig>('/alerts/configs', data),
    updateConfig: (id: string, data: Partial<CreateAlertConfigRequest>) =>
        metricsApiClient.put<AlertConfig>(`/alerts/configs/${id}`, data),
    deleteConfig: (id: string) => metricsApiClient.delete(`/alerts/configs/${id}`),
    toggleConfig: (id: string, enabled: boolean) =>
        metricsApiClient.patch(`/alerts/configs/${id}`, { enabled }),
    // Active alerts
    listActive: () => metricsApiClient.get<AlertEvent[]>('/alerts/active'),
    // Alert history
    listHistory: (limit?: number, offset?: number) =>
        metricsApiClient.get<AlertHistoryResponse>('/alerts/history', { params: { limit, offset } }),
    // Acknowledge alert
    acknowledge: (id: string) => metricsApiClient.post(`/alerts/${id}/acknowledge`),
    // Test alert notification
    testNotification: (configId: string) =>
        metricsApiClient.post(`/alerts/configs/${configId}/test`),
};

export interface AlertConfig {
    id: string;
    name: string;
    metric: 'cpu' | 'memory' | 'disk' | 'network';
    condition: 'above' | 'below';
    threshold: number;
    duration_seconds: number;
    enabled: boolean;
    actions: AlertAction[];
    created_at: string;
    updated_at: string;
}

export interface AlertAction {
    type: 'email' | 'webhook' | 'browser';
    config: {
        email?: string;
        webhook_url?: string;
    };
}

export interface CreateAlertConfigRequest {
    name: string;
    metric: 'cpu' | 'memory' | 'disk' | 'network';
    condition: 'above' | 'below';
    threshold: number;
    duration_seconds?: number;
    actions: AlertAction[];
}

export interface AlertEvent {
    id: string;
    config_id: string;
    config_name: string;
    metric: 'cpu' | 'memory' | 'disk' | 'network';
    current_value: number;
    threshold: number;
    severity: 'warning' | 'critical';
    message: string;
    triggered_at: string;
    acknowledged_at?: string;
    acknowledged_by?: string;
    resolved_at?: string;
}

export interface AlertHistoryResponse {
    alerts: AlertEvent[];
    total: number;
}
