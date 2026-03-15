/**
 * PXE API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, getServiceBaseUrl, ServiceName } from './factory';

// Get the PXE service client (cached)
const pxeClient = getClient(ServiceName.PXE);
const PXE_URL = getServiceBaseUrl(ServiceName.PXE);

// ============================================================================
// Types
// ============================================================================

export interface PxeProfile {
    id: string;
    name: string;
    description?: string;
    boot_script: string;
    os_type?: string;
    os_version?: string;
    is_default?: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface CreatePxeProfileRequest {
    name: string;
    description?: string;
    boot_script: string;
    os_type?: string;
    os_version?: string;
    is_default?: boolean;
}

export interface UpdatePxeProfileRequest {
    name?: string;
    description?: string;
    boot_script?: string;
    os_type?: string;
    os_version?: string;
    is_default?: boolean;
}

export interface PxeAsset {
    id: string;
    mac_address: string;
    hostname?: string;
    ip_address?: string;
    status: string;
    profile_id?: string;
    assigned_user_id?: string;
    metadata?: Record<string, unknown>;
    last_seen?: string;
    created_at?: string;
    updated_at?: string;
}

export interface RegisterPxeAssetRequest {
    mac_address: string;
    hostname?: string;
    profile_id?: string;
}

export interface UpdatePxeAssetRequest {
    hostname?: string;
    status?: string;
    profile_id?: string;
    metadata?: Record<string, unknown>;
}

// ============================================================================
// PXE API
// ============================================================================

export const pxeApi = {
    // ========================================================================
    // Profiles
    // ========================================================================

    listProfiles: () =>
        pxeClient.get<PxeProfile[]>('/pxe/profiles'),

    getProfile: (id: string) =>
        pxeClient.get<PxeProfile>(`/pxe/profiles/${id}`),

    createProfile: (data: CreatePxeProfileRequest) =>
        pxeClient.post<PxeProfile>('/pxe/profiles', data),

    updateProfile: (id: string, data: UpdatePxeProfileRequest) =>
        pxeClient.put<PxeProfile>(`/pxe/profiles/${id}`, data),

    deleteProfile: (id: string) =>
        pxeClient.delete(`/pxe/profiles/${id}`),

    // ========================================================================
    // Assets
    // ========================================================================

    listAssets: () =>
        pxeClient.get<PxeAsset[]>('/pxe/assets'),

    getAsset: (id: string) =>
        pxeClient.get<PxeAsset>(`/pxe/assets/${id}`),

    registerAsset: (data: RegisterPxeAssetRequest) =>
        pxeClient.post<PxeAsset>('/pxe/assets', data),

    updateAsset: (id: string, data: UpdatePxeAssetRequest) =>
        pxeClient.put<PxeAsset>(`/pxe/assets/${id}`, data),

    deleteAsset: (id: string) =>
        pxeClient.delete(`/pxe/assets/${id}`),

    // ========================================================================
    // Boot Script
    // ========================================================================

    getBootScriptUrl: (): string =>
        `${PXE_URL}/pxe/boot.ipxe`,
};
