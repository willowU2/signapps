/**
 * Template Variables API Module
 *
 * CRUD for template variables, variable resolution, batch export,
 * and social media presets. Uses the docs service (port 3010).
 *
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.DOCS);

// ============================================================================
// Types
// ============================================================================

/** A variable placeholder defined on a document template. */
export interface TemplateVariable {
  id: string;
  tenant_id: string;
  template_id: string;
  /** Variable name (used in {{name}} placeholders). */
  name: string;
  /** Variable type: text, image, date, or list. */
  variable_type: "text" | "image" | "date" | "list";
  /** Default value if none is provided at resolve time. */
  default_value: string | null;
  /** Human-readable description. */
  description: string | null;
  /** Whether a value must be provided at resolve time. */
  required: boolean;
  created_at: string;
}

/** Payload for creating a new template variable. */
export interface CreateTemplateVariablePayload {
  name: string;
  variable_type: "text" | "image" | "date" | "list";
  default_value?: string;
  description?: string;
  required?: boolean;
}

/** A named dataset attached to a template for batch resolution. */
export interface TemplateDataset {
  id: string;
  tenant_id: string;
  template_id: string;
  name: string;
  /** Array of row objects (each maps variable name to value). */
  data: Record<string, string>[];
  created_at: string;
}

/** Payload for creating a new template dataset. */
export interface CreateDatasetPayload {
  name: string;
  data: Record<string, string>[];
}

/** A social media format preset. */
export interface SocialPreset {
  id: string;
  platform: string;
  format_name: string;
  width: number;
  height: number;
  aspect_ratio: string | null;
  description: string | null;
}

/** Body for resolving template variables. */
export interface ResolveBody {
  values: Record<string, string>;
  /** Document JSON content to resolve variables in. */
  content?: Record<string, unknown>;
}

/** Response from variable resolution. */
export interface ResolveResponse {
  resolved: Record<string, unknown>;
}

/** Body for batch export. */
export interface BatchExportBody {
  format: string;
  content: Record<string, unknown>;
  rows: Record<string, string>[];
}

/** A single resolved document in a batch. */
export interface BatchExportItem {
  index: number;
  resolved: Record<string, unknown>;
}

/** Response from batch export. */
export interface BatchExportResponse {
  count: number;
  items: BatchExportItem[];
}

// ============================================================================
// API
// ============================================================================

export const templateVarsApi = {
  // -- Variables --

  /** List variables for a template. */
  listVariables: (templateId: string) =>
    client.get<{ data: TemplateVariable[] }>(
      `/templates/${templateId}/variables`,
    ),

  /** Create a variable on a template. */
  createVariable: (templateId: string, data: CreateTemplateVariablePayload) =>
    client.post<{ data: TemplateVariable }>(
      `/templates/${templateId}/variables`,
      data,
    ),

  /** Delete a variable from a template. */
  deleteVariable: (templateId: string, variableId: string) =>
    client.delete(`/templates/${templateId}/variables/${variableId}`),

  // -- Resolve --

  /** Resolve variables in document content. */
  resolve: (templateId: string, body: ResolveBody) =>
    client.post<{ data: ResolveResponse }>(
      `/templates/${templateId}/resolve`,
      body,
    ),

  /** Batch resolve N rows of variables. */
  batchExport: (templateId: string, body: BatchExportBody) =>
    client.post<{ data: BatchExportResponse }>(
      `/templates/${templateId}/batch-export`,
      body,
    ),

  // -- Social Presets --

  /** List all social media presets. */
  listSocialPresets: () =>
    client.get<{ data: SocialPreset[] }>("/social-presets"),

  /** List social media presets for a specific platform. */
  listSocialPresetsByPlatform: (platform: string) =>
    client.get<{ data: SocialPreset[] }>(`/social-presets/${platform}`),
};
