/**
 * Forms API Module — signapps-forms (port 3015)
 *
 * Provides CRUD operations for forms, publishing, and response collection.
 * The respond endpoint is public (no auth required).
 */
import { getClient, ServiceName } from "./factory";

// ============================================================================
// Types
// ============================================================================

// Matches Rust FieldType enum (PascalCase, serde default)
// PageBreak, File, Signature are frontend-only extensions not yet in the backend enum
export type FieldType =
  | "Text"
  | "TextArea"
  | "SingleChoice"
  | "MultipleChoice"
  | "Rating"
  | "Date"
  | "Email"
  | "Number"
  | "PageBreak"
  | "File"
  | "Signature";

export interface FormField {
  id: string;
  label: string;
  field_type: FieldType;
  required: boolean;
  options?: string[];
  layout?: string;
  placeholder?: string;
  order: number;
}

export interface Form {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  is_published: boolean;
  /** UUID of the form owner — matches backend `owner_id` */
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface FormAnswerEntry {
  field_id: string;
  value: unknown;
}

export interface FormResponse {
  id: string;
  form_id: string;
  /** Array of field answers — matches backend Vec<Answer> serialization */
  answers: FormAnswerEntry[];
  submitted_at: string;
  /** Email/identifier of respondent — backend field is `respondent` */
  respondent?: string;
  /** @deprecated Alias kept for backward compatibility — prefer `respondent` */
  respondent_email?: string;
}

export interface CreateFormRequest {
  title: string;
  description?: string;
  fields?: Partial<FormField>[];
}

export interface UpdateFormRequest {
  title?: string;
  description?: string;
  fields?: Partial<FormField>[];
}

// ============================================================================
// Client
// ============================================================================

const formsClient = () => getClient(ServiceName.FORMS);

// ============================================================================
// Forms API
// ============================================================================

/**
 * Possible value types for a form answer:
 * - text/long-text → string
 * - number/rating → number
 * - boolean/checkbox → boolean
 * - multiselect/checkbox-group → string[]
 * - date/datetime → string (ISO 8601)
 * - file → File (browser File object)
 * - empty/skipped → null
 *
 * Extend this union rather than falling back to `any` when a new field
 * type requires a new value shape.
 */
export type FormFieldValue = string | number | boolean | string[] | File | null;

export interface FormAnswer {
  field_id: string;
  value: FormFieldValue;
}

export const formsApi = {
  /** List all forms */
  list: () => formsClient().get<Form[]>("/forms"),

  /** Get a single form by ID */
  get: (id: string) => formsClient().get<Form>(`/forms/${id}`),

  /** Create a new form */
  create: (data: CreateFormRequest) => formsClient().post<Form>("/forms", data),

  /** Update an existing form */
  update: (id: string, data: UpdateFormRequest) =>
    formsClient().put<Form>(`/forms/${id}`, data),

  /** Delete a form */
  delete: (id: string) => formsClient().delete(`/forms/${id}`),

  /** Toggle the publish status of a form */
  publish: (id: string) => formsClient().post<Form>(`/forms/${id}/publish`),

  /** Unpublish a published form */
  unpublish: (id: string) =>
    formsClient().patch<Form>("/forms/" + id + "/unpublish"),

  /** List all responses for a form */
  responses: (id: string) =>
    formsClient().get<FormResponse[]>(`/forms/${id}/responses`),

  /**
   * Bulk response-count endpoint. Returns a map `form_id → count` for all
   * forms the caller owns. Replaces the N+1 pattern of calling
   * `responses(id)` per form just to count.
   */
  responseCounts: () =>
    formsClient().get<Record<string, number>>("/forms/response-counts"),

  /**
   * Submit a response to a published form.
   * This endpoint is public and does not require authentication.
   */
  respond: (
    id: string,
    payload: { respondent?: string; answers: FormAnswer[] },
  ) => formsClient().post(`/forms/${id}/respond`, payload),
};
