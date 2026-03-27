import { getClient, ServiceName } from './factory';
import type {
  EntityReference,
  Activity,
  SignatureEnvelope,
  EnvelopeStep,
  EnvelopeTransition,
  AuditLogEntry,
} from '@/types/crosslinks';

const client = () => getClient(ServiceName.IDENTITY);

export const linksApi = {
  find: (entityType: string, entityId: string) =>
    client().get<EntityReference[]>('/links', { params: { entity_type: entityType, entity_id: entityId } }),
  create: (data: { source_type: string; source_id: string; target_type: string; target_id: string; relation?: string }) =>
    client().post<EntityReference>('/links', data),
  remove: (id: string) =>
    client().delete(`/links/${id}`),
};

export const activitiesApi = {
  feed: (params: { workspace_id?: string; limit?: number; offset?: number }) =>
    client().get<Activity[]>('/activities', { params }),
  entityHistory: (entityType: string, entityId: string) =>
    client().get<Activity[]>('/activities', { params: { entity_type: entityType, entity_id: entityId } }),
  recent: (limit = 20) =>
    client().get<Activity[]>('/activities', { params: { mine: true, limit } }),
};

export const signaturesApi = {
  create: (data: { title: string; document_id: string; expires_at?: string }) =>
    client().post<SignatureEnvelope>('/signatures', data),
  get: (id: string) =>
    client().get<SignatureEnvelope>(`/signatures/${id}`),
  list: (params?: { limit?: number; offset?: number }) =>
    client().get<SignatureEnvelope[]>('/signatures', { params }),
  send: (id: string) =>
    client().post<SignatureEnvelope>(`/signatures/${id}/send`),
  void: (id: string) =>
    client().post<SignatureEnvelope>(`/signatures/${id}/void`),
  addStep: (envelopeId: string, data: { signer_email: string; signer_name?: string; action?: string }) =>
    client().post<EnvelopeStep>(`/signatures/${envelopeId}/steps`, data),
  getSteps: (envelopeId: string) =>
    client().get<EnvelopeStep[]>(`/signatures/${envelopeId}/steps`),
  signStep: (envelopeId: string, stepId: string) =>
    client().post<EnvelopeStep>(`/signatures/${envelopeId}/steps/${stepId}/sign`),
  declineStep: (envelopeId: string, stepId: string, reason?: string) =>
    client().post<EnvelopeStep>(`/signatures/${envelopeId}/steps/${stepId}/decline`, { reason }),
  transitions: (envelopeId: string) =>
    client().get<EnvelopeTransition[]>(`/signatures/${envelopeId}/transitions`),
};

export const auditApi = {
  query: (params: { entity_type?: string; entity_id?: string; limit?: number }) =>
    client().get<AuditLogEntry[]>('/audit', { params }),
};
