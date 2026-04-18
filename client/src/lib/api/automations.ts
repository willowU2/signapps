/**
 * Automations, Extensions & Action Catalog API client.
 *
 * Talks to the signapps-integrations service (port 3030).
 */

import { getClient, ServiceName } from "./factory";

const client = () => getClient(ServiceName.INTEGRATIONS);

export const automationsApi = {
  // -- Automations -----------------------------------------------------------

  list: (activeOnly?: boolean) =>
    client().get("/automations", { params: { active_only: activeOnly } }),

  create: (data: {
    name: string;
    description?: string;
    trigger_type: string;
    trigger_config?: Record<string, unknown>;
  }) => client().post("/automations", data),

  get: (id: string) => client().get(`/automations/${id}`),

  update: (id: string, data: Record<string, unknown>) =>
    client().put(`/automations/${id}`, data),

  delete: (id: string) => client().delete(`/automations/${id}`),

  // -- Steps -----------------------------------------------------------------

  listSteps: (id: string) => client().get(`/automations/${id}/steps`),

  addStep: (
    id: string,
    data: {
      step_order?: number;
      step_type: string;
      action_type?: string;
      config?: Record<string, unknown>;
    },
  ) => client().post(`/automations/${id}/steps`, data),

  updateStep: (id: string, stepId: string, data: Record<string, unknown>) =>
    client().put(`/automations/${id}/steps/${stepId}`, data),

  deleteStep: (id: string, stepId: string) =>
    client().delete(`/automations/${id}/steps/${stepId}`),

  // -- Runs ------------------------------------------------------------------

  triggerRun: (id: string) => client().post(`/automations/${id}/run`),

  listRuns: (id: string, limit?: number) =>
    client().get(`/automations/${id}/runs`, { params: { limit: limit ?? 20 } }),

  // -- Action Catalog --------------------------------------------------------

  listActions: (category?: string) =>
    client().get("/actions", { params: { category } }),

  // -- Extensions ------------------------------------------------------------

  listExtensions: () => client().get("/extensions"),

  installExtension: (data: {
    name: string;
    description?: string;
    version?: string;
    entry_point: string;
    permissions?: string[];
  }) => client().post("/extensions", data),

  approveExtension: (id: string) => client().put(`/extensions/${id}/approve`),

  uninstallExtension: (id: string) => client().delete(`/extensions/${id}`),
};
