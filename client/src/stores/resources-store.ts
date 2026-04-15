//! Zustand store for resource and reservation management

import { create } from "zustand";
import {
  Resource,
  ResourceType,
  Reservation,
  ResourceTypeCategory,
  resourceTypesApi,
  resourcesApi,
  reservationsApi,
  CreateResourceRequest,
  UpdateResourceRequest,
  CreateResourceTypeRequest,
} from "@/lib/api/resources";

interface ResourcesState {
  // Resource types
  resourceTypes: ResourceType[];
  resourceTypesLoading: boolean;

  // Resources
  resources: Resource[];
  resourcesLoading: boolean;
  selectedResource: Resource | null;

  // Reservations
  reservations: Reservation[];
  reservationsLoading: boolean;
  pendingReservations: Reservation[];
  pendingLoading: boolean;

  // Filters
  resourceTypeFilter: ResourceTypeCategory | null;

  // Actions - Resource Types
  fetchResourceTypes: () => Promise<void>;
  createResourceType: (
    data: CreateResourceTypeRequest,
  ) => Promise<ResourceType>;
  deleteResourceType: (id: string) => Promise<void>;

  // Actions - Resources
  fetchResources: (resourceType?: ResourceTypeCategory) => Promise<void>;
  getResource: (id: string) => Promise<Resource>;
  createResource: (data: CreateResourceRequest) => Promise<Resource>;
  updateResource: (id: string, data: UpdateResourceRequest) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;
  selectResource: (resource: Resource | null) => void;
  setResourceTypeFilter: (filter: ResourceTypeCategory | null) => void;

  // Actions - Reservations
  fetchReservations: (resourceId: string) => Promise<void>;
  fetchPendingReservations: () => Promise<void>;
  createReservation: (
    resourceId: string,
    eventId?: string,
    notes?: string,
  ) => Promise<Reservation>;
  approveReservation: (id: string) => Promise<void>;
  rejectReservation: (id: string, reason?: string) => Promise<void>;
  cancelReservation: (id: string) => Promise<void>;

  // Reset
  reset: () => void;
}

const initialState = {
  resourceTypes: [],
  resourceTypesLoading: false,
  resources: [],
  resourcesLoading: false,
  selectedResource: null,
  reservations: [],
  reservationsLoading: false,
  pendingReservations: [],
  pendingLoading: false,
  resourceTypeFilter: null,
};

export const useResourcesStore = create<ResourcesState>()((set, get) => ({
  ...initialState,

  // Resource Types actions
  fetchResourceTypes: async () => {
    set({ resourceTypesLoading: true });
    try {
      const response = await resourceTypesApi.list();
      set({ resourceTypes: response.data, resourceTypesLoading: false });
    } catch {
      set({ resourceTypes: [], resourceTypesLoading: false });
    }
  },

  createResourceType: async (data) => {
    const response = await resourceTypesApi.create(data);
    set((state) => ({
      resourceTypes: [...state.resourceTypes, response.data],
    }));
    return response.data;
  },

  deleteResourceType: async (id) => {
    await resourceTypesApi.delete(id);
    set((state) => ({
      resourceTypes: state.resourceTypes.filter((rt) => rt.id !== id),
    }));
  },

  // Resources actions
  fetchResources: async (resourceType) => {
    set({ resourcesLoading: true });
    try {
      const response = await resourcesApi.list(resourceType);
      set({ resources: response.data, resourcesLoading: false });
    } catch {
      set({ resources: [], resourcesLoading: false });
    }
  },

  getResource: async (id) => {
    const response = await resourcesApi.get(id);
    return response.data;
  },

  createResource: async (data) => {
    const response = await resourcesApi.create(data);
    set((state) => ({
      resources: [...state.resources, response.data],
    }));
    return response.data;
  },

  updateResource: async (id, data) => {
    const response = await resourcesApi.update(id, data);
    set((state) => ({
      resources: state.resources.map((r) => (r.id === id ? response.data : r)),
      selectedResource:
        state.selectedResource?.id === id
          ? response.data
          : state.selectedResource,
    }));
  },

  deleteResource: async (id) => {
    await resourcesApi.delete(id);
    set((state) => ({
      resources: state.resources.filter((r) => r.id !== id),
      selectedResource:
        state.selectedResource?.id === id ? null : state.selectedResource,
    }));
  },

  selectResource: (resource) => {
    set({ selectedResource: resource, reservations: [] });
  },

  setResourceTypeFilter: (filter) => {
    set({ resourceTypeFilter: filter });
    const { fetchResources } = get();
    fetchResources(filter ?? undefined);
  },

  // Reservations actions
  fetchReservations: async (resourceId) => {
    set({ reservationsLoading: true });
    try {
      const response = await reservationsApi.list(resourceId);
      set({ reservations: response.data, reservationsLoading: false });
    } catch {
      set({ reservations: [], reservationsLoading: false });
    }
  },

  fetchPendingReservations: async () => {
    set({ pendingLoading: true });
    try {
      const response = await reservationsApi.listPending();
      set({ pendingReservations: response.data, pendingLoading: false });
    } catch {
      set({ pendingReservations: [], pendingLoading: false });
    }
  },

  createReservation: async (resourceId, eventId, notes) => {
    const response = await reservationsApi.create({
      resource_id: resourceId,
      event_id: eventId,
      notes,
    });
    set((state) => ({
      reservations: [...state.reservations, response.data],
    }));
    return response.data;
  },

  approveReservation: async (id) => {
    const response = await reservationsApi.approve(id);
    set((state) => ({
      reservations: state.reservations.map((r) =>
        r.id === id ? response.data : r,
      ),
      pendingReservations: state.pendingReservations.filter((r) => r.id !== id),
    }));
  },

  rejectReservation: async (id, reason) => {
    const response = await reservationsApi.reject(id, reason);
    set((state) => ({
      reservations: state.reservations.map((r) =>
        r.id === id ? response.data : r,
      ),
      pendingReservations: state.pendingReservations.filter((r) => r.id !== id),
    }));
  },

  cancelReservation: async (id) => {
    const response = await reservationsApi.cancel(id);
    set((state) => ({
      reservations: state.reservations.map((r) =>
        r.id === id ? response.data : r,
      ),
    }));
  },

  // Reset
  reset: () => set(initialState),
}));

// Selectors
export const useResources = () => useResourcesStore((state) => state.resources);
export const useResourceTypes = () =>
  useResourcesStore((state) => state.resourceTypes);
export const usePendingReservations = () =>
  useResourcesStore((state) => state.pendingReservations);
