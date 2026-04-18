import "server-only";

import { fetchServer } from "./http";

/**
 * Minimal shape of a contact returned by `/api/v1/contacts` — mirrors the
 * fields the contacts table view consumes.  Kept independent from the client
 * `Contact` type in `@/lib/api/contacts` so the server bundle does not pull
 * the whole axios client layer.  Extra keys are preserved via the index
 * signature so the client can still access fields we did not enumerate.
 */
export interface ContactSummary {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
  job_title?: string | null;
  group_ids?: string[];
  tags?: string[];
  favorite?: boolean;
  group?: string | null;
  birthday?: string | null;
  city?: string | null;
  country?: string | null;
  [key: string]: unknown;
}

/**
 * Shell of prefetched contacts data handed to the client island.  When the
 * backend is unreachable, the server still renders an empty shell so the
 * client takes over after hydration and shows the proper empty/error state.
 */
export interface ContactsListResponse {
  contacts: ContactSummary[];
  total?: number;
  unreachable: boolean;
}

const CONTACTS_BASE_URL =
  process.env.NEXT_PUBLIC_CONTACTS_URL ??
  process.env.BACKEND_BASE_URL ??
  "http://localhost:3099";

/**
 * Server-side prefetch of the contacts list for the RSC page.
 *
 * Returns an empty shell if the backend is unreachable, so the page still
 * renders and the client hooks can retry once the service is available.
 *
 * @param limit Maximum number of contacts to prefetch (default 200).
 */
export async function fetchContactsList(
  limit = 200,
): Promise<ContactsListResponse> {
  try {
    const raw = await fetchServer<
      ContactSummary[] | { contacts?: ContactSummary[] }
    >(`/api/v1/contacts?limit=${limit}`, { baseUrl: CONTACTS_BASE_URL });
    // The backend may return either a bare array or `{ contacts: [...] }`.
    const contacts = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.contacts)
        ? raw.contacts
        : [];
    return {
      contacts,
      total: contacts.length,
      unreachable: false,
    };
  } catch (err) {
    console.error("[contacts] server fetch failed, returning empty shell", err);
    return { contacts: [], total: 0, unreachable: true };
  }
}
