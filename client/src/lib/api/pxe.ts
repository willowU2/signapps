import { pxeApiClient, PXE_URL } from './core';

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
        pxeApiClient.get<PxeProfile[]>('/pxe/profiles'),

    getProfile: (id: string) =>
        pxeApiClient.get<PxeProfile>(`/pxe/profiles/${id}`),

    createProfile: (data: CreatePxeProfileRequest) =>
        pxeApiClient.post<PxeProfile>('/pxe/profiles', data),

    updateProfile: (id: string, data: UpdatePxeProfileRequest) =>
        pxeApiClient.put<PxeProfile>(`/pxe/profiles/${id}`, data),

    deleteProfile: (id: string) =>
        pxeApiClient.delete(`/pxe/profiles/${id}`),

    // ========================================================================
    // Assets
    // ========================================================================

    listAssets: () =>
        pxeApiClient.get<PxeAsset[]>('/pxe/assets'),

    getAsset: (id: string) =>
        pxeApiClient.get<PxeAsset>(`/pxe/assets/${id}`),

    registerAsset: (data: RegisterPxeAssetRequest) =>
        pxeApiClient.post<PxeAsset>('/pxe/assets', data),

    updateAsset: (id: string, data: UpdatePxeAssetRequest) =>
        pxeApiClient.put<PxeAsset>(`/pxe/assets/${id}`, data),

    deleteAsset: (id: string) =>
        pxeApiClient.delete(`/pxe/assets/${id}`),

    // ========================================================================
    // Boot Script
    // ========================================================================

    getBootScriptUrl: (): string =>
        `${PXE_URL}/pxe/boot.ipxe`,
};
