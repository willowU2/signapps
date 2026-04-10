/**
 * Search API — Global search, suggestions, history, and saved searches
 *
 * Endpoints under /search, served by the Identity service (port 3001).
 * Also includes legacy omni-search via the Storage service for backwards compat.
 */
import { getClient, ServiceName } from "./factory";
import { storageApiClient } from "./core";

const client = getClient(ServiceName.IDENTITY);

// ============================================================================
// Types — Global Search (Identity)
// ============================================================================

export interface SearchResult {
  id: string;
  entity_type: string;
  title: string;
  snippet?: string;
  url: string;
  score: number;
  updated_at: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  took_ms: number;
}

export interface SearchParams {
  q: string;
  scope?: string;
  type?: string;
  date_from?: string;
  date_to?: string;
  author?: string;
  limit?: number;
}

export interface SearchSuggestion {
  text: string;
  source: "history" | "popular";
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  scope: string;
  result_count: number;
  created_at: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  scope: string;
  filters: Record<string, unknown>;
  created_at: string;
}

export interface SaveSearchRequest {
  name: string;
  query: string;
  scope?: string;
  filters?: Record<string, unknown>;
}

// ============================================================================
// Types — Legacy Omni Search (Storage)
// ============================================================================

export interface OmniSearchResult {
  id: string;
  entity_type: string;
  title: string;
  snippet?: string;
  url: string;
  updated_at: string;
}

export interface OmniSearchResponse {
  results: OmniSearchResult[];
  took_ms: number;
}

// ============================================================================
// API — Global Search
// ============================================================================

export const searchApi = {
  /** Global search across modules */
  search: (params: SearchParams) =>
    client.get<SearchResponse>("/search", { params }),

  /** Typeahead suggestions based on history + popular queries */
  suggestions: (q: string, limit?: number) =>
    client.get<SearchSuggestion[]>("/search/suggestions", {
      params: { q, ...(limit ? { limit } : {}) },
    }),

  /** User's recent search history (last 20) */
  listHistory: () => client.get<SearchHistoryItem[]>("/search/history"),

  /** Clear all search history */
  clearHistory: () => client.delete("/search/history"),

  /** List saved searches */
  listSaved: () => client.get<SavedSearch[]>("/search/saved"),

  /** Save a search */
  createSaved: (data: SaveSearchRequest) =>
    client.post<SavedSearch>("/search/saved", data),

  /** Delete a saved search */
  deleteSaved: (id: string) => client.delete(`/search/saved/${id}`),
};

// ============================================================================
// Legacy — Omni Search (Storage service)
// ============================================================================

/**
 * Searches across all entities (documents, files, mails, etc.)
 * via the storage-based global_search_index API.
 */
export async function fetchOmniSearch(
  query: string,
  limit?: number,
): Promise<OmniSearchResponse> {
  if (!query || query.trim().length === 0) {
    return { results: [], took_ms: 0 };
  }

  const params = new URLSearchParams({ q: query.trim() });
  if (limit) {
    params.append("limit", limit.toString());
  }

  const { data } = await storageApiClient.get<OmniSearchResponse>(
    `/api/v1/search/omni?${params.toString()}`,
  );
  return data;
}
