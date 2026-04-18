import { fetchContactsList } from "@/lib/server/contacts";
import { ContactsListClient } from "./contacts-list-client";

/**
 * Contacts page — React Server Component.
 *
 * Prefetches the contacts list from `signapps-contacts` on the server so
 * the first HTML chunk already carries the full table.  The client island
 * (`ContactsListClient`) seeds TanStack Query with the prefetched data and
 * takes over interactivity after hydration.
 */
export default async function ContactsPage() {
  const initialList = await fetchContactsList();
  return <ContactsListClient initialList={initialList} />;
}
