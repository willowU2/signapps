import "server-only";

import { fetchServer, logFetchFailure } from "./http";

/**
 * Raw form shape as returned by `GET /api/v1/forms` — kept independent of
 * the client-side `@/lib/api/forms` Form type so the server bundle does
 * not pull the whole axios client layer.  Extra keys are preserved via
 * the index signature.
 */
export interface ServerFormSummary {
  id: string;
  title: string;
  description?: string | null;
  is_published?: boolean;
  created_at: string;
  updated_at?: string;
  owner_id?: string;
  [key: string]: unknown;
}

/** Shell of prefetched forms data handed to the client island. */
export interface FormsListResponse {
  forms: ServerFormSummary[];
  /** Map of form_id → response count, fetched in parallel. */
  responseCounts: Record<string, number>;
  unreachable: boolean;
}

const FORMS_BASE_URL =
  process.env.NEXT_PUBLIC_FORMS_URL ??
  process.env.BACKEND_BASE_URL ??
  "http://localhost:3099";

/**
 * Server-side prefetch of the forms list for the RSC page.
 *
 * Fetches the list of forms and the aggregated response counts in
 * parallel so the client island renders the full table on first paint.
 * Returns an empty shell if the backend is unreachable.
 */
export async function fetchFormsList(): Promise<FormsListResponse> {
  try {
    const [forms, responseCounts] = await Promise.all([
      fetchServer<ServerFormSummary[]>("/api/v1/forms", {
        baseUrl: FORMS_BASE_URL,
      }),
      fetchServer<Record<string, number>>("/api/v1/forms/response-counts", {
        baseUrl: FORMS_BASE_URL,
      }).catch(() => ({}) as Record<string, number>),
    ]);
    return {
      forms: Array.isArray(forms) ? forms : [],
      responseCounts: responseCounts ?? {},
      unreachable: false,
    };
  } catch (err) {
    logFetchFailure("forms", err);
    return { forms: [], responseCounts: {}, unreachable: true };
  }
}
