/**
 * Bookmarks API — Favoris et collections de favoris
 *
 * Endpoints sous /bookmarks et /bookmark-collections,
 * servis par le service Identity (port 3001).
 */
import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.IDENTITY);

// ============================================================================
// Types
// ============================================================================

export interface Bookmark {
  id: string;
  tenant_id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  url?: string;
  collection_id?: string;
  created_at: string;
}

export interface CreateBookmarkRequest {
  entity_type: string;
  entity_id: string;
  title: string;
  url?: string;
  collection_id?: string;
}

export interface BookmarkCollection {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  icon?: string;
  color?: string;
  created_at: string;
}

export interface CreateBookmarkCollectionRequest {
  name: string;
  icon?: string;
  color?: string;
}

export interface BookmarkListParams {
  collection_id?: string;
  entity_type?: string;
  cursor?: string;
  limit?: number;
}

// ============================================================================
// API
// ============================================================================

export const bookmarksApi = {
  /** Liste les favoris de l'utilisateur courant */
  list: (params?: BookmarkListParams) =>
    client.get<Bookmark[]>("/bookmarks", { params }),

  /** Cree un nouveau favori */
  create: (data: CreateBookmarkRequest) =>
    client.post<Bookmark>("/bookmarks", data),

  /** Supprime un favori */
  remove: (id: string) => client.delete(`/bookmarks/${id}`),
};

export const bookmarkCollectionsApi = {
  /** Liste les collections de favoris */
  list: () => client.get<BookmarkCollection[]>("/bookmark-collections"),

  /** Cree une nouvelle collection */
  create: (data: CreateBookmarkCollectionRequest) =>
    client.post<BookmarkCollection>("/bookmark-collections", data),

  /** Supprime une collection */
  delete: (id: string) => client.delete(`/bookmark-collections/${id}`),
};
