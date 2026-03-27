/**
 * Forms API Module — signapps-forms (port 3015)
 *
 * Provides CRUD operations for forms, publishing, and response collection.
 * The respond endpoint is public (no auth required).
 */
import { getClient, ServiceName } from './factory';

// ============================================================================
// Types
// ============================================================================

export interface FormField {
  id: string;
  label: string;
  field_type: 'Text' | 'Number' | 'Email' | 'SingleChoice' | 'MultipleChoice' | 'TextArea' | 'Date' | 'File' | 'Rating';
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
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FormResponse {
  id: string;
  form_id: string;
  answers: Record<string, unknown>;
  submitted_at: string;
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

export interface FormAnswer {
  field_id: string;
  value: any;
}

export const formsApi = {
  /** List all forms */
  list: () =>
    formsClient().get<Form[]>('/forms'),

  /** Get a single form by ID */
  get: (id: string) =>
    formsClient().get<Form>(`/forms/${id}`),

  /** Create a new form */
  create: (data: CreateFormRequest) =>
    formsClient().post<Form>('/forms', data),

  /** Update an existing form */
  update: (id: string, data: UpdateFormRequest) =>
    formsClient().put<Form>(`/forms/${id}`, data),

  /** Delete a form */
  delete: (id: string) =>
    formsClient().delete(`/forms/${id}`),

  /** Toggle the publish status of a form */
  publish: (id: string) =>
    formsClient().post<Form>(`/forms/${id}/publish`),

  /** Unpublish a published form */
  unpublish: (id: string) =>
    formsClient().patch<Form>('/forms/' + id + '/unpublish'),

  /** List all responses for a form */
  responses: (id: string) =>
    formsClient().get<FormResponse[]>(`/forms/${id}/responses`),

  /**
   * Submit a response to a published form.
   * This endpoint is public and does not require authentication.
   */
  respond: (id: string, payload: { respondent?: string, answers: FormAnswer[] }) =>
    formsClient().post(`/forms/${id}/respond`, payload),
};
