/**
 * Office Templates Components
 *
 * Components for document template management and gallery.
 */

// Components
export { TemplateGallery } from "./template-gallery";
export { TemplatePreview } from "./template-preview";
export { CreateTemplateDialog } from "./create-template-dialog";

// Types
export type {
  Template,
  TemplateMetadata,
  TemplateContent,
  TemplateCategory,
  TemplateVisibility,
  DocumentType,
  TemplatePlaceholder,
  TemplateVariable,
  DocumentSettings,
  TemplateGalleryFilters,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  ApplyTemplateRequest,
  ApplyTemplateResponse,
} from "@/lib/office/templates/types";

// Constants
export {
  TEMPLATE_CATEGORIES,
  DOCUMENT_TYPE_LABELS,
} from "@/lib/office/templates/types";

// API
export { templatesApi } from "@/lib/office/templates/api";

// Store
export { useTemplatesStore } from "@/stores/templates-store";
