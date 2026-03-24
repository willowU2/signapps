/**
 * Contacts API Client - SignApps Platform
 *
 * Client for signapps-contacts service (port 3014).
 * Provides CRUD operations for contacts, group management,
 * and vCard import/export.
 */

import { getClient, ServiceName } from './factory';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  notes?: string;
  avatar_url?: string;
  groups?: string[];
  created_at: string;
  updated_at: string;
}

export interface ContactGroup {
  id: string;
  name: string;
  count: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT
// ═══════════════════════════════════════════════════════════════════════════

const client = () => getClient(ServiceName.CONTACTS);

// ═══════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════

export const contactsApi = {
  /** List all contacts */
  list: () => client().get<Contact[]>('/contacts'),

  /** Get a contact by ID */
  get: (id: string) => client().get<Contact>(`/contacts/${id}`),

  /** Create a new contact */
  create: (data: Partial<Contact>) => client().post<Contact>('/contacts', data),

  /** Update an existing contact */
  update: (id: string, data: Partial<Contact>) => client().put<Contact>(`/contacts/${id}`, data),

  /** Delete a contact */
  delete: (id: string) => client().delete(`/contacts/${id}`),

  /** List all contact groups */
  groups: () => client().get<ContactGroup[]>('/contacts/groups'),

  /** Export contacts as vCard (.vcf) */
  exportVcf: () => client().get('/contacts/export/vcf', { responseType: 'blob' }),

  /** Import contacts from a vCard file */
  importVcf: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return client().post('/contacts/import/vcf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
