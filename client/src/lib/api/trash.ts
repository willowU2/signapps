/**
 * Trash API — Corbeille unifiée (soft-delete / restore / purge)
 *
 * Endpoints sous /trash, servis par le service Identity (port 3001).
 */
import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.IDENTITY);

// ============================================================================
// Types
// ============================================================================

export interface TrashItem {
  id: string;
  tenant_id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  module: string;
  deleted_at: string;
  expires_at: string;
}

export interface MoveToTrashRequest {
  entity_type: string;
  entity_id: string;
  entity_name: string;
  module: string;
}

export interface TrashListParams {
  type?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
}

// ============================================================================
// API
// ============================================================================

export const trashApi = {
  /** Liste les elements dans la corbeille */
  list: (params?: TrashListParams) =>
    client.get<TrashItem[]>("/trash", { params }),

  /** Deplace un element dans la corbeille (soft-delete) */
  moveToTrash: (data: MoveToTrashRequest) =>
    client.post<TrashItem>("/trash", data),

  /** Restaure un element depuis la corbeille */
  restore: (id: string) => client.post(`/trash/${id}/restore`),

  /** Supprime definitivement un element de la corbeille */
  permanentDelete: (id: string) => client.delete(`/trash/${id}`),

  /** Purge tous les elements expires de la corbeille */
  purgeExpired: () => client.delete("/trash"),
};
