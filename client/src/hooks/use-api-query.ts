import {
  useQuery,
  type QueryKey,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { extractApiError } from "@/lib/errors";

export interface ApiQueryResult<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  refetch: () => void;
}

/**
 * Thin wrapper around useQuery that normalises the response shape to
 * { data, error, loading, refetch } — matches the pattern expected
 * throughout the codebase.
 *
 * Usage:
 *   const { data, error, loading } = useApiQuery<Contact[]>(
 *     ['contacts'],
 *     () => contactsApi.list(),
 *     { staleTime: STALE_LIST }
 *   );
 */
export function useApiQuery<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn">,
): ApiQueryResult<T> {
  const result = useQuery<T>({
    queryKey,
    queryFn,
    ...options,
  });

  return {
    data: result.data,
    error: result.error ? extractApiError(result.error) : null,
    loading: result.isLoading,
    refetch: () => {
      result.refetch();
    },
  };
}
