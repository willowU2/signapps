import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.DOCS);

export interface DocumentCommand {
  id: number;
  document_id: string;
  user_id: string;
  command_type: string;
  target_path: string | null;
  before_value: unknown;
  after_value: unknown;
  created_at: string;
}

export interface DocumentSnapshot {
  id: string;
  document_id: string;
  version: number;
  content: unknown;
  label: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DiffEntry {
  path: string;
  change_type: string;
  old_value: unknown;
  new_value: unknown;
}

export const versionsApi = {
  appendCommand: (
    docId: string,
    data: {
      command_type: string;
      target_path?: string;
      before_value?: unknown;
      after_value?: unknown;
    },
  ) => client.post<DocumentCommand>(`/versions/${docId}/commands`, data),

  listCommands: (docId: string, since?: number, limit?: number) =>
    client.get<DocumentCommand[]>(`/versions/${docId}/commands`, {
      params: { since, limit: limit ?? 50 },
    }),

  undo: (docId: string) =>
    client.post<DocumentCommand>(`/versions/${docId}/undo`),

  createSnapshot: (docId: string, data: { content: unknown; label?: string }) =>
    client.post<DocumentSnapshot>(`/versions/${docId}/snapshots`, data),

  listSnapshots: (docId: string) =>
    client.get<DocumentSnapshot[]>(`/versions/${docId}/snapshots`),

  getSnapshot: (docId: string, snapshotId: string) =>
    client.get<DocumentSnapshot>(`/versions/${docId}/snapshots/${snapshotId}`),

  restoreSnapshot: (docId: string, snapshotId: string) =>
    client.post<DocumentSnapshot>(
      `/versions/${docId}/snapshots/${snapshotId}/restore`,
    ),

  diffSnapshots: (docId: string, snapshotA: string, snapshotB: string) =>
    client.post<DiffEntry[]>(`/versions/${docId}/snapshots/diff`, {
      snapshot_a: snapshotA,
      snapshot_b: snapshotB,
    }),
};
