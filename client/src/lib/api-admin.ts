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
        const res = await client.get('/metrics/summary');
        return res.data;
    } catch (err) {
        console.error("Failed to fetch metrics:", err);
        throw new Error("Impossible de charger les métriques");
    }
}
