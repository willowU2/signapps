/**
 * Validation API Module
 *
 * CRUD for design validation rules + document checking.
 * Uses the docs service (port 3010).
 *
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.DOCS);

// ============================================================================
// Types
// ============================================================================

/** A configurable validation rule for design compliance. */
export interface ValidationRule {
  id: string;
  tenant_id: string;
  name: string;
  /** Rule category (e.g. min_font_size, allowed_fonts). */
  rule_type: string;
  /** Rule-specific configuration (JSON object). */
  config: Record<string, unknown>;
  /** Severity: error, warning, info. */
  severity: string;
  /** Whether the rule is currently active. */
  is_active: boolean;
  /** Document types this rule applies to. */
  applies_to: string[];
  created_at: string;
}

/** A validation issue found when checking a document. */
export interface ValidationIssue {
  rule_name: string;
  rule_type: string;
  severity: string;
  message: string;
  element_path: string | null;
}

/** Payload for creating a new validation rule. */
export interface CreateValidationRulePayload {
  name: string;
  rule_type: string;
  config: Record<string, unknown>;
  severity?: string;
  applies_to?: string[];
}

/** Payload for updating an existing validation rule. */
export interface UpdateValidationRulePayload {
  name?: string;
  config?: Record<string, unknown>;
  severity?: string;
  is_active?: boolean;
  applies_to?: string[];
}

/** Payload for the document check endpoint. */
export interface CheckDocumentPayload {
  document: Record<string, unknown>;
  doc_type: string;
}

/** Response from the check endpoint. */
export interface CheckDocumentResult {
  data: ValidationIssue[];
  count: number;
}

// ============================================================================
// API functions
// ============================================================================

/** List validation rules for the current tenant. */
export async function listValidationRules(
  activeOnly = false,
): Promise<ValidationRule[]> {
  const { data } = await client.get<{ data: ValidationRule[] }>(
    "/validation/rules",
    { params: { active_only: activeOnly } },
  );
  return data.data;
}

/** Create a new validation rule. */
export async function createValidationRule(
  payload: CreateValidationRulePayload,
): Promise<ValidationRule> {
  const { data } = await client.post<{ data: ValidationRule }>(
    "/validation/rules",
    payload,
  );
  return data.data;
}

/** Update an existing validation rule. */
export async function updateValidationRule(
  id: string,
  payload: UpdateValidationRulePayload,
): Promise<ValidationRule> {
  const { data } = await client.put<{ data: ValidationRule }>(
    `/validation/rules/${id}`,
    payload,
  );
  return data.data;
}

/** Delete a validation rule. */
export async function deleteValidationRule(id: string): Promise<void> {
  await client.delete(`/validation/rules/${id}`);
}

/** Validate a document against active tenant rules. */
export async function checkDocument(
  payload: CheckDocumentPayload,
): Promise<CheckDocumentResult> {
  const { data } = await client.post<CheckDocumentResult>(
    "/validation/check",
    payload,
  );
  return data;
}
