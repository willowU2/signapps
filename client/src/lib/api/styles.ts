/**
 * Styles API Module
 *
 * CRUD + cascade resolution for style definitions.
 * Uses the docs service (port 3010).
 *
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.DOCS);

// ============================================================================
// Types
// ============================================================================

/** A style definition with optional parent for cascade inheritance. */
export interface StyleDefinition {
  id: string;
  tenant_id: string;
  name: string;
  /** Style category: paragraph, character, cell, slide. */
  style_type: string;
  /** Optional parent style for cascade inheritance. */
  parent_id: string | null;
  /** Style properties (JSON object merged during resolution). */
  properties: Record<string, unknown>;
  /** Whether this style is a built-in default (cannot be modified). */
  is_builtin: boolean;
  /** Visibility scope: global, template, document. */
  scope: string;
  /** Optional document this style is scoped to. */
  document_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Resolved style with all properties merged from the inheritance chain. */
export interface ResolvedStyle {
  id: string;
  name: string;
  style_type: string;
  /** Merged properties from the entire inheritance chain. */
  properties: Record<string, unknown>;
  /** IDs of styles in the chain, from leaf to root. */
  inheritance_chain: string[];
}

/** Payload for creating a new style. */
export interface CreateStylePayload {
  name: string;
  style_type: string;
  parent_id?: string;
  properties: Record<string, unknown>;
  scope?: string;
  document_id?: string;
}

/** Payload for updating an existing style. */
export interface UpdateStylePayload {
  name?: string;
  parent_id?: string;
  properties?: Record<string, unknown>;
}

// ============================================================================
// API
// ============================================================================

export const stylesApi = {
  /** List styles for the current tenant, optionally filtered by type and scope. */
  list: (type?: string, scope?: string) =>
    client.get<{ data: StyleDefinition[] }>("/styles", {
      params: { type, scope },
    }),

  /** Get a style by ID. */
  get: (id: string) => client.get<{ data: StyleDefinition }>(`/styles/${id}`),

  /** Get resolved style with merged cascade properties. */
  getResolved: (id: string) =>
    client.get<{ data: ResolvedStyle }>(`/styles/${id}/resolved`),

  /** Create a new style definition. */
  create: (data: CreateStylePayload) =>
    client.post<{ data: StyleDefinition }>("/styles", data),

  /** Update a style (non-builtin only). */
  update: (id: string, data: UpdateStylePayload) =>
    client.put<{ data: StyleDefinition }>(`/styles/${id}`, data),

  /** Delete a style (non-builtin only). */
  delete: (id: string) => client.delete(`/styles/${id}`),

  /** List styles associated with a template. */
  listForTemplate: (templateId: string) =>
    client.get<{ data: StyleDefinition[] }>(`/styles/templates/${templateId}`),
};
