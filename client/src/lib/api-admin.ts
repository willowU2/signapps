export const IDENTITY_API = "http://localhost:3001/api/v1"
export const METRICS_API = "http://localhost:3008/api/v1"

// Types
export interface User {
    id: string
    username: string
    email: string
    full_name: string
    is_active: boolean
    is_admin: boolean
    created_at: string
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
        console.warn("Using mock users data due to API error:", e)
        return [
            { id: "1", username: "admin", email: "admin@example.com", full_name: "Admin User", is_active: true, is_admin: true, created_at: new Date().toISOString() },
            { id: "2", username: "user", email: "user@example.com", full_name: "Regular User", is_active: true, is_admin: false, created_at: new Date().toISOString() },
            { id: "3", username: "guest", email: "guest@example.com", full_name: "Guest User", is_active: false, is_admin: false, created_at: new Date().toISOString() },
        ]
    }
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
    try {
        const res = await fetch(`${METRICS_API}/metrics/summary`)
        if (!res.ok) throw new Error("Failed to fetch metrics")
        return res.json()
    } catch (e) {
        console.warn("Using mock metrics data due to API error:", e)
        return {
            cpu_usage: Math.random() * 100,
            memory_usage: Math.random() * 100,
            disk_usage: 45,
            uptime: 12345
        }
    }
}
