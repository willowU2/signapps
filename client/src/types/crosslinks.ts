export interface EntityReference {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  relation: string;
  created_by?: string;
  created_at: string;
}

export interface Activity {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_title?: string;
  metadata: Record<string, unknown>;
  workspace_id?: string;
  created_at: string;
}

export interface SignatureEnvelope {
  id: string;
  title: string;
  document_id: string;
  created_by: string;
  status:
    | "draft"
    | "sent"
    | "in_progress"
    | "completed"
    | "declined"
    | "expired"
    | "voided";
  expires_at?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EnvelopeStep {
  id: string;
  envelope_id: string;
  step_order: number;
  signer_email: string;
  signer_user_id?: string;
  signer_name?: string;
  action: "sign" | "approve" | "witness" | "acknowledge" | "delegate";
  status:
    | "pending"
    | "notified"
    | "viewed"
    | "signed"
    | "declined"
    | "delegated"
    | "expired";
  signed_at?: string;
  signature_hash?: string;
  decline_reason?: string;
  created_at: string;
}

export interface EnvelopeTransition {
  id: string;
  envelope_id: string;
  step_id?: string;
  from_status: string;
  to_status: string;
  triggered_by?: string;
  reason?: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id?: string;
  actor_ip?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  changes?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  workspace_id?: string;
  created_at: string;
}
