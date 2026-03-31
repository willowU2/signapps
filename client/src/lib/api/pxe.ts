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
// Images
// ============================================================================

export interface PxeImage {
    id: string;
    name: string;
    os_type: string;
    os_version?: string;
    image_type: string;
    file_path: string;
    file_size?: number;
    file_hash?: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
}

// ============================================================================
// Deployments
// ============================================================================

export interface PxeDeployment {
    id: string;
    asset_mac: string;
    profile_id?: string;
    status: string;
    progress: number;
    current_step?: string;
    started_at?: string;
    completed_at?: string;
    error_message?: string;
    created_at?: string;
    updated_at?: string;
}

// ============================================================================
// Post-deploy hooks
// ============================================================================

export interface DomainJoinConfig {
    domain: string;
    ou?: string;
    credential_ref?: string;
}

export interface PostDeployHooks {
    run_scripts: string[];
    install_packages: string[];
    join_domain?: DomainJoinConfig;
    notify_webhook?: string;
}

// ============================================================================
// Catalog
// ============================================================================

export interface OsImage {
    name: string;
    version: string;
    arch: string;
    iso_url: string;
    sha256: string;
    size_bytes: number;
    os_type: string;
    category: string;
    description: string;
}

export interface DownloadStarted {
    download_id: string;
    name: string;
    version: string;
    iso_url: string;
    status: string;
    message: string;
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
    // Images
    // ========================================================================

    listImages: () =>
        pxeClient.get<PxeImage[]>('/pxe/images'),

    uploadImage: (formData: FormData) =>
        pxeClient.post<PxeImage>('/pxe/images', formData),

    deleteImage: (id: string) =>
        pxeClient.delete(`/pxe/images/${id}`),

    // ========================================================================
    // Deployments
    // ========================================================================

    listDeployments: () =>
        pxeClient.get<PxeDeployment[]>('/pxe/deployments'),

    // ========================================================================
    // Post-deploy hooks
    // ========================================================================

    getHooks: (profileId: string) =>
        pxeClient.get<PostDeployHooks>(`/pxe/profiles/${profileId}/hooks`),

    updateHooks: (profileId: string, hooks: PostDeployHooks) =>
        pxeClient.put<void>(`/pxe/profiles/${profileId}/hooks`, hooks),

    // ========================================================================
    // Catalog
    // ========================================================================

    listCatalog: () =>
        pxeClient.get<OsImage[]>('/pxe/catalog'),

    downloadCatalogImage: (index: number) =>
        pxeClient.post<DownloadStarted>(`/pxe/catalog/${index}/download`, {}),

    // ========================================================================
    // Boot Script
    // ========================================================================

    getBootScriptUrl: (): string =>
        `${PXE_URL}/pxe/boot.ipxe`,
};
