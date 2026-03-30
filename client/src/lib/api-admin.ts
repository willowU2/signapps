import { getClient, ServiceName } from './api/factory';

// Types - aligned with Rust UserResponse from signapps-identity
export interface User {
    id: string
    username: string
    email?: string
    display_name?: string
    role: number // i16 in Rust: 0=guest, 1=user, 2=admin
    mfa_enabled: boolean
    auth_provider: string
    created_at: string
    last_login?: string
}

// Helper to check if user is admin (role >= 2)
export function isAdmin(user: User): boolean {
    return user.role >= 2
}

// Helper to check if user is active (has logged in)
export function isActive(user: User): boolean {
    return !!user.last_login
}

export interface SystemMetrics {
    cpu_usage: number
    memory_usage: number
    disk_usage: number
    uptime: number
    network_rx_bytes?: number
    network_tx_bytes?: number
}

export async function getUsers(): Promise<User[]> {
    try {
        const client = getClient(ServiceName.IDENTITY);
        const res = await client.get('/users?limit=100');
        // Handle pagination response { users: [], total: ... } or direct array
        if (res.data && Array.isArray(res.data.users)) {
            return res.data.users;
        }
        if (Array.isArray(res.data)) {
            return res.data;
        }
        return [];
    } catch (err) {
        console.error("Failed to fetch users:", err);
        return [];
    }
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
    try {
        const client = getClient(ServiceName.METRICS);
        const res = await client.get('/system/summary');
        return res.data;
    } catch (err) {
        console.error("Failed to fetch metrics:", err);
        throw new Error("Impossible de charger les métriques");
    }
}

// ─── IF2: Slow query monitoring ───────────────────────────────────────────────

export interface SlowQuery {
    pid: number;
    datname: string | null;
    usename: string | null;
    application_name: string | null;
    state: string | null;
    duration_seconds: number;
    query: string | null;
    query_start: string | null;
}

export interface SlowQueriesResponse {
    queries: SlowQuery[];
    threshold_seconds: number;
    pg_stat_statements_available: boolean;
}

export async function getSlowQueries(): Promise<SlowQueriesResponse> {
    try {
        const client = getClient(ServiceName.METRICS);
        const res = await client.get('/metrics/slow-queries');
        return res.data;
    } catch {
        return { queries: [], threshold_seconds: 1, pg_stat_statements_available: false };
    }
}

// ─── IF3: DB pool stats ───────────────────────────────────────────────────────

export interface PoolStats {
    size: number;
    idle: number;
    active: number;
    max: number;
    at_capacity: boolean;
}

export async function getPoolStats(): Promise<PoolStats | null> {
    try {
        const client = getClient(ServiceName.METRICS);
        const res = await client.get('/metrics/pool-stats');
        return res.data;
    } catch {
        return null;
    }
}
