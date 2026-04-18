import { fetchFormsList } from "@/lib/server/forms";
import { FormsListClient } from "./forms-list-client";

/**
 * Forms page — React Server Component.
 *
 * Prefetches the list of forms and the bulk response counts from
 * `signapps-forms` on the server so the first HTML chunk already shows
 * the table.  The client island (`FormsListClient`) transforms the
 * prefetched data into the UI `Form` shape and passes it to TanStack
 * Query as `initialData`, which then refetches in the background.
 */
export default async function FormsPage() {
  const initialList = await fetchFormsList();
  return <FormsListClient initialList={initialList} />;
}
