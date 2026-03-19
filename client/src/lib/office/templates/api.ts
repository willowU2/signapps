/**
 * Document Templates API
 *
 * API client for document template operations.
 */

import { getClient, ServiceName } from '@/lib/api/factory';

const api = getClient(ServiceName.OFFICE);
import type {
  Template,
  TemplateMetadata,
  TemplateGalleryFilters,
  TemplateGalleryResponse,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  ApplyTemplateRequest,
  ApplyTemplateResponse,
  TemplateCategory,
  DocumentType,
} from './types';

const TEMPLATES_BASE = '/api/v1/templates';

// ============================================================================
// Gallery & Search
// ============================================================================

/**
 * Get templates gallery with filters and pagination
 */
export async function getTemplates(
  filters: TemplateGalleryFilters = {},
  page = 1,
  pageSize = 20
): Promise<TemplateGalleryResponse> {
  const params = new URLSearchParams();

  if (filters.search) params.append('search', filters.search);
  if (filters.category && filters.category !== 'all') params.append('category', filters.category);
  if (filters.documentType && filters.documentType !== 'all') params.append('documentType', filters.documentType);
  if (filters.visibility && filters.visibility !== 'all') params.append('visibility', filters.visibility);
  if (filters.tags?.length) params.append('tags', filters.tags.join(','));
  if (filters.featuredOnly) params.append('featured', 'true');
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
  params.append('page', String(page));
  params.append('pageSize', String(pageSize));

  const response = await api.get<TemplateGalleryResponse>(
    `${TEMPLATES_BASE}?${params.toString()}`
  );
  return response.data;
}

/**
 * Get featured templates
 */
export async function getFeaturedTemplates(
  documentType?: DocumentType,
  limit = 10
): Promise<TemplateMetadata[]> {
  const params = new URLSearchParams();
  params.append('featured', 'true');
  params.append('pageSize', String(limit));
  if (documentType) params.append('documentType', documentType);

  const response = await api.get<TemplateGalleryResponse>(
    `${TEMPLATES_BASE}?${params.toString()}`
  );
  return response.data.templates;
}

/**
 * Get recently used templates
 */
export async function getRecentTemplates(limit = 10): Promise<TemplateMetadata[]> {
  const response = await api.get<TemplateMetadata[]>(
    `${TEMPLATES_BASE}/recent?limit=${limit}`
  );
  return response.data;
}

/**
 * Get templates by category
 */
export async function getTemplatesByCategory(
  category: TemplateCategory,
  page = 1,
  pageSize = 20
): Promise<TemplateGalleryResponse> {
  return getTemplates({ category }, page, pageSize);
}

/**
 * Search templates
 */
export async function searchTemplates(
  query: string,
  filters: Omit<TemplateGalleryFilters, 'search'> = {}
): Promise<TemplateGalleryResponse> {
  return getTemplates({ ...filters, search: query });
}

// ============================================================================
// Template CRUD
// ============================================================================

/**
 * Get a single template by ID
 */
export async function getTemplate(templateId: string): Promise<Template> {
  const response = await api.get<Template>(`${TEMPLATES_BASE}/${templateId}`);
  return response.data;
}

/**
 * Get template metadata only (without content)
 */
export async function getTemplateMetadata(templateId: string): Promise<TemplateMetadata> {
  const response = await api.get<TemplateMetadata>(
    `${TEMPLATES_BASE}/${templateId}/metadata`
  );
  return response.data;
}

/**
 * Create a new template
 */
export async function createTemplate(data: CreateTemplateRequest): Promise<Template> {
  const response = await api.post<Template>(TEMPLATES_BASE, data);
  return response.data;
}

/**
 * Update an existing template
 */
export async function updateTemplate(
  templateId: string,
  data: UpdateTemplateRequest
): Promise<Template> {
  const response = await api.patch<Template>(
    `${TEMPLATES_BASE}/${templateId}`,
    data
  );
  return response.data;
}

/**
 * Delete a template
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  await api.delete(`${TEMPLATES_BASE}/${templateId}`);
}

/**
 * Duplicate a template
 */
