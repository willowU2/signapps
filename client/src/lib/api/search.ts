import { storageApiClient } from './core';

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

/**
 * Searches across all entities (documents, files, mails, etc.)
 * via the new global_search_index API.
 */
export async function fetchOmniSearch(query: string, limit?: number): Promise<OmniSearchResponse> {
    if (!query || query.trim().length === 0) {
        return { results: [], took_ms: 0 };
    }
    
    // Convert to query params
    const params = new URLSearchParams({
        q: query.trim()
    });
    
    if (limit) {
        params.append('limit', limit.toString());
    }

    const { data } = await storageApiClient.get<OmniSearchResponse>(`/api/v1/search/omni?${params.toString()}`);
    return data;
}
