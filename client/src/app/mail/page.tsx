import { fetchMailInbox } from "@/lib/server/mail";
import { MailInboxClient } from "./mail-inbox-client";

/**
 * Mail page — React Server Component.
 *
 * Prefetches the inbox from `signapps-mail` on the server so the first
 * HTML chunk already carries real messages.  The client island
 * (`MailInboxClient`) seeds the Zustand mail list with the prefetched
 * data and takes over interactivity after hydration.
 */
export default async function MailPage() {
  const initialInbox = await fetchMailInbox("inbox", 50);
  return <MailInboxClient initialInbox={initialInbox} />;
}
