/**
 * Resources API Client
 *
 * React Query hooks for resource and booking management.
 * Uses local storage for MVP, will integrate with backend later.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Resource, Booking } from '../types/scheduling';

// ============================================================================
// Storage Keys
// ============================================================================

const RESOURCES_STORAGE_KEY = 'scheduling-resources';
const BOOKINGS_STORAGE_KEY = 'scheduling-bookings';

// ============================================================================
// Local Storage Helpers
// ============================================================================

function getStoredResources(): Resource[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RESOURCES_STORAGE_KEY);
    if (!stored) return getDefaultResources();
    return JSON.parse(stored);
  } catch {
    return getDefaultResources();
  }
}

function setStoredResources(resources: Resource[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RESOURCES_STORAGE_KEY, JSON.stringify(resources));
}

function getStoredBookings(): Booking[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(BOOKINGS_STORAGE_KEY);
    if (!stored) return getDefaultBookings();
    return JSON.parse(stored).map((b: Booking) => ({
      ...b,
      start: new Date(b.start),
      end: b.end ? new Date(b.end) : undefined,
      createdAt: new Date(b.createdAt),
      updatedAt: new Date(b.updatedAt),
    }));
  } catch {
    return getDefaultBookings();
  }
}

function setStoredBookings(bookings: Booking[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(bookings));
}

// ============================================================================
// Default Data (Demo)
// ============================================================================

function getDefaultResources(): Resource[] {
  return [
    {
      id: 'room-1',
      name: 'Salle Einstein',
      type: 'room',
      description: 'Grande salle de réunion avec vidéoprojecteur et tableau blanc.',
      capacity: 20,
      location: 'Bâtiment A',
      floor: '2',
      amenities: ['Vidéoprojecteur', 'Tableau blanc', 'Visioconférence', 'Climatisation'],
      available: true,
    },
    {
      id: 'room-2',
      name: 'Salle Newton',
      type: 'room',
      description: 'Salle de réunion moyenne pour les équipes.',
      capacity: 10,
      location: 'Bâtiment A',
      floor: '2',
      amenities: ['Écran TV', 'Tableau blanc'],
      available: true,
    },
    {
      id: 'room-3',
      name: 'Salle Tesla',
      type: 'room',
      description: 'Petite salle pour les réunions en petit comité.',
      capacity: 6,
      location: 'Bâtiment B',
      floor: '1',
      amenities: ['Écran TV'],
      available: false,
    },
    {
      id: 'room-4',
      name: 'Auditorium',
      type: 'room',
      description: 'Grand auditorium pour les présentations et événements.',
      capacity: 100,
      location: 'Bâtiment C',
      floor: 'RDC',
      amenities: ['Scène', 'Microphones', 'Système audio', 'Vidéoprojecteur HD'],
      available: true,
    },
    {
      id: 'equip-1',
      name: 'MacBook Pro 16"',
      type: 'equipment',
      description: 'Ordinateur portable pour les présentations.',
      location: 'Stock IT',
      amenities: ['Adaptateur HDMI', 'Chargeur'],
      available: true,
    },
    {
      id: 'equip-2',
      name: 'Caméra 4K',
      type: 'equipment',
      description: 'Caméra professionnelle pour les tournages.',
      location: 'Studio',
      amenities: ['Trépied', 'Carte SD 128Go', 'Batterie supplémentaire'],
      available: true,
    },
    {
      id: 'vehicle-1',
      name: 'Renault Kangoo',
      type: 'vehicle',
      description: 'Véhicule utilitaire pour les déplacements.',
      capacity: 5,
      location: 'Parking -1',
      available: true,
    },
    {
      id: 'vehicle-2',
      name: 'Peugeot 308',
      type: 'vehicle',
      description: 'Véhicule de fonction.',
      capacity: 5,
      location: 'Parking -1',
      available: false,
    },
  ];
}

function getDefaultBookings(): Booking[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return [
    {
      id: 'booking-1',
      type: 'booking',
      title: 'Réunion d\'équipe hebdomadaire',
      resourceId: 'room-1',
      organizerId: 'user-1',
      start: new Date(today.setHours(9, 0, 0, 0)),
      end: new Date(today.setHours(10, 0, 0, 0)),
      purpose: 'Point hebdomadaire avec l\'équipe développement.',
      approvalStatus: 'approved',
      allDay: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'booking-2',
      type: 'booking',
      title: 'Présentation client',
      resourceId: 'room-4',
      organizerId: 'user-2',
      start: new Date(today.setHours(14, 0, 0, 0)),
      end: new Date(today.setHours(16, 0, 0, 0)),
      purpose: 'Démo du nouveau produit au client XYZ.',
      approvalStatus: 'approved',
      allDay: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'booking-3',
      type: 'booking',
      title: 'Formation React',
      resourceId: 'room-2',
      organizerId: 'user-1',
      start: new Date(tomorrow.setHours(9, 0, 0, 0)),
      end: new Date(tomorrow.setHours(12, 0, 0, 0)),
      purpose: 'Session de formation pour les nouveaux développeurs.',
      approvalStatus: 'pending',
      allDay: false,
      createdAt: now,
      updatedAt: now,
    },
  ];
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

// ============================================================================
// Resource Hooks
// ============================================================================

export function useResources() {
  return useQuery({
    queryKey: resourceKeys.lists(),
    queryFn: () => getStoredResources(),
  });
}

export function useResource(id: string) {
  return useQuery({
    queryKey: resourceKeys.detail(id),
    queryFn: () => {
      const resources = getStoredResources();
      return resources.find((r) => r.id === id) ?? null;
    },
    enabled: !!id,
  });
}

export function useCreateResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Resource, 'id'>) => {
      const resources = getStoredResources();
      const newResource: Resource = {
        ...data,
        id: `resource-${Date.now()}`,
      };
      resources.push(newResource);
      setStoredResources(resources);
      return newResource;
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
      const resources = getStoredResources();
      const index = resources.findIndex((r) => r.id === id);
      if (index === -1) throw new Error('Resource not found');

      resources[index] = { ...resources[index], ...updates };
      setStoredResources(resources);
      return resources[index];
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
    queryFn: () => {
      const bookings = getStoredBookings();
      if (resourceId) {
        return bookings.filter((b) => b.resourceId === resourceId);
      }
      return bookings;
    },
  });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: () => {
      const bookings = getStoredBookings();
      return bookings.find((b) => b.id === id) ?? null;
    },
    enabled: !!id,
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>) => {
      const bookings = getStoredBookings();
      const now = new Date();
      const newBooking: Booking = {
        ...data,
        id: `booking-${Date.now()}`,
        approvalStatus: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      bookings.push(newBooking);
      setStoredBookings(bookings);
      return newBooking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Booking>;
    }) => {
      const bookings = getStoredBookings();
      const index = bookings.findIndex((b) => b.id === id);
      if (index === -1) throw new Error('Booking not found');

      bookings[index] = {
        ...bookings[index],
        ...updates,
        updatedAt: new Date(),
      };
      setStoredBookings(bookings);
      return bookings[index];
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: bookingKeys.lists() });
      const previous = queryClient.getQueryData<Booking[]>(bookingKeys.lists());

      queryClient.setQueryData<Booking[]>(bookingKeys.lists(), (old) =>
        old?.map((b) =>
          b.id === id ? { ...b, ...updates, updatedAt: new Date() } : b
        )
      );

      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(bookingKeys.lists(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

export function useDeleteBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const bookings = getStoredBookings();
      const filtered = bookings.filter((b) => b.id !== id);
      setStoredBookings(filtered);
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: bookingKeys.lists() });
      const previous = queryClient.getQueryData<Booking[]>(bookingKeys.lists());

      queryClient.setQueryData<Booking[]>(bookingKeys.lists(), (old) =>
        old?.filter((b) => b.id !== id)
      );

      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(bookingKeys.lists(), context.previous);
      }
    },
    onSettled: () => {
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

// Import React for useMemo
import * as React from 'react';
