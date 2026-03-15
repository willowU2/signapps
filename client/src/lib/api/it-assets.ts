/**
 * IT Assets API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from './factory';

// Get the IT assets service client (cached)
const itAssetsClient = getClient(ServiceName.IT_ASSETS);

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
        itAssetsClient.get<HardwareAsset[]>('/it-assets/hardware'),

    // Get a single hardware asset
    getHardware: (id: string) =>
        itAssetsClient.get<HardwareAsset>(`/it-assets/hardware/${id}`),

    // Create a new hardware asset
    createHardware: (data: CreateHardwareRequest) =>
        itAssetsClient.post<HardwareAsset>('/it-assets/hardware', data),

    // Update a hardware asset
    updateHardware: (id: string, data: UpdateHardwareRequest) =>
        itAssetsClient.put<HardwareAsset>(`/it-assets/hardware/${id}`, data),

    // Delete a hardware asset
    deleteHardware: (id: string) =>
        itAssetsClient.delete(`/it-assets/hardware/${id}`),
};
