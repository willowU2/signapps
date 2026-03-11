export const IDENTITY_API = "http://localhost:3001/api/v1"
export const METRICS_API = "http://localhost:3008/api/v1"

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

// Mock data helpers for development (until backend auth/cors flows are perfect)
export async function getUsers(): Promise<User[]> {
    try {
        const res = await fetch(`${IDENTITY_API}/users`)
        if (!res.ok) throw new Error("Failed to fetch users")
        return res.json()
    } catch (e) {
        console.debug("Using mock users data due to API error:", e)
        return [
            { id: "1", username: "admin", email: "admin@example.com", display_name: "Admin User", role: 2, mfa_enabled: false, auth_provider: "local", created_at: new Date().toISOString(), last_login: new Date().toISOString() },
            { id: "2", username: "user", email: "user@example.com", display_name: "Regular User", role: 1, mfa_enabled: false, auth_provider: "local", created_at: new Date().toISOString(), last_login: new Date().toISOString() },
            { id: "3", username: "guest", email: "guest@example.com", display_name: "Guest User", role: 0, mfa_enabled: false, auth_provider: "local", created_at: new Date().toISOString() },
        ]
    }
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
    try {
        const res = await fetch(`${METRICS_API}/metrics/summary`)
        if (!res.ok) throw new Error("Failed to fetch metrics")
        return res.json()
    } catch (e) {
        console.debug("Using mock metrics data due to API error:", e)
        return {
            cpu_usage: Math.random() * 100,
            memory_usage: Math.random() * 100,
            disk_usage: 45,
            uptime: 12345
        }
    }
}
