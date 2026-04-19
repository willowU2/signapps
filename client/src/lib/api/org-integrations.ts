/**
 * SO4 — Org Integrations API client.
 *
 * Wraps:
 * - AD preview / approve
 * - Public links CRUD + rotate
 * - Webhooks CRUD + test + deliveries timeline
 * - Photo upload (multipart) for persons + node group photos
 *
 * The `signapps-org` service is reachable at port 3026 with a
 * `/api/v1` prefix baked into the axios baseURL — paths below stay in
 * the `/org/*` shape (no `/api/v1` prefix).
 */
import { getClient, ServiceName } from "./factory";
import { useTenantStore } from "@/stores/tenant-store";

const client = getClient(ServiceName.ORG_SVC);

// ─── Tenant resolution (mirrors org.ts) ──────────────────────────────

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    const decoded =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function resolveTenantId(): string {
  try {
    const tenant = useTenantStore.getState().tenant;
    if (tenant?.id) return tenant.id;
  } catch {
    // store not hydrated yet — try JWT.
  }
  if (typeof window === "undefined") return "";
  const token = window.localStorage.getItem("access_token");
  if (!token) return "";
  const payload = decodeJwtPayload(token);
  return typeof payload?.tenant_id === "string"
    ? (payload.tenant_id as string)
    : "";
}

// ─── AD preview / approve ────────────────────────────────────────────

export type AdPreviewKind = "add" | "remove" | "move" | "conflict";

export interface AdPreviewOperation {
  id: string;
  kind: AdPreviewKind;
  dn: string;
  payload: Record<string, unknown>;
  note: string | null;
}

export interface AdPreviewResponse {
  run_id: string;
  adds: AdPreviewOperation[];
  removes: AdPreviewOperation[];
  moves: AdPreviewOperation[];
  conflicts: AdPreviewOperation[];
  stats: { total: number; conflicts: number };
  mock: boolean;
}

export interface AdApproveResponse {
  applied: string[];
  skipped: string[];
  errors: Array<{ op_id: string; message: string }>;
}

export const adIntegrationsApi = {
  async preview(tenantId?: string): Promise<AdPreviewResponse> {
    const t = tenantId ?? resolveTenantId();
    const { data } = await client.post<AdPreviewResponse>(
      `/org/ad/sync/${t}/preview`,
      {},
    );
    return data;
  },

  async approve(
    runId: string,
    selectedOpIds: string[],
    tenantId?: string,
  ): Promise<AdApproveResponse> {
    const t = tenantId ?? resolveTenantId();
    const { data } = await client.post<AdApproveResponse>(
      `/org/ad/sync/${t}/approve`,
      { run_id: runId, selected_op_ids: selectedOpIds },
    );
    return data;
  },
};

// ─── Public links ────────────────────────────────────────────────────

export type LinkVisibility = "full" | "anon" | "compact";

export interface PublicLinkView {
  id: string;
  tenant_id: string;
  root_node_id: string;
  slug: string;
  visibility: LinkVisibility;
  allowed_origins: string[];
  expires_at: string | null;
  access_count: number;
  created_at: string;
  is_active: boolean;
}

export interface CreatePublicLinkBody {
  tenant_id: string;
  root_node_id: string;
  visibility: LinkVisibility;
  allowed_origins?: string[];
  expires_at?: string | null;
}

export const publicLinksApi = {
  async list(tenantId?: string): Promise<PublicLinkView[]> {
    const t = tenantId ?? resolveTenantId();
    const { data } = await client.get<PublicLinkView[]>(
      `/org/public-links?tenant_id=${encodeURIComponent(t)}`,
    );
    return data;
  },

  async create(body: CreatePublicLinkBody): Promise<PublicLinkView> {
    const { data } = await client.post<PublicLinkView>(
      "/org/public-links",
      body,
    );
    return data;
  },

  async revoke(id: string): Promise<void> {
    await client.delete(`/org/public-links/${id}`);
  },

  async rotate(id: string): Promise<PublicLinkView> {
    const { data } = await client.post<PublicLinkView>(
      `/org/public-links/${id}/rotate`,
    );
    return data;
  },
};

// ─── Webhooks ────────────────────────────────────────────────────────

export interface WebhookView {
  id: string;
  tenant_id: string;
  url: string;
  events: string[];
  active: boolean;
  last_delivery_at: string | null;
  last_status: number | null;
  failure_count: number;
  created_at: string;
  has_secret: boolean;
}

export interface WebhookCreateView extends WebhookView {
  secret: string;
}

export interface WebhookDelivery {
  id: number;
  webhook_id: string;
  event_type: string;
  payload_json: Record<string, unknown>;
  status_code: number | null;
  response_body: string | null;
  error_message: string | null;
  attempt: number;
  delivered_at: string;
}

export const orgWebhooksApi = {
  async list(tenantId?: string): Promise<WebhookView[]> {
    const t = tenantId ?? resolveTenantId();
    const { data } = await client.get<WebhookView[]>(
      `/org/webhooks?tenant_id=${encodeURIComponent(t)}`,
    );
    return data;
  },

  async create(body: {
    tenant_id?: string;
    url: string;
    events: string[];
  }): Promise<WebhookCreateView> {
    const tenant_id = body.tenant_id ?? resolveTenantId();
    const { data } = await client.post<WebhookCreateView>("/org/webhooks", {
      ...body,
      tenant_id,
    });
    return data;
  },

  async update(
    id: string,
    body: { url?: string; events?: string[]; active?: boolean },
  ): Promise<WebhookView> {
    const { data } = await client.put<WebhookView>(`/org/webhooks/${id}`, body);
    return data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/org/webhooks/${id}`);
  },

  async test(id: string): Promise<void> {
    await client.post(`/org/webhooks/${id}/test`);
  },

  async deliveries(id: string, limit = 50): Promise<WebhookDelivery[]> {
    const { data } = await client.get<WebhookDelivery[]>(
      `/org/webhooks/${id}/deliveries?limit=${limit}`,
    );
    return data;
  },
};

// ─── Photos ──────────────────────────────────────────────────────────

export interface PhotoResponse {
  url: string;
  content_type: string;
  size: number;
}

async function uploadPhoto(
  endpoint: string,
  file: File,
): Promise<PhotoResponse> {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await client.post<PhotoResponse>(endpoint, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export const orgPhotosApi = {
  uploadPersonPhoto(personId: string, file: File): Promise<PhotoResponse> {
    return uploadPhoto(`/org/persons/${personId}/photo`, file);
  },

  async deletePersonPhoto(personId: string): Promise<void> {
    await client.delete(`/org/persons/${personId}/photo`);
  },

  uploadNodeGroupPhoto(nodeId: string, file: File): Promise<PhotoResponse> {
    return uploadPhoto(`/org/nodes/${nodeId}/group-photo`, file);
  },

  async deleteNodeGroupPhoto(nodeId: string): Promise<void> {
    await client.delete(`/org/nodes/${nodeId}/group-photo`);
  },
};
