/**
 * Webhooks API — signapps-webhooks (port 3027)
 *
 * Gestion des webhooks sortants : enregistrement, test, historique de livraison.
 */
import { getClient, ServiceName } from "./factory";

const client = () => getClient(ServiceName.WEBHOOKS_SVC);

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret?: string;
  last_triggered_at: string | null;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateWebhookEndpointRequest {
  name: string;
  url: string;
  events: string[];
  secret?: string;
  enabled?: boolean;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: string;
  status: "success" | "failed" | "pending";
  status_code: number | null;
  duration_ms: number | null;
  timestamp: string;
  request_body: string;
  response_body: string | null;
  error: string | null;
}

export interface WebhookTestResult {
  success: boolean;
  status_code: number | null;
  duration_ms: number;
  error: string | null;
}

// ─── API ────────────────────────────────────────────────────────────────────

export const webhooksServiceApi = {
  /** Liste tous les webhooks du tenant */
  list: () => client().get<WebhookEndpoint[]>("/webhooks"),

  /** Crée un nouveau webhook */
  create: (data: CreateWebhookEndpointRequest) =>
    client().post<WebhookEndpoint>("/webhooks", data),

  /** Met à jour un webhook */
  update: (id: string, data: Partial<CreateWebhookEndpointRequest>) =>
    client().put<WebhookEndpoint>(`/webhooks/${id}`, data),

  /** Supprime un webhook */
  delete: (id: string) => client().delete(`/webhooks/${id}`),

  /** Déclenche un test du webhook */
  test: (id: string) =>
    client().post<WebhookTestResult>(`/webhooks/${id}/test`),

  /** Historique de livraison d'un webhook */
  deliveries: (id: string, params?: { limit?: number; offset?: number }) =>
    client().get<WebhookDelivery[]>(`/webhooks/${id}/deliveries`, { params }),

  /** Historique de livraison global (tous webhooks) */
  allDeliveries: (params?: {
    limit?: number;
    offset?: number;
    status?: "success" | "failed" | "pending";
  }) => client().get<WebhookDelivery[]>("/webhooks/deliveries", { params }),
};
