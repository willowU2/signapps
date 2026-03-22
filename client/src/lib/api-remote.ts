import { getClient, getServiceUrl, ServiceName } from '@/lib/api/factory'

// Get remote client using factory with HttpOnly cookies
const remoteClient = getClient(ServiceName.REMOTE)

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
        const apiUrl = getServiceUrl(ServiceName.REMOTE)
        const wsBase = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://')
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
