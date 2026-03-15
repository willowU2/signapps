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

export async function getUsers(): Promise<User[]> {
    const res = await fetch(`${IDENTITY_API}/users`)
    if (!res.ok) throw new Error("Impossible de charger les utilisateurs")
    return res.json()
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
    const res = await fetch(`${METRICS_API}/metrics/summary`)
    if (!res.ok) throw new Error("Impossible de charger les métriques")
    return res.json()
}
