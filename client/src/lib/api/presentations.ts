/**
 * Presentations API Client — Slides persistence endpoints
 *
 * Manages presentations, slide layouts, and slides CRUD
 * via the signapps-docs service (port 3010).
 */

import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.DOCS);

// ============================================================================
// Types
// ============================================================================

export interface Presentation {
  id: string;
  document_id: string;
  tenant_id: string;
  title: string;
  master_id: string | null;
  theme: Record<string, unknown>;
  slide_width: number;
  slide_height: number;
  created_at: string;
  updated_at: string;
}

export interface SlideLayout {
  id: string;
  presentation_id: string;
  name: string;
  layout_type: string;
  placeholders: unknown[];
  sort_order: number;
  created_at: string;
}

export interface Slide {
  id: string;
  presentation_id: string;
  sort_order: number;
  layout_id: string | null;
  elements: unknown[];
  speaker_notes: string | null;
  transition_type: string | null;
  transition_duration: number | null;
  is_hidden: boolean | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API
// ============================================================================

export const presentationsApi = {
  /** Create a new presentation (seeds default layouts). */
  create: (data: {
    document_id: string;
    title?: string;
    theme?: Record<string, unknown>;
    slide_width?: number;
    slide_height?: number;
  }) => client.post<{ data: Presentation }>("/api/v1/presentations", data),

  /** Get a presentation by document ID. */
  get: (docId: string) =>
    client.get<{ data: Presentation }>(`/api/v1/presentations/${docId}`),

  /** Update presentation title and/or theme. */
  update: (
    docId: string,
    data: { title?: string; theme?: Record<string, unknown> },
  ) =>
    client.put<{ data: Presentation }>(`/api/v1/presentations/${docId}`, data),

  /** List available layouts for a presentation. */
  listLayouts: (docId: string) =>
    client.get<{ data: SlideLayout[] }>(
      `/api/v1/presentations/${docId}/layouts`,
    ),

  /** List slides ordered by sort_order. */
  listSlides: (docId: string) =>
    client.get<{ data: Slide[] }>(`/api/v1/presentations/${docId}/slides`),

  /** Create a new slide in a presentation. */
  createSlide: (
    docId: string,
    data: {
      layout_id?: string;
      elements?: unknown[];
      speaker_notes?: string;
    },
  ) =>
    client.post<{ data: Slide }>(`/api/v1/presentations/${docId}/slides`, data),

  /** Update an existing slide. */
  updateSlide: (docId: string, slideId: string, data: Partial<Slide>) =>
    client.put<{ data: Slide }>(
      `/api/v1/presentations/${docId}/slides/${slideId}`,
      data,
    ),

  /** Delete a slide. */
  deleteSlide: (docId: string, slideId: string) =>
    client.delete(`/api/v1/presentations/${docId}/slides/${slideId}`),

  /** Reorder slides by providing an ordered list of slide IDs. */
  reorderSlides: (docId: string, slideIds: string[]) =>
    client.put(`/api/v1/presentations/${docId}/slides/reorder`, {
      slide_ids: slideIds,
    }),
};
