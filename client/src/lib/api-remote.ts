import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_REMOTE_API_URL || 'http://localhost:3017/api/v1/remote'

// Create axios instance with auth
const remoteClient = axios.create({
    baseURL: API_URL,
})

// Add auth interceptor
remoteClient.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
    }
    return config
})

// ============================================================================
// Types
// ============================================================================

export interface RemoteConnection {
    id: string
    hardware_id?: string
    name: string
    protocol: string // 'rdp' | 'vnc' | 'ssh' | 'telnet'
    hostname: string
    port: number
    username?: string
    parameters?: Record<string, unknown>
    created_at?: string
    updated_at?: string
}

export interface CreateConnectionRequest {
    hardware_id?: string
    name: string
    protocol: string // 'rdp' | 'vnc' | 'ssh' | 'telnet'
    hostname: string
    port: number
    username?: string
    password?: string
    private_key?: string
    parameters?: Record<string, unknown>
}

export interface UpdateConnectionRequest {
    name?: string
    protocol?: string // 'rdp' | 'vnc' | 'ssh' | 'telnet'
    hostname?: string
    port?: number
    username?: string
    password?: string
    private_key?: string
    parameters?: Record<string, unknown>
}

// ============================================================================
// Connection API
// ============================================================================

export const connectionApi = {
    list: async (): Promise<RemoteConnection[]> => {
        const res = await remoteClient.get('/connections')
        return res.data
    },

    get: async (id: string): Promise<RemoteConnection> => {
        const res = await remoteClient.get(`/connections/${id}`)
        return res.data
    },

    create: async (data: CreateConnectionRequest): Promise<RemoteConnection> => {
        const res = await remoteClient.post('/connections', data)
        return res.data
    },

    update: async (id: string, data: UpdateConnectionRequest): Promise<RemoteConnection> => {
        const res = await remoteClient.put(`/connections/${id}`, data)
        return res.data
    },

    delete: async (id: string): Promise<void> => {
        await remoteClient.delete(`/connections/${id}`)
    },

    getWebSocketUrl: (connectionId: string): string => {
        const wsBase = API_URL.replace('http://', 'ws://').replace('https://', 'wss://')
        return `${wsBase}/ws/${connectionId}`
    },
}

// ============================================================================
// Combined API export
// ============================================================================

export const remoteApi = {
    connections: connectionApi,
}

export default remoteApi
