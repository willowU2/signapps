/**
 * Keep API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from './factory';

// Get the storage service client (cached)
const storageClient = getClient(ServiceName.STORAGE);

// Keep API - Uses storage service with a dedicated bucket for notes
// Notes are stored as JSON files in the "keep" bucket

const KEEP_BUCKET = 'keep';
const NOTES_KEY = 'notes.json';
const LABELS_KEY = 'labels.json';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
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
}

export interface KeepLabel {
  id: string;
  name: string;
}

export interface KeepData {
  notes: KeepNote[];
  labels: KeepLabel[];
}

// ── localStorage persistence layer ──────────────────────────────────────────
const KEEP_LOCAL_KEY = 'signapps_keep_data';

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
    // localStorage full or unavailable — ignore
  }
}

// Track whether the storage service is reachable
let storageAvailable = true;

// Helper to read JSON data from storage (with localStorage fallback)
async function readKeepData(): Promise<KeepData> {
  try {
    const response = await storageClient.get(`/files/${KEEP_BUCKET}/${NOTES_KEY}`, {
      responseType: 'text',
    });
    const data = JSON.parse(response.data as string);
    storageAvailable = true;
    // Mirror to localStorage for offline fallback
    setLocalKeepData(data);
    return data;
  } catch {
    // If storage service is unreachable, use localStorage
    const localData = getLocalKeepData();
    if (localData.notes.length > 0 || localData.labels.length > 0) {
      storageAvailable = false;
      return localData;
    }
    return { notes: [], labels: [] };
  }
}

// Helper to write JSON data to storage (always mirrors to localStorage)
async function writeKeepData(data: KeepData): Promise<void> {
  // Always save to localStorage first (instant, reliable)
  setLocalKeepData(data);

  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const formData = new FormData();
    formData.append('file', blob, NOTES_KEY);

    await storageClient.post(`/files/${KEEP_BUCKET}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    storageAvailable = true;
  } catch {
    // Storage service down — data is still in localStorage
    storageAvailable = false;
    console.debug('Keep: storage service unavailable, data saved to localStorage');
  }
}

// Ensure bucket exists
async function ensureBucket(): Promise<void> {
  try {
    await storageClient.get(`/buckets`);
    // Try to create if doesn't exist (will fail silently if exists)
    await storageClient.post('/buckets', { name: KEEP_BUCKET }).catch(() => {});
  } catch {
    // Ignore errors - bucket may already exist
  }
}

export const keepApi = {
  // Fetch all notes and labels
  fetchAll: async (): Promise<KeepData> => {
    // Try to ensure bucket exists, but don't block on failure
    ensureBucket().catch(() => {});
    return readKeepData();
  },

  // Save all data (full sync)
  saveAll: async (data: KeepData): Promise<KeepData> => {
    ensureBucket().catch(() => {});
    await writeKeepData(data);
    return data;
  },

  // Create a new note
  createNote: async (note: Omit<KeepNote, 'id' | 'createdAt' | 'updatedAt'>): Promise<KeepNote> => {
    const data = await readKeepData();
    const now = new Date().toISOString();
    const newNote: KeepNote = {
      ...note,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    data.notes = [newNote, ...data.notes];
    await writeKeepData(data);
    return newNote;
  },

  // Update an existing note
  updateNote: async (id: string, updates: Partial<KeepNote>): Promise<KeepNote> => {
    const data = await readKeepData();
    const index = data.notes.findIndex(n => n.id === id);
    if (index === -1) {
      throw new Error(`Note ${id} not found`);
    }
    const updatedNote = {
      ...data.notes[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    data.notes[index] = updatedNote;
    await writeKeepData(data);
    return updatedNote;
  },

  // Delete a note permanently
  deleteNote: async (id: string): Promise<void> => {
    const data = await readKeepData();
    data.notes = data.notes.filter(n => n.id !== id);
    await writeKeepData(data);
  },

  // Batch delete (empty trash)
  deleteNotes: async (ids: string[]): Promise<void> => {
    const data = await readKeepData();
    const idSet = new Set(ids);
    data.notes = data.notes.filter(n => !idSet.has(n.id));
    await writeKeepData(data);
  },

  // Create a label
  createLabel: async (name: string): Promise<KeepLabel> => {
    const data = await readKeepData();
    const newLabel: KeepLabel = {
      id: crypto.randomUUID(),
      name: name.toUpperCase(),
    };
    data.labels = [...data.labels, newLabel];
    await writeKeepData(data);
    return newLabel;
  },

  // Update a label
  updateLabel: async (id: string, name: string): Promise<KeepLabel> => {
    const data = await readKeepData();
    const index = data.labels.findIndex(l => l.id === id);
    if (index === -1) {
      throw new Error(`Label ${id} not found`);
    }
    const oldName = data.labels[index].name;
    const newName = name.toUpperCase();
    data.labels[index] = { id, name: newName };
    // Update all notes with this label
    data.notes = data.notes.map(note => ({
      ...note,
      labels: note.labels.map(l => l === oldName ? newName : l),
    }));
    await writeKeepData(data);
    return data.labels[index];
  },

  // Delete a label
  deleteLabel: async (id: string): Promise<void> => {
    const data = await readKeepData();
    const labelToDelete = data.labels.find(l => l.id === id);
    if (labelToDelete) {
      data.labels = data.labels.filter(l => l.id !== id);
      // Remove label from all notes
      data.notes = data.notes.map(note => ({
        ...note,
        labels: note.labels.filter(l => l !== labelToDelete.name),
      }));
      await writeKeepData(data);
    }
  },
};
