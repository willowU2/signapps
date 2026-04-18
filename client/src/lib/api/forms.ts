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
// Many types are frontend-only extensions — backend stores them opaquely.
export type FieldType =
  // ── Text inputs ──
  | "Text"
  | "TextArea"
  | "Email"
  | "Number"
  | "Phone"
  | "Url"
  | "Password"
  // ── Choice inputs ──
  | "SingleChoice"
  | "MultipleChoice"
  | "Dropdown"
  | "ImageChoice"
  | "YesNo"
  | "Rating"
  | "LinearScale"
  | "NPS"
  // ── Date & time ──
  | "Date"
  | "Time"
  | "DateTime"
  // ── Advanced ──
  | "Slider"
  | "Color"
  | "Address"
  | "File"
  | "Signature"
  | "Matrix"
  | "Ranking"
  | "Consent"
  // ── Content (non-input) ──
  | "Heading"
  | "Description"
  | "Divider"
  | "Image"
  | "PageBreak";

/** Optional per-field visual style — rendered as inline CSS at display time. */
export interface FormFieldStyle {
  fontSize?: number; // px
  fontWeight?: "normal" | "medium" | "semibold" | "bold";
  textAlign?: "left" | "center" | "right";
  textColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  accentColor?: string; // for checkboxes, radios, slider thumb
  width?: "full" | "half" | "third" | "quarter";
  shadow?: "none" | "sm" | "md" | "lg";
  padding?: number;
}

/** Extra per-field configuration — varies by field_type. */
export interface FormFieldSettings {
  // Slider / LinearScale / Rating / NPS
  min?: number;
  max?: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
  // Matrix: rows + columns
  rows?: string[];
  columns?: string[];
  // Image choice: { label, imageUrl }[]
  imageOptions?: { label: string; imageUrl: string }[];
  // Content blocks
  content?: string; // for Heading / Description
  imageUrl?: string; // for Image block
  // File upload
  acceptedTypes?: string[];
  maxSizeMB?: number;
  // Consent
  consentUrl?: string;
  // Number/Text validation
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface FormField {
  id: string;
  label: string;
  field_type: FieldType;
  required: boolean;
  options?: string[];
  layout?: string;
  placeholder?: string;
  order: number;
  /** Optional help text displayed under the field label */
  description?: string;
  /** Visual styling overrides */
  style?: FormFieldStyle;
  /** Type-specific settings */
  settings?: FormFieldSettings;
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

// ============================================================================
// Field-type compatibility layer
// ============================================================================
// The Rust backend only knows 8 types (Text, TextArea, SingleChoice,
// MultipleChoice, Rating, Date, Email, Number). All the extended types (Phone,
// Dropdown, Slider, NPS, Matrix, etc.) and the per-field `style` / `settings`
// objects are stored client-side inside the `layout` string as JSON.

const BACKEND_TYPES = new Set<FieldType>([
  "Text",
  "TextArea",
  "SingleChoice",
  "MultipleChoice",
  "Rating",
  "Date",
  "Email",
  "Number",
]);

const FALLBACK_TYPE: Record<string, FieldType> = {
  Phone: "Text",
  Url: "Text",
  Password: "Text",
  Color: "Text",
  Address: "Text",
  Dropdown: "SingleChoice",
  ImageChoice: "SingleChoice",
  YesNo: "SingleChoice",
  LinearScale: "Number",
  NPS: "Number",
  Slider: "Number",
  Time: "Date",
  DateTime: "Date",
  File: "TextArea",
  Signature: "TextArea",
  Matrix: "TextArea",
  Ranking: "TextArea",
  Consent: "TextArea",
  Heading: "TextArea",
  Description: "TextArea",
  Divider: "TextArea",
  Image: "TextArea",
  PageBreak: "TextArea",
};

const LAYOUT_META_PREFIX = "__meta:";

interface LayoutMeta {
  realType?: FieldType;
  description?: string;
  style?: FormField["style"];
  settings?: FormField["settings"];
  layout?: string; // original layout string if user used it
}

/** Pack extra frontend fields into the `layout` string for the backend. */
function packField(f: Partial<FormField>): Partial<FormField> {
  const realType = f.field_type;
  const backendType =
    realType && BACKEND_TYPES.has(realType)
      ? realType
      : FALLBACK_TYPE[realType as string] || "Text";

  const meta: LayoutMeta = {
    realType,
    description: f.description,
    style: f.style,
    settings: f.settings,
    layout:
      typeof f.layout === "string" && !f.layout.startsWith(LAYOUT_META_PREFIX)
        ? f.layout
        : undefined,
  };
  // Only include meta fields that are actually set
  const hasMeta =
    meta.realType !== backendType ||
    meta.description ||
    meta.style ||
    meta.settings ||
    meta.layout;

  const packed: Partial<FormField> = {
    id: f.id,
    label: f.label,
    field_type: backendType,
    required: f.required,
    options: f.options,
    placeholder: f.placeholder,
    order: f.order,
    layout: hasMeta ? LAYOUT_META_PREFIX + JSON.stringify(meta) : meta.layout,
  };
  return packed;
}

/** Restore full frontend fields from the packed `layout` string. */
function unpackField(f: FormField): FormField {
  if (typeof f.layout === "string" && f.layout.startsWith(LAYOUT_META_PREFIX)) {
    try {
      const raw = f.layout.slice(LAYOUT_META_PREFIX.length);
      const meta = JSON.parse(raw) as LayoutMeta;
      return {
        ...f,
        field_type: meta.realType ?? f.field_type,
        description: meta.description,
        style: meta.style,
        settings: meta.settings,
        layout: meta.layout,
      };
    } catch {
      return f;
    }
  }
  return f;
}

function unpackForm(form: Form): Form {
  return {
    ...form,
    fields: (form.fields || []).map(unpackField),
  };
}

function packFields(
  fields?: Partial<FormField>[],
): Partial<FormField>[] | undefined {
  if (!fields) return undefined;
  return fields.map(packField);
}

export const formsApi = {
  /** List all forms */
  list: async () => {
    const res = await formsClient().get<Form[]>("/forms");
    return { ...res, data: res.data.map(unpackForm) };
  },

  /** Get a single form by ID */
  get: async (id: string) => {
    const res = await formsClient().get<Form>(`/forms/${id}`);
    return { ...res, data: unpackForm(res.data) };
  },

  /** Create a new form */
  create: async (data: CreateFormRequest) => {
    const res = await formsClient().post<Form>("/forms", {
      ...data,
      fields: packFields(data.fields),
    });
    return { ...res, data: unpackForm(res.data) };
  },

  /** Update an existing form */
  update: async (id: string, data: UpdateFormRequest) => {
    const res = await formsClient().put<Form>(`/forms/${id}`, {
      ...data,
      fields: packFields(data.fields),
    });
    return { ...res, data: unpackForm(res.data) };
  },

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
