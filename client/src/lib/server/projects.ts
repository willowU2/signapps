import "server-only";

import { fetchServer, logFetchFailure } from "./http";

/**
 * Minimal shape of a project returned by `/api/v1/projects` — mirrors the
 * fields the projects overview renders.  Kept independent of the client-side
 * entityHub types so the server bundle does not pull the whole axios client
 * layer.  Extra keys are preserved via the index signature so the client
 * can still access fields we did not enumerate.
 */
export interface ProjectSummary {
  id: string;
  name?: string;
  description?: string | null;
  status?: string | null;
  progress?: number;
  progress_percent?: number;
  due_date?: string | null;
  members_count?: number;
  tasks_total?: number;
  tasks_done?: number;
  [key: string]: unknown;
}

/**
 * Shell of prefetched projects data handed to the client island.  When the
 * backend is unreachable, the server still renders an empty shell so the
 * client takes over after hydration and shows the proper empty/error state.
 */
export interface ProjectsListResponse {
  projects: ProjectSummary[];
  total?: number;
  unreachable: boolean;
}

const PROJECTS_BASE_URL =
  process.env.NEXT_PUBLIC_SCHEDULER_URL ??
  process.env.BACKEND_BASE_URL ??
  "http://localhost:3099";

/**
 * Server-side prefetch of the projects list for the RSC page.
 *
 * Returns an empty shell if the backend is unreachable, so the page still
 * renders and the client hooks can retry once the service is available.
 */
export async function fetchProjectsList(): Promise<ProjectsListResponse> {
  try {
    const raw = await fetchServer<
      ProjectSummary[] | { projects?: ProjectSummary[] }
    >("/api/v1/projects", { baseUrl: PROJECTS_BASE_URL });
    // The backend may return either a bare array or `{ projects: [...] }`.
    const projects = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.projects)
        ? raw.projects
        : [];
    return {
      projects,
      total: projects.length,
      unreachable: false,
    };
  } catch (err) {
    logFetchFailure("projects", err);
    return { projects: [], total: 0, unreachable: true };
  }
}
