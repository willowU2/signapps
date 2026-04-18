import "server-only";

import { fetchServer, logFetchFailure } from "./http";

/**
 * Minimal shape of an email returned by `/api/v1/mail/emails` — mirrors the
 * fields the inbox list view consumes.  Kept independent from the client
 * `Email` type in `@/lib/api-mail` so the server bundle does not pull the
 * whole axios client layer.  Extra keys are preserved via the index
 * signature so the client can still access fields we did not enumerate.
 */
export interface MailMessageSummary {
  id: string;
  subject?: string | null;
  sender?: string;
  sender_name?: string | null;
  recipient?: string | null;
  snippet?: string | null;
  body_text?: string | null;
  body_html?: string | null;
  received_at?: string | null;
  created_at?: string | null;
  is_read?: boolean | null;
  is_starred?: boolean | null;
  is_important?: boolean | null;
  is_sent?: boolean | null;
  is_archived?: boolean | null;
  is_deleted?: boolean | null;
  folder_id?: string | null;
  folder_type?: string | null;
  account_id?: string | null;
  message_id?: string | null;
  labels?: string[] | null;
  priority?: string | null;
  [key: string]: unknown;
}

/**
 * Shell of prefetched inbox data handed to the mail client island.  When the
 * backend is unreachable, the server still renders an empty shell so the
 * client takes over after hydration and shows the proper error state.
 */
export interface MailInbox {
  messages: MailMessageSummary[];
  folder: string;
  unreachable: boolean;
}

const MAIL_BASE_URL =
  process.env.NEXT_PUBLIC_MAIL_URL ??
  process.env.BACKEND_BASE_URL ??
  "http://localhost:3099";

/**
 * Server-side prefetch of the mail inbox for the RSC page.
 *
 * Returns an empty shell if the backend is unreachable, so the page still
 * renders and the client hooks can retry once the service is available.
 *
 * @param folder Backend folder type (default `"inbox"`).
 * @param limit  Maximum number of messages to prefetch (default 50).
 */
export async function fetchMailInbox(
  folder = "inbox",
  limit = 50,
): Promise<MailInbox> {
  try {
    const qs = new URLSearchParams({
      folder_type: folder,
      limit: String(limit),
    });
    const messages = await fetchServer<MailMessageSummary[]>(
      `/api/v1/mail/emails?${qs.toString()}`,
      { baseUrl: MAIL_BASE_URL },
    );
    return {
      messages: Array.isArray(messages) ? messages : [],
      folder,
      unreachable: false,
    };
  } catch (err) {
    logFetchFailure("mail", err);
    return { messages: [], folder, unreachable: true };
  }
}
