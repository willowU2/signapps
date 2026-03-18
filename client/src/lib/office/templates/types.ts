/**
 * Document Templates Types
 *
 * Type definitions for the document template system.
 */

// ============================================================================
// Core Types
// ============================================================================

export type TemplateCategory =
  | 'business'
  | 'education'
  | 'personal'
  | 'marketing'
  | 'legal'
  | 'hr'
  | 'finance'
  | 'creative'
  | 'custom';

export type DocumentType = 'doc' | 'sheet' | 'slide';

export type TemplateVisibility = 'private' | 'workspace' | 'organization' | 'public';

// ============================================================================
// Template Definition
// ============================================================================

export interface TemplateMetadata {
  /** Template unique identifier */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description?: string;
  /** Template category */
  category: TemplateCategory;
  /** Document type */
  documentType: DocumentType;
  /** Tags for search/filtering */
  tags: string[];
  /** Template visibility */
  visibility: TemplateVisibility;
  /** Preview thumbnail URL */
  thumbnailUrl?: string;
  /** Full preview images */
  previewImages?: string[];
  /** Creator user ID */
  createdBy: string;
  /** Creator username */
  createdByName: string;
  /** Creation date */
  createdAt: string;
  /** Last update date */
  updatedAt: string;
  /** Usage count */
  usageCount: number;
  /** Average rating */
  rating?: number;
  /** Number of ratings */
  ratingCount?: number;
  /** Whether the template is featured */
  featured?: boolean;
  /** Language/locale */
  locale?: string;
}

export interface TemplateContent {
  /** Serialized Tiptap/editor JSON content */
  content: Record<string, unknown>;
  /** Document-specific metadata (page size, orientation, etc.) */
  documentSettings?: DocumentSettings;
  /** Placeholder definitions */
  placeholders?: TemplatePlaceholder[];
  /** Variables that can be filled in */
  variables?: TemplateVariable[];
}

export interface Template extends TemplateMetadata {
  /** Template content */
  content: TemplateContent;
}

// ============================================================================
// Document Settings
// ============================================================================

export interface DocumentSettings {
  /** Page size (A4, Letter, etc.) */
  pageSize?: 'A4' | 'Letter' | 'Legal' | 'A3' | 'Custom';
  /** Page orientation */
  orientation?: 'portrait' | 'landscape';
  /** Margins in mm */
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  /** Header content */
  header?: string;
  /** Footer content */
  footer?: string;
  /** Whether to show page numbers */
  showPageNumbers?: boolean;
  /** Default font family */
  fontFamily?: string;
  /** Default font size */
  fontSize?: number;
}

// ============================================================================
// Placeholders & Variables
// ============================================================================

export interface TemplatePlaceholder {
  /** Placeholder ID */
  id: string;
  /** Display label */
  label: string;
  /** Placeholder type */
  type: 'text' | 'date' | 'number' | 'image' | 'signature';
  /** Whether it's required */
  required: boolean;
  /** Default value */
  defaultValue?: string;
  /** Placeholder text shown in template */
  placeholder: string;
  /** Description/hint */
  description?: string;
  /** Position in document */
  position?: { from: number; to: number };
}

export interface TemplateVariable {
  /** Variable key (e.g., "company_name") */
  key: string;
  /** Display label */
  label: string;
  /** Variable type */
  type: 'text' | 'date' | 'number' | 'select' | 'boolean';
  /** Required field */
  required: boolean;
  /** Default value */
  defaultValue?: string | number | boolean;
  /** Options for select type */
  options?: { label: string; value: string }[];
  /** Validation pattern */
  pattern?: string;
}

// ============================================================================
// Template Gallery
// ============================================================================

export interface TemplateGalleryFilters {
  /** Search query */
  search?: string;
  /** Category filter */
  category?: TemplateCategory | 'all';
  /** Document type filter */
  documentType?: DocumentType | 'all';
  /** Visibility filter */
  visibility?: TemplateVisibility | 'all';
  /** Tags filter */
  tags?: string[];
  /** Featured only */
  featuredOnly?: boolean;
  /** Sort field */
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'usageCount' | 'rating';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

export interface TemplateGalleryResponse {
  templates: TemplateMetadata[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// Template Creation
// ============================================================================

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  category: TemplateCategory;
  documentType: DocumentType;
  tags?: string[];
  visibility: TemplateVisibility;
  content: TemplateContent;
  thumbnailUrl?: string;
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  category?: TemplateCategory;
  tags?: string[];
  visibility?: TemplateVisibility;
  content?: TemplateContent;
  thumbnailUrl?: string;
}

// ============================================================================
// Template Application
// ============================================================================

export interface ApplyTemplateRequest {
  templateId: string;
  /** Values for variables */
  variableValues?: Record<string, string | number | boolean>;
  /** Destination folder ID */
  folderId?: string;
  /** New document name */
  documentName?: string;
}

export interface ApplyTemplateResponse {
  documentId: string;
  documentName: string;
  documentUrl: string;
}

// ============================================================================
// Category Metadata
// ============================================================================

export const TEMPLATE_CATEGORIES: Record<TemplateCategory, { label: string; icon: string; description: string }> = {
  business: {
    label: 'Entreprise',
    icon: 'Briefcase',
    description: 'Documents professionnels et d\'entreprise',
  },
  education: {
    label: 'Éducation',
    icon: 'GraduationCap',
    description: 'Supports pédagogiques et académiques',
  },
  personal: {
    label: 'Personnel',
    icon: 'User',
    description: 'Documents personnels et CV',
  },
  marketing: {
    label: 'Marketing',
    icon: 'Megaphone',
    description: 'Supports marketing et communication',
  },
  legal: {
    label: 'Juridique',
    icon: 'Scale',
    description: 'Contrats et documents légaux',
  },
  hr: {
    label: 'Ressources Humaines',
    icon: 'Users',
    description: 'Formulaires RH et onboarding',
  },
  finance: {
    label: 'Finance',
    icon: 'Calculator',
    description: 'Rapports financiers et factures',
  },
  creative: {
    label: 'Créatif',
    icon: 'Palette',
    description: 'Designs créatifs et artistiques',
  },
  custom: {
    label: 'Personnalisé',
    icon: 'Folder',
    description: 'Templates personnalisés',
  },
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  doc: 'Document',
  sheet: 'Feuille de calcul',
  slide: 'Présentation',
};
