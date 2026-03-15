import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_IT_ASSETS_API_URL || 'http://localhost:3015/api/v1/it-assets'

// Create axios instance with auth
const itAssetsClient = axios.create({
    baseURL: API_URL,
})

// Add auth interceptor
itAssetsClient.interceptors.request.use((config) => {
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

export interface Hardware {
    id: string
    name: string
    type: string
    manufacturer?: string
    model?: string
    serial_number?: string
    purchase_date?: string
    warranty_expires?: string
    status?: string
    location?: string
    assigned_user_id?: string
    notes?: string
    created_at?: string
    updated_at?: string
    // Legacy compat fields
    hardware_type?: string
    mac_address?: string
    ip_address?: string
}

export interface CreateHardwareRequest {
    name: string
    type: string
    manufacturer?: string
    model?: string
    serial_number?: string
    purchase_date?: string
    warranty_expires?: string
    location?: string
    notes?: string
}

export interface UpdateHardwareRequest {
    name?: string
    status?: string
    location?: string
    assigned_user_id?: string
    notes?: string
}

// ============================================================================
// Hardware API
// ============================================================================

export const hardwareApi = {
    list: async (): Promise<Hardware[]> => {
        const res = await itAssetsClient.get('/hardware')
        return res.data
    },

    get: async (id: string): Promise<Hardware> => {
        const res = await itAssetsClient.get(`/hardware/${id}`)
        return res.data
    },

    create: async (data: CreateHardwareRequest): Promise<Hardware> => {
        const res = await itAssetsClient.post('/hardware', data)
        return res.data
    },

    update: async (id: string, data: UpdateHardwareRequest): Promise<Hardware> => {
        const res = await itAssetsClient.put(`/hardware/${id}`, data)
        return res.data
    },

    delete: async (id: string): Promise<void> => {
        await itAssetsClient.delete(`/hardware/${id}`)
    },
}

// ============================================================================
// Legacy exports for backward compatibility
// ============================================================================

export async function getHardware(): Promise<Hardware[]> {
    return hardwareApi.list()
}

export async function createHardware(hardware: Omit<Hardware, "id">): Promise<Hardware> {
    return hardwareApi.create({
        name: hardware.name,
        type: hardware.type || hardware.hardware_type || 'unknown',
        manufacturer: hardware.manufacturer,
        model: hardware.model,
        serial_number: hardware.serial_number,
        purchase_date: hardware.purchase_date,
        warranty_expires: hardware.warranty_expires,
        location: hardware.location,
        notes: hardware.notes,
    })
}

// ============================================================================
// Combined API export
// ============================================================================

export const itAssetsApi = {
    hardware: hardwareApi,
}

export default itAssetsApi
