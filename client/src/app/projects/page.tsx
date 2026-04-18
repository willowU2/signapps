import { fetchProjectsList } from "@/lib/server/projects";
import { ProjectsListClient } from "./projects-list-client";

/**
 * Projects page — React Server Component.
 *
 * Prefetches the projects list from `signapps-scheduler` on the server so
 * the first HTML chunk already carries the list.  The client island
 * (`ProjectsListClient`) seeds its local state with the prefetched data
 * and takes over interactivity after hydration.
 */
export default async function ProjectsPage() {
  const initialList = await fetchProjectsList();
  return <ProjectsListClient initialList={initialList} />;
}