export async function duplicateTemplate(
  templateId: string,
  newName?: string
): Promise<Template> {
  const response = await api.post<Template>(
    `${TEMPLATES_BASE}/${templateId}/duplicate`,
    { name: newName }
  );
  return response.data;
}

// ============================================================================
// Template Application
// ============================================================================

/**
 * Apply a template to create a new document
 */
export async function applyTemplate(
  request: ApplyTemplateRequest
): Promise<ApplyTemplateResponse> {
  const response = await api.post<ApplyTemplateResponse>(
    `${TEMPLATES_BASE}/${request.templateId}/apply`,
    {
      variableValues: request.variableValues,
      folderId: request.folderId,
      documentName: request.documentName,
    }
  );
  return response.data;
}

/**
 * Preview a template with variable values
 */
export async function previewTemplate(
  templateId: string,
  variableValues?: Record<string, string | number | boolean>
): Promise<{ content: Record<string, unknown> }> {
  const response = await api.post<{ content: Record<string, unknown> }>(
    `${TEMPLATES_BASE}/${templateId}/preview`,
    { variableValues }
  );
  return response.data;
}

// ============================================================================
// Template Creation from Document
// ============================================================================

/**
 * Create a template from an existing document
 */
export async function createTemplateFromDocument(
  documentId: string,
  data: Omit<CreateTemplateRequest, 'content'>
): Promise<Template> {
  const response = await api.post<Template>(
    `${TEMPLATES_BASE}/from-document/${documentId}`,
    data
  );
  return response.data;
}

// ============================================================================
// Thumbnail & Preview
// ============================================================================

/**
 * Generate thumbnail for a template
 */
export async function generateThumbnail(
  templateId: string
): Promise<{ thumbnailUrl: string }> {
  const response = await api.post<{ thumbnailUrl: string }>(
    `${TEMPLATES_BASE}/${templateId}/thumbnail`
  );
  return response.data;
}

/**
 * Upload custom thumbnail
 */
export async function uploadThumbnail(
  templateId: string,
  file: File
): Promise<{ thumbnailUrl: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<{ thumbnailUrl: string }>(
    `${TEMPLATES_BASE}/${templateId}/thumbnail/upload`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
}

// ============================================================================
// Ratings & Favorites
// ============================================================================

/**
 * Rate a template
 */
export async function rateTemplate(
  templateId: string,
  rating: number
): Promise<{ rating: number; ratingCount: number }> {
  const response = await api.post<{ rating: number; ratingCount: number }>(
    `${TEMPLATES_BASE}/${templateId}/rate`,
    { rating }
  );
  return response.data;
}

/**
 * Add template to favorites
 */
export async function addToFavorites(templateId: string): Promise<void> {
  await api.post(`${TEMPLATES_BASE}/${templateId}/favorite`);
}

/**
 * Remove template from favorites
 */
export async function removeFromFavorites(templateId: string): Promise<void> {
  await api.delete(`${TEMPLATES_BASE}/${templateId}/favorite`);
}

/**
 * Get user's favorite templates
 */
export async function getFavoriteTemplates(): Promise<TemplateMetadata[]> {
  const response = await api.get<TemplateMetadata[]>(`${TEMPLATES_BASE}/favorites`);
  return response.data;
}

// ============================================================================
// My Templates
// ============================================================================

/**
 * Get templates created by the current user
 */
export async function getMyTemplates(
  page = 1,
  pageSize = 20
): Promise<TemplateGalleryResponse> {
  const response = await api.get<TemplateGalleryResponse>(
    `${TEMPLATES_BASE}/my?page=${page}&pageSize=${pageSize}`
  );
  return response.data;
}

// ============================================================================
// Export All
// ============================================================================

export const templatesApi = {
  // Gallery
  getTemplates,
  getFeaturedTemplates,
  getRecentTemplates,
  getTemplatesByCategory,
  searchTemplates,
  // CRUD
  getTemplate,
  getTemplateMetadata,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  // Application
  applyTemplate,
  previewTemplate,
  createTemplateFromDocument,
  // Thumbnail
  generateThumbnail,
  uploadThumbnail,
  // Ratings
  rateTemplate,
  addToFavorites,
  removeFromFavorites,
  getFavoriteTemplates,
  // My Templates
  getMyTemplates,
};

export default templatesApi;
