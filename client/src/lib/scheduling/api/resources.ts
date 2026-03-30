/**
 * Resources API Client
 *
 * React Query hooks for resource and booking management.
 * Integrates directly with the `signapps-calendar` backend microservice.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Resource, Booking } from '../types/scheduling';
import { getClient, ServiceName } from '@/lib/api/factory';
import * as React from 'react';

// ============================================================================
// Backend Data Mappings
// ============================================================================

interface BackendResource {
  id: string;
  name: string;
  resource_type: string;
  description: string | null;
  capacity: number | null;
  location: string | null;
  is_available: boolean;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

function toFrontendResource(r: BackendResource): Resource {
  return {
    id: r.id,
    name: r.name,
    type: (r.resource_type as Resource['type']) || 'room',
    description: r.description || undefined,
    capacity: r.capacity || undefined,
    location: r.location || undefined,
    available: r.is_available,
    // Floor, amenities, imageUrl are not in the backend model currently
  };
}

// ============================================================================
// Query Keys
// ============================================================================

export const resourceKeys = {
  all: ['resources'] as const,
  lists: () => [...resourceKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...resourceKeys.lists(), filters] as const,
  details: () => [...resourceKeys.all, 'detail'] as const,
  detail: (id: string) => [...resourceKeys.details(), id] as const,
};

export const bookingKeys = {
  all: ['bookings'] as const,
  lists: () => [...bookingKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...bookingKeys.lists(), filters] as const,
  details: () => [...bookingKeys.all, 'detail'] as const,
  detail: (id: string) => [...bookingKeys.details(), id] as const,
  byResource: (resourceId: string) => [...bookingKeys.all, 'resource', resourceId] as const,
};

export const floorPlanKeys = {
  all: ['floorplans'] as const,
  lists: () => [...floorPlanKeys.all, 'list'] as const,
  details: () => [...floorPlanKeys.all, 'detail'] as const,
  detail: (id: string) => [...floorPlanKeys.details(), id] as const,
};

// ============================================================================
// Resource Hooks
// ============================================================================

export function useResources() {
  return useQuery({
    queryKey: resourceKeys.lists(),
    queryFn: async (): Promise<Resource[]> => {
      const client = getClient(ServiceName.CALENDAR);
      const res = await client.get<BackendResource[]>('/resources');
      return res.data.map(toFrontendResource);
    },
  });
}

export function useResource(id: string) {
  return useQuery({
    queryKey: resourceKeys.detail(id),
    queryFn: async (): Promise<Resource | null> => {
      const client = getClient(ServiceName.CALENDAR);
      const res = await client.get<BackendResource>(`/resources/${id}`);
      if (!res.data) return null;
      return toFrontendResource(res.data);
    },
    enabled: !!id,
  });
}

export function useCreateResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Resource, 'id'>) => {
      const client = getClient(ServiceName.CALENDAR);
      const payload = {
        name: data.name,
        resource_type: data.type,
        description: data.description || null,
        capacity: data.capacity || null,
        location: data.location || null,
      };
      const res = await client.post<BackendResource>('/resources', payload);
      return toFrontendResource(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.lists() });
    },
  });
}

export function useUpdateResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Resource>;
    }) => {
      const client = getClient(ServiceName.CALENDAR);
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.available !== undefined) payload.is_available = updates.available;

      const res = await client.put<BackendResource>(`/resources/${id}`, payload);
      return toFrontendResource(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.lists() });
    },
  });
}

// ============================================================================
// Booking Hooks
// ============================================================================

export function useBookings(resourceId?: string) {
  return useQuery({
    queryKey: resourceId ? bookingKeys.byResource(resourceId) : bookingKeys.lists(),
    queryFn: async (): Promise<Booking[]> => {
      // Backend doesn't support fetching bookings right now - returning empty array for MVP integration
      return [];
    },
  });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: async (): Promise<Booking | null> => {
      return null;
    },
    enabled: !!id,
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>) => {
      const client = getClient(ServiceName.CALENDAR);
      
      const payload = {
        event_id: data.title, // using title to fake event_id for mock integration
        resource_ids: [data.resourceId],
      };
      
      await client.post(`/resources/${data.resourceId}/book`, payload);

      const now = new Date();
      return {
        ...data,
        id: `mock-book-${Date.now()}`,
        approvalStatus: 'pending',
        createdAt: now,
        updatedAt: now,
      } as Booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Booking> }) => {
      return { id, updates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

export function useDeleteBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

// ============================================================================
// Availability Check
// ============================================================================

export function useResourceAvailability(resourceId: string, start: Date, end: Date) {
  const { data: bookings = [] } = useBookings(resourceId);

  return React.useMemo(() => {
    return !bookings.some((booking) => {
      const bookingStart = new Date(booking.start);
      const bookingEnd = booking.end ? new Date(booking.end) : bookingStart;

      // Check for overlap
      return start < bookingEnd && end > bookingStart;
    });
  }, [bookings, start, end]);
}

// ============================================================================
// FloorPlan Hooks
// ============================================================================

export function useFloorPlans() {
  return useQuery({
    queryKey: floorPlanKeys.lists(),
    queryFn: async (): Promise<import('../types/scheduling').FloorPlanData[]> => {
      const client = getClient(ServiceName.CALENDAR);
      const res = await client.get('/floorplans');
      return res.data;
    },
  });
}

export function useFloorPlan(id: string) {
  return useQuery({
    queryKey: floorPlanKeys.detail(id),
    queryFn: async (): Promise<import('../types/scheduling').FloorPlanData | null> => {
      const client = getClient(ServiceName.CALENDAR);
      try {
        const res = await client.get(`/floorplans/${id}`);
        return res.data;
      } catch (e: any) {
        if (e.response?.status === 404) return null;
        throw e;
      }
    },
    enabled: !!id && id !== 'new',
  });
}

export function useCreateFloorPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<import('../types/scheduling').FloorPlanData, 'id'>) => {
      const client = getClient(ServiceName.CALENDAR);
      const res = await client.post('/floorplans', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: floorPlanKeys.lists() });
    },
  });
}

export function useUpdateFloorPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<import('../types/scheduling').FloorPlanData> }) => {
      const client = getClient(ServiceName.CALENDAR);
      const res = await client.put(`/floorplans/${id}`, updates);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: floorPlanKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: floorPlanKeys.lists() });
    },
  });
}

export function useDeleteFloorPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const client = getClient(ServiceName.CALENDAR);
      await client.delete(`/floorplans/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: floorPlanKeys.lists() });
    },
  });
}

