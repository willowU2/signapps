import { identityApiClient } from './core';

// ============================================================================
// Types
// ============================================================================

export interface ResourceType {
    id: string;
    tenant_id: string;
    name: string;
    icon?: string;
    color?: string;
    requires_approval: boolean;
    created_at: string;
}

export interface CreateResourceTypeRequest {
    name: string;
    icon?: string;
    color?: string;
    requires_approval?: boolean;
}

export interface Resource {
    id: string;
    tenant_id: string;
    resource_type_id?: string;
    name: string;
    resource_type: ResourceTypeCategory;
    description?: string;
    capacity?: number;
    location?: string;
    floor?: string;
    building?: string;
    amenities?: string[];
    photo_urls?: string[];
    requires_approval: boolean;
    is_available: boolean;
    created_at: string;
}

export type ResourceTypeCategory = 'room' | 'equipment' | 'vehicle' | 'desk';

export interface CreateResourceRequest {
    resource_type_id?: string;
    name: string;
    resource_type: ResourceTypeCategory;
    description?: string;
    capacity?: number;
    location?: string;
    floor?: string;
    building?: string;
    amenities?: string[];
    requires_approval?: boolean;
    approver_ids?: string[];
}

export interface UpdateResourceRequest {
    name?: string;
    description?: string;
    capacity?: number;
    location?: string;
    floor?: string;
    building?: string;
    amenities?: string[];
    photo_urls?: string[];
    requires_approval?: boolean;
    approver_ids?: string[];
    is_available?: boolean;
}

export interface Reservation {
    id: string;
    tenant_id: string;
    resource_id: string;
    event_id?: string;
    requested_by: string;
    status: ReservationStatus;
    approved_by?: string;
    approved_at?: string;
    rejection_reason?: string;
    notes?: string;
    created_at: string;
}

export type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface CreateReservationRequest {
    resource_id: string;
    event_id?: string;
    notes?: string;
}

export interface UpdateReservationStatusRequest {
    status: 'approved' | 'rejected' | 'cancelled';
    rejection_reason?: string;
}

// ============================================================================
// Resource Types API
// ============================================================================

export const resourceTypesApi = {
    /** List all resource types for current tenant */
    list: () =>
        identityApiClient.get<ResourceType[]>('/resource-types'),

    /** Create a new resource type */
    create: (data: CreateResourceTypeRequest) =>
        identityApiClient.post<ResourceType>('/resource-types', data),

    /** Delete a resource type */
    delete: (id: string) =>
        identityApiClient.delete(`/resource-types/${id}`),
};

// ============================================================================
// Resources API
// ============================================================================

export const resourcesApi = {
    /** List all resources for current tenant */
    list: (resourceType?: ResourceTypeCategory, limit?: number, offset?: number) =>
        identityApiClient.get<Resource[]>('/resources', {
            params: { resource_type: resourceType, limit, offset }
        }),

    /** Get resource by ID */
    get: (id: string) =>
        identityApiClient.get<Resource>(`/resources/${id}`),

    /** Create a new resource */
    create: (data: CreateResourceRequest) =>
        identityApiClient.post<Resource>('/resources', data),

    /** Update a resource */
    update: (id: string, data: UpdateResourceRequest) =>
        identityApiClient.put<Resource>(`/resources/${id}`, data),

    /** Delete a resource */
    delete: (id: string) =>
        identityApiClient.delete(`/resources/${id}`),
};

// ============================================================================
// Reservations API
// ============================================================================

export const reservationsApi = {
    /** List reservations for a resource */
    list: (resourceId: string, status?: ReservationStatus) =>
        identityApiClient.get<Reservation[]>('/reservations', {
            params: { resource_id: resourceId, status }
        }),

    /** List current user's reservations */
    listMine: (status?: ReservationStatus) =>
        identityApiClient.get<Reservation[]>('/reservations/mine', {
            params: { status }
        }),

    /** List pending reservations for approval (current user as approver) */
    listPending: () =>
        identityApiClient.get<Reservation[]>('/reservations/pending'),

    /** Get reservation by ID */
    get: (id: string) =>
        identityApiClient.get<Reservation>(`/reservations/${id}`),

    /** Create a new reservation */
    create: (data: CreateReservationRequest) =>
        identityApiClient.post<Reservation>('/reservations', data),

    /** Update reservation status (approve/reject/cancel) */
    updateStatus: (id: string, data: UpdateReservationStatusRequest) =>
        identityApiClient.put<Reservation>(`/reservations/${id}/status`, data),

    /** Approve a reservation */
    approve: (id: string) =>
        identityApiClient.put<Reservation>(`/reservations/${id}/status`, { status: 'approved' }),

    /** Reject a reservation */
    reject: (id: string, reason?: string) =>
        identityApiClient.put<Reservation>(`/reservations/${id}/status`, {
            status: 'rejected',
            rejection_reason: reason
        }),

    /** Cancel a reservation */
    cancel: (id: string) =>
        identityApiClient.put<Reservation>(`/reservations/${id}/status`, { status: 'cancelled' }),
};

// ============================================================================
// Helper functions
// ============================================================================

export function getResourceTypeIcon(type: ResourceTypeCategory): string {
    switch (type) {
        case 'room': return '🚪';
        case 'equipment': return '🖥️';
        case 'vehicle': return '🚗';
        case 'desk': return '🪑';
        default: return '📦';
    }
}

export function getResourceTypeLabel(type: ResourceTypeCategory): string {
    switch (type) {
        case 'room': return 'Salle';
        case 'equipment': return 'Équipement';
        case 'vehicle': return 'Véhicule';
        case 'desk': return 'Bureau';
        default: return type;
    }
}

export function getReservationStatusColor(status: ReservationStatus): string {
    switch (status) {
        case 'pending': return 'bg-yellow-100 text-yellow-800';
        case 'approved': return 'bg-green-100 text-green-800';
        case 'rejected': return 'bg-red-100 text-red-800';
        case 'cancelled': return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

export function getReservationStatusLabel(status: ReservationStatus): string {
    switch (status) {
        case 'pending': return 'En attente';
        case 'approved': return 'Approuvée';
        case 'rejected': return 'Refusée';
        case 'cancelled': return 'Annulée';
        default: return status;
    }
}
