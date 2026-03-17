/**
 * Forms Module
 *
 * Export centralisé pour le système de formulaires dynamiques.
 */

// Types
export type {
  FieldType,
  SelectOption,
  ValidationRule,
  FieldConfig,
  FieldRenderProps,
  FormSection,
  FormSchema,
  FormState,
  DynamicFormProps,
} from "./types";

export { buildZodSchema } from "./types";

// Field Renderers
export {
  FieldWrapper,
  TextField,
  TextareaField,
  SelectField,
  MultiSelectField,
  RadioField,
  CheckboxField,
  SwitchField,
  DateField,
  DateTimeField,
  TimeField,
  SliderField,
  RatingField,
  FileField,
  ColorField,
  fieldRenderers,
  renderField,
} from "./field-renderers";
