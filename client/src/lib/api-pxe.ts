import { getClient, ServiceName } from '@/lib/api/factory'

// Get PXE client using factory with HttpOnly cookies
const pxeClient = getClient(ServiceName.PXE)

// ============================================================================
// Types
// ============================================================================

export interface PxeProfile {
    id: string
    name: string
    description?: string
    boot_script: string
    os_type?: string
    os_version?: string
    is_default?: boolean
    created_at?: string
    updated_at?: string
}

export interface PxeAsset {
    id: string
    mac_address: string
    hostname?: string
    ip_address?: string // Serialized from ipnetwork::IpNetwork
    status: string // 'discovered' | 'provisioning' | 'deployed' | 'offline'
    profile_id?: string
    assigned_user_id?: string
    metadata?: Record<string, unknown>
    last_seen?: string
    created_at?: string
    updated_at?: string
}

export interface CreatePxeProfileRequest {
    name: string
    description?: string
    boot_script: string
    os_type?: string
    os_version?: string
    is_default?: boolean
}

export interface UpdatePxeProfileRequest {
    name?: string
    description?: string
    boot_script?: string
    os_type?: string
    os_version?: string
    is_default?: boolean
}

export interface RegisterPxeAssetRequest {
    mac_address: string
    hostname?: string
    profile_id?: string
}

export interface UpdatePxeAssetRequest {
    hostname?: string
    status?: string // 'discovered' | 'provisioning' | 'deployed' | 'offline'
    profile_id?: string
    metadata?: Record<string, unknown>
}

// ============================================================================
// Profile API
// ============================================================================

export const profileApi = {
    list: async (): Promise<PxeProfile[]> => {
        const res = await pxeClient.get('/profiles')
        return res.data
    },

    get: async (id: string): Promise<PxeProfile> => {
        const res = await pxeClient.get(`/profiles/${id}`)
        return res.data
    },

    create: async (data: CreatePxeProfileRequest): Promise<PxeProfile> => {
        const res = await pxeClient.post('/profiles', data)
        return res.data
    },

    update: async (id: string, data: UpdatePxeProfileRequest): Promise<PxeProfile> => {
        const res = await pxeClient.put(`/profiles/${id}`, data)
        return res.data
    },

    delete: async (id: string): Promise<void> => {
        await pxeClient.delete(`/profiles/${id}`)
    },
}

// ============================================================================
// Asset API
// ============================================================================

export const assetApi = {
    list: async (): Promise<PxeAsset[]> => {
        const res = await pxeClient.get('/assets')
        return res.data
    },

    get: async (id: string): Promise<PxeAsset> => {
        const res = await pxeClient.get(`/assets/${id}`)
        return res.data
    },

    register: async (data: RegisterPxeAssetRequest): Promise<PxeAsset> => {
        const res = await pxeClient.post('/assets', data)
        return res.data
    },

    update: async (id: string, data: UpdatePxeAssetRequest): Promise<PxeAsset> => {
        const res = await pxeClient.put(`/assets/${id}`, data)
        return res.data
    },

    delete: async (id: string): Promise<void> => {
        await pxeClient.delete(`/assets/${id}`)
    },
}

// ============================================================================
// Combined API export
// ============================================================================

export const pxeApi = {
    profiles: profileApi,
    assets: assetApi,
}

export default pxeApi
