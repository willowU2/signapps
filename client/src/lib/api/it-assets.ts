import { itAssetsApiClient } from './core';

// ============================================================================
// Types
// ============================================================================

export interface HardwareAsset {
    id: string;
    name: string;
    type: string;
    manufacturer?: string;
    model?: string;
    serial_number?: string;
    purchase_date?: string;
    warranty_expires?: string;
    status?: string;
    location?: string;
    assigned_user_id?: string;
    notes?: string;
    created_at?: string;
    updated_at?: string;
}

export interface CreateHardwareRequest {
    name: string;
    type: string;
    manufacturer?: string;
    model?: string;
    serial_number?: string;
    purchase_date?: string;
    warranty_expires?: string;
    location?: string;
    notes?: string;
}

export interface UpdateHardwareRequest {
    name?: string;
    status?: string;
    location?: string;
    assigned_user_id?: string;
    notes?: string;
}

// ============================================================================
// IT Assets API
// ============================================================================

export const itAssetsApi = {
    // List all hardware assets
    listHardware: () =>
        itAssetsApiClient.get<HardwareAsset[]>('/it-assets/hardware'),

    // Get a single hardware asset
    getHardware: (id: string) =>
        itAssetsApiClient.get<HardwareAsset>(`/it-assets/hardware/${id}`),

    // Create a new hardware asset
    createHardware: (data: CreateHardwareRequest) =>
        itAssetsApiClient.post<HardwareAsset>('/it-assets/hardware', data),

    // Update a hardware asset
    updateHardware: (id: string, data: UpdateHardwareRequest) =>
        itAssetsApiClient.put<HardwareAsset>(`/it-assets/hardware/${id}`, data),

    // Delete a hardware asset
    deleteHardware: (id: string) =>
        itAssetsApiClient.delete(`/it-assets/hardware/${id}`),
};
