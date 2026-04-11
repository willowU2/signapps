/**
 * Entity Hub API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { schedulerClient } from "./factory";

export const entityHubApi = {
  // Workspaces
  listWorkspaces: () => schedulerClient().get("/workspaces"),
  getWorkspace: (id: string) => schedulerClient().get(`/workspaces/${id}`),
  createWorkspace: (data: Record<string, unknown>) =>
    schedulerClient().post("/workspaces", data),

  // Projects
  listProjects: () => schedulerClient().get("/projects"),
  getProject: (id: string) => schedulerClient().get(`/projects/${id}`),
  createProject: (data: Record<string, unknown>) =>
    schedulerClient().post("/projects", data),
  myProjects: () => schedulerClient().get("/projects/my-projects"),
  projectProgress: (projectId: string) =>
    schedulerClient().get(`/projects/${projectId}/progress`),
  teamWorkload: () => schedulerClient().get("/projects/team-workload"),

  // Project members
  listProjectMembers: (projectId: string) =>
    schedulerClient().get(`/projects/${projectId}/members`),
  addProjectMember: (
    projectId: string,
    data: { person_id: string; role: string; context_type?: string },
  ) => schedulerClient().post(`/projects/${projectId}/members`, data),
  updateProjectMemberRole: (
    projectId: string,
    personId: string,
    data: { role: string },
  ) =>
    schedulerClient().put(`/projects/${projectId}/members/${personId}`, data),
  removeProjectMember: (projectId: string, personId: string) =>
    schedulerClient().delete(`/projects/${projectId}/members/${personId}`),

  // Tasks
  listTasks: () => schedulerClient().get("/tasks"),
  myTasks: () => schedulerClient().get("/tasks/my-tasks"),
  getTask: (id: string) => schedulerClient().get(`/tasks/${id}`),
  createTask: (data: Record<string, unknown>) =>
    schedulerClient().post("/tasks", data),
  updateTask: (id: string, data: Record<string, unknown>) =>
    schedulerClient().put(`/tasks/${id}`, data),
  deleteTask: (id: string) => schedulerClient().delete(`/tasks/${id}`),

  // Events
  listEvents: () => schedulerClient().get("/events"),
  getEvent: (id: string) => schedulerClient().get(`/events/${id}`),
  createEvent: (data: Record<string, unknown>) =>
    schedulerClient().post("/events", data),

  // Resources
  listResources: () => schedulerClient().get("/resources"),
  getResource: (id: string) => schedulerClient().get(`/resources/${id}`),
  createResource: (data: Record<string, unknown>) =>
    schedulerClient().post("/resources", data),

  // Calendars
  listCalendars: () => schedulerClient().get("/calendars"),
  getCalendar: (id: string) => schedulerClient().get(`/calendars/${id}`),
  createCalendar: (data: Record<string, unknown>) =>
    schedulerClient().post("/calendars", data),
};
