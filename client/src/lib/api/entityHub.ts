/**
 * Entity Hub API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { schedulerClient } from './factory';

export const entityHubApi = {
  // Workspaces
  listWorkspaces: () => schedulerClient().get('/workspaces'),
  getWorkspace: (id: string) => schedulerClient().get(`/workspaces/${id}`),
  createWorkspace: (data: any) => schedulerClient().post('/workspaces', data),
  
  // Projects
  listProjects: () => schedulerClient().get('/projects'),
  getProject: (id: string) => schedulerClient().get(`/projects/${id}`),
  createProject: (data: any) => schedulerClient().post('/projects', data),
  
  // Tasks
  listTasks: () => schedulerClient().get('/tasks'),
  getTask: (id: string) => schedulerClient().get(`/tasks/${id}`),
  createTask: (data: any) => schedulerClient().post('/tasks', data),
  updateTask: (id: string, data: any) => schedulerClient().put(`/tasks/${id}`, data),
  deleteTask: (id: string) => schedulerClient().delete(`/tasks/${id}`),
  
  // Events
  listEvents: () => schedulerClient().get('/events'),
  getEvent: (id: string) => schedulerClient().get(`/events/${id}`),
  createEvent: (data: any) => schedulerClient().post('/events', data),
  
  // Resources
  listResources: () => schedulerClient().get('/resources'),
  getResource: (id: string) => schedulerClient().get(`/resources/${id}`),
  createResource: (data: any) => schedulerClient().post('/resources', data),
  
  // Calendars
  listCalendars: () => schedulerClient().get('/calendars'),
  getCalendar: (id: string) => schedulerClient().get(`/calendars/${id}`),
  createCalendar: (data: any) => schedulerClient().post('/calendars', data),
};
