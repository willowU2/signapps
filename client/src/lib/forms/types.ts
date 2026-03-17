/**
 * Dynamic Form Configuration Types
 *
 * Ces types permettent de définir des formulaires dynamiques
 * générés depuis un schéma JSON.
 */

import { LucideIcon } from "lucide-react";
import { z } from "zod";

// ============================================================================
// Field Types
// ============================================================================

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "password"
  | "url"
  | "tel"
  | "select"
  | "multi-select"
  | "combobox"
  | "radio"
  | "checkbox"
  | "switch"
  | "date"
  | "datetime"
  | "time"
  | "file"
  | "entity-picker"
  | "color"
  | "slider"
  | "rating"
  | "hidden"
  | "custom";

// ============================================================================
// Field Configuration
// ============================================================================

export interface SelectOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  description?: string;
  disabled?: boolean;
}

export interface ValidationRule {
  type: "required" | "min" | "max" | "minLength" | "maxLength" | "pattern" | "email" | "url" | "custom";
  value?: unknown;
  message?: string;
  validator?: (value: unknown, formData: Record<string, unknown>) => boolean | string;
}

export interface FieldConfig {
  /** Unique field identifier (used as form key) */
  id: string;
  /** Field type */
  type: FieldType;
  /** Display label */
  label: string;
  /** Placeholder text */
  placeholder?: string;
  /** Help text shown below field */
  helpText?: string;
  /** Default value */
  defaultValue?: unknown;
  /** Field is required */
  required?: boolean;
  /** Field is disabled */
  disabled?: boolean;
  /** Field is read-only */
  readOnly?: boolean;
  /** Validation rules */
  validation?: ValidationRule[];
  /** Options for select/radio fields */
  options?: SelectOption[];
  /** Field width (1-12 grid columns) */
  colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  /** Required permission to see this field */
  requiredPermission?: string;
  /** Conditional visibility */
  visible?: (formData: Record<string, unknown>) => boolean;
  /** Additional props passed to the field component */
  props?: Record<string, unknown>;

  // Type-specific options
  /** For number fields */
  min?: number;
  max?: number;
  step?: number;
  /** For text/textarea fields */
  minLength?: number;
  maxLength?: number;
  rows?: number;
  /** For file fields */
  accept?: string;
  multiple?: boolean;
  /** For entity-picker fields */
  entityType?: string;
  multiSelect?: boolean;
  /** For slider fields */
  marks?: { value: number; label: string }[];
  /** For rating fields */
  maxRating?: number;
  /** Custom render function */
  render?: (props: FieldRenderProps) => React.ReactNode;
}

export interface FieldRenderProps {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
}

// ============================================================================
// Form Section Configuration
// ============================================================================

export interface FormSection {
  /** Section identifier */
  id: string;
  /** Section title */
  title?: string;
  /** Section description */
  description?: string;
  /** Fields in this section */
  fields: FieldConfig[];
  /** Collapsible section */
  collapsible?: boolean;
  /** Default collapsed state */
  defaultCollapsed?: boolean;
  /** Required permission to see this section */
  requiredPermission?: string;
}

// ============================================================================
// Form Schema Configuration
// ============================================================================

export interface FormSchema {
  /** Form identifier */
  id: string;
  /** Form title */
  title?: string;
  /** Form description */
  description?: string;
  /** Form sections (or flat fields) */
  sections?: FormSection[];
  /** Fields (for simple forms without sections) */
  fields?: FieldConfig[];
  /** Submit button label */
  submitLabel?: string;
  /** Cancel button label */
  cancelLabel?: string;
  /** Show cancel button */
  showCancel?: boolean;
  /** Number of grid columns */
  columns?: 1 | 2 | 3 | 4;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Form State
// ============================================================================

export interface FormState {
  values: Record<string, unknown>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;
}

// ============================================================================
// Form Props
// ============================================================================

export interface DynamicFormProps {
  /** Form schema */
  schema: FormSchema;
  /** Initial values */
  defaultValues?: Record<string, unknown>;
  /** Submit handler */
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  /** Cancel handler */
  onCancel?: () => void;
  /** Value change handler */
  onChange?: (values: Record<string, unknown>) => void;
  /** Form is loading */
  isLoading?: boolean;
  /** Form is read-only */
  readOnly?: boolean;
  /** Custom class name */
  className?: string;
  /** Custom footer content */
  footer?: React.ReactNode;
  /** Inline mode (no submit button) */
  inline?: boolean;
}

// ============================================================================
// Zod Schema Builder Helper
// ============================================================================

export function buildZodSchema(fields: FieldConfig[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let schema: z.ZodTypeAny;

    switch (field.type) {
      case "number":
      case "slider":
      case "rating":
        schema = z.coerce.number();
        if (field.min !== undefined) schema = (schema as z.ZodNumber).min(field.min);
        if (field.max !== undefined) schema = (schema as z.ZodNumber).max(field.max);
        break;

      case "checkbox":
      case "switch":
        schema = z.boolean();
        break;

      case "date":
      case "datetime":
      case "time":
        schema = z.string().or(z.date());
        break;

      case "multi-select":
        schema = z.array(z.string());
        break;

      case "file":
        schema = field.multiple ? z.array(z.any()) : z.any();
        break;

      case "email":
        schema = z.string().email(field.validation?.find((v) => v.type === "email")?.message);
        break;

      case "url":
        schema = z.string().url(field.validation?.find((v) => v.type === "url")?.message);
        break;

      case "entity-picker":
        schema = field.multiSelect ? z.array(z.string()) : z.string();
        break;

      default:
        schema = z.string();
        if (field.minLength) schema = (schema as z.ZodString).min(field.minLength);
        if (field.maxLength) schema = (schema as z.ZodString).max(field.maxLength);
    }

    // Make optional if not required
    if (!field.required) {
      schema = schema.optional();
    }

    shape[field.id] = schema;
  }

  return z.object(shape);
}
