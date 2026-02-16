import { useQuery } from '@tanstack/react-query';
import { aiApi, type SearchResult } from '@/lib/api';

export function useAiSearch(query: string) {
  return useQuery<SearchResult[]>({
    queryKey: ['ai-search', query],
    queryFn: async () => {
      const res = await aiApi.search(query, 8);
      // API may return { results: [...] } or SearchResult[] directly
      const data = res.data as SearchResult[] | { results: SearchResult[] };
      return Array.isArray(data) ? data : data.results ?? [];
    },
    enabled: query.length >= 2,
    staleTime: 30 * 1000,
    retry: 0,
  });
}
