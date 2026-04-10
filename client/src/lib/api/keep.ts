/**
 * Keep API Module
 *
 * Notes and labels backed by the Identity service (port 3001).
 * Uses /api/v1/keep/* endpoints with proper PostgreSQL persistence.
 *
 * The public KeepNote interface uses camelCase field names for frontend
 * compatibility; the API returns snake_case which is mapped internally.
 *
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.IDENTITY);

// ── Public types (camelCase, used by hooks & components) ─────────────────────

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  order?: number;
}

export interface KeepNote {
  id: string;
  title: string;
  content: string;
  color: string;
  labels: string[];
  isPinned: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  hasChecklist: boolean;
  checklistItems: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
  reminderAt?: string | null;
}

export interface KeepLabel {
  id: string;
  name: string;
}

export interface KeepData {
  notes: KeepNote[];
  labels: KeepLabel[];
}

// ── Internal API response types (snake_case from backend) ────────────────────

interface ApiNoteResponse {
  id: string;
  owner_id: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  archived: boolean;
  is_checklist: boolean;
  checklist_items: ChecklistItem[];
  labels: string[];
  reminder_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiLabelResponse {
  id: string;
  owner_id: string;
  name: string;
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapApiNote(api: ApiNoteResponse): KeepNote {
  return {
    id: api.id,
    title: api.title,
    content: api.content,
    color: api.color,
    labels: api.labels || [],
    isPinned: api.pinned,
    isArchived: api.archived,
    isTrashed: api.deleted_at != null,
    hasChecklist: api.is_checklist,
    checklistItems: api.checklist_items || [],
    createdAt: api.created_at,
    updatedAt: api.updated_at,
    reminderAt: api.reminder_at,
  };
}

function mapApiLabel(api: ApiLabelResponse): KeepLabel {
  return { id: api.id, name: api.name };
}

// ── localStorage fallback layer ──────────────────────────────────────────────
const KEEP_LOCAL_KEY = "signapps_keep_data";

function getLocalKeepData(): KeepData {
  try {
    const raw = localStorage.getItem(KEEP_LOCAL_KEY);
    if (!raw) return { notes: [], labels: [] };
    return JSON.parse(raw) as KeepData;
  } catch {
    return { notes: [], labels: [] };
  }
}

function setLocalKeepData(data: KeepData): void {
  try {
    localStorage.setItem(KEEP_LOCAL_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable
  }
}

// ── API ──────────────────────────────────────────────────────────────────────

export const keepApi = {
  /** Fetch all notes (active + archived + trashed) and labels. */
  fetchAll: async (): Promise<KeepData> => {
    try {
      // Fetch active notes, archived, trashed, and labels in parallel
      const [activeRes, archivedRes, trashedRes, labelsRes] = await Promise.all(
        [
          client.get<ApiNoteResponse[]>("/keep/notes"),
          client.get<ApiNoteResponse[]>("/keep/notes", {
            params: { archived: true },
          }),
          client.get<ApiNoteResponse[]>("/keep/notes", {
            params: { trashed: true },
          }),
          client.get<ApiLabelResponse[]>("/keep/labels"),
        ],
      );

      // Deduplicate by id (a note could appear in multiple queries)
      const noteMap = new Map<string, KeepNote>();
      for (const list of [activeRes.data, archivedRes.data, trashedRes.data]) {
        for (const apiNote of list) {
          noteMap.set(apiNote.id, mapApiNote(apiNote));
        }
      }

      const data: KeepData = {
        notes: Array.from(noteMap.values()),
        labels: labelsRes.data.map(mapApiLabel),
      };

      // Mirror to localStorage for offline fallback
      setLocalKeepData(data);
      return data;
    } catch {
      // Fallback to localStorage if backend unreachable
      const localData = getLocalKeepData();
      if (localData.notes.length > 0 || localData.labels.length > 0) {
        return localData;
      }
      return { notes: [], labels: [] };
    }
  },

  /** Create a new note. */
  createNote: async (
    note: Omit<KeepNote, "id" | "createdAt" | "updatedAt">,
  ): Promise<KeepNote> => {
    const res = await client.post<ApiNoteResponse>("/keep/notes", {
      title: note.title,
      content: note.content,
      color: note.color,
      pinned: note.isPinned,
      is_checklist: note.hasChecklist,
      checklist_items: note.checklistItems || [],
      labels: note.labels || [],
    });
    return mapApiNote(res.data);
  },

  /** Update an existing note (partial update). */
  updateNote: async (
    id: string,
    updates: Partial<KeepNote>,
  ): Promise<KeepNote> => {
    // Map camelCase frontend fields to snake_case backend fields
    const body: Record<string, unknown> = {};
    if (updates.title !== undefined) body.title = updates.title;
    if (updates.content !== undefined) body.content = updates.content;
    if (updates.color !== undefined) body.color = updates.color;
    if (updates.isPinned !== undefined) body.pinned = updates.isPinned;
    if (updates.isArchived !== undefined) body.archived = updates.isArchived;
    if (updates.hasChecklist !== undefined)
      body.is_checklist = updates.hasChecklist;
    if (updates.checklistItems !== undefined)
      body.checklist_items = updates.checklistItems;
    if (updates.labels !== undefined) body.labels = updates.labels;

    // Handle trash: isTrashed maps to soft-delete / restore
    if (updates.isTrashed === true) {
      // Soft-delete via DELETE endpoint
      await client.delete(`/keep/notes/${id}`);
      // Return a synthetic response since DELETE returns 204
      return {
        id,
        title: updates.title ?? "",
        content: updates.content ?? "",
        color: updates.color ?? "default",
        labels: updates.labels ?? [],
        isPinned: false,
        isArchived: false,
        isTrashed: true,
        hasChecklist: updates.hasChecklist ?? false,
        checklistItems: updates.checklistItems ?? [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    if (updates.isTrashed === false) {
      // Restore from trash
      const res = await client.post<ApiNoteResponse>(
        `/keep/notes/${id}/restore`,
      );
      return mapApiNote(res.data);
    }

    const res = await client.put<ApiNoteResponse>(`/keep/notes/${id}`, body);
    return mapApiNote(res.data);
  },

  /** Permanently delete a note. */
  deleteNote: async (id: string): Promise<void> => {
    // The backend soft-deletes on DELETE. For permanent delete, we delete
    // a note that is already in the trash (the frontend empties trash).
    await client.delete(`/keep/notes/${id}`);
  },

  /** Batch delete (empty trash) — delete each trashed note. */
  deleteNotes: async (ids: string[]): Promise<void> => {
    await Promise.all(ids.map((id) => client.delete(`/keep/notes/${id}`)));
  },

  /** Create a label. */
  createLabel: async (name: string): Promise<KeepLabel> => {
    const res = await client.post<ApiLabelResponse>("/keep/labels", { name });
    return mapApiLabel(res.data);
  },

  /** Delete a label. */
  deleteLabel: async (id: string): Promise<void> => {
    await client.delete(`/keep/labels/${id}`);
  },
};
