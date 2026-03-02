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

// Alerts API - synced with backend /api/v1/alerts routes
export const alertsApi = {
    // Alert configurations (CRUD on /alerts)
    listConfigs: () => metricsApiClient.get<AlertConfig[]>('/alerts'),
    getConfig: (id: string) => metricsApiClient.get<AlertConfig>(`/alerts/${id}`),
    createConfig: (data: CreateAlertConfigRequest) =>
        metricsApiClient.post<AlertConfig>('/alerts', data),
    updateConfig: (id: string, data: Partial<CreateAlertConfigRequest>) =>
        metricsApiClient.put<AlertConfig>(`/alerts/${id}`, data),
    deleteConfig: (id: string) => metricsApiClient.delete(`/alerts/${id}`),
    toggleConfig: (id: string, enabled: boolean) =>
        metricsApiClient.put<AlertConfig>(`/alerts/${id}`, { enabled }),
    // Active alerts (currently firing)
    listActive: () => metricsApiClient.get<AlertEvent[]>('/alerts/active'),
    // Alert event history
    listHistory: (limit?: number, offset?: number) =>
        metricsApiClient.get<AlertEvent[]>('/alerts/events', { params: { limit, status: undefined } }),
    // Acknowledge an active alert event
    acknowledge: (id: string, acknowledged_by: string = 'admin') =>
        metricsApiClient.post(`/alerts/${id}/acknowledge`, { acknowledged_by }),
};

// Alert severity levels
export type AlertSeverity = 'info' | 'warning' | 'critical';

// Alert status
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

// Metric types supported by the backend
export type MetricType = 'cpu_usage' | 'memory_usage' | 'disk_usage' | 'disk_io' | 'network_in' | 'network_out' | 'custom';

// Comparison operators
export type Operator = 'greater_than' | 'greater_than_or_equal' | 'less_than' | 'less_than_or_equal' | 'equal' | 'not_equal';

// Alert configuration (synced with backend AlertConfig)
export interface AlertConfig {
    id: string;
    name: string;
    description?: string;
    metric_type: MetricType;
    metric_target?: string; // e.g., disk name or network interface
    operator: Operator;
    threshold: number;
    severity: AlertSeverity;
    duration_seconds: number;
    enabled: boolean;
    notify_channels: string[];
    webhook_url?: string;
    created_at: string;
    updated_at: string;
    // Legacy compatibility fields
    metric?: 'cpu' | 'memory' | 'disk' | 'network';
    condition?: 'above' | 'below';
}

// Request to create an alert configuration
export interface CreateAlertConfigRequest {
    name: string;
    description?: string;
    metric_type: MetricType;
    metric_target?: string;
    operator: Operator;
    threshold: number;
    severity: AlertSeverity;
    duration_seconds?: number;
    enabled?: boolean;
    notify_channels?: string[];
    webhook_url?: string;
}

// Alert event (when an alert is triggered)
export interface AlertEvent {
    id: string;
    config_id: string;
    config_name: string;
    status: AlertStatus;
    severity: AlertSeverity;
    metric_type: MetricType;
    metric_value: number;
    threshold: number;
    message: string;
    triggered_at: string;
    acknowledged_at?: string;
    acknowledged_by?: string;
    resolved_at?: string;
    // Legacy compatibility
    current_value?: number;
    metric?: 'cpu' | 'memory' | 'disk' | 'network';
}
