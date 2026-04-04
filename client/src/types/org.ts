/**
 * Org Structure Types
 *
 * Types for the Enterprise Org Structure feature.
 */

export type PersonRoleType =
  | "employee"
  | "client_contact"
  | "supplier_contact"
  | "partner";
export type TreeType = "internal" | "clients" | "suppliers";
export type AssignmentType =
  | "holder"
  | "interim"
  | "deputy"
  | "intern"
  | "contractor";
export type ResponsibilityType = "hierarchical" | "functional" | "matrix";
export type SiteType = "campus" | "building" | "floor" | "room";

export interface Person {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  user_id?: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PersonRole {
  id: string;
  person_id: string;
  role_type: PersonRoleType;
  metadata: Record<string, unknown>;
  is_active: boolean;
}

export interface OrgTree {
  id: string;
  tenant_id: string;
  tree_type: TreeType;
  name: string;
  root_node_id?: string;
}

export interface OrgNode {
  id: string;
  tenant_id?: string;
  parent_id?: string;
  node_type: string;
  name: string;
  code?: string;
  description?: string;
  config: Record<string, unknown>;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Assignment {
  id: string;
  person_id: string;
  node_id: string;
  assignment_type: AssignmentType;
  responsibility_type: ResponsibilityType;
  start_date: string;
  end_date?: string;
  fte_ratio: number;
  is_primary: boolean;
}

export interface AssignmentHistory {
  id: string;
  assignment_id: string;
  action: string;
  changed_by?: string;
  changes: Record<string, unknown>;
  reason?: string;
  effective_date: string;
  created_at: string;
}

export interface Site {
  id: string;
  tenant_id: string;
  parent_id?: string;
  site_type: SiteType;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  geo_lat?: number;
  geo_lng?: number;
  timezone: string;
  capacity?: number;
  is_active: boolean;
}

export interface PermissionProfile {
  id: string;
  node_id: string;
  inherit: boolean;
  modules: Record<string, boolean>;
  max_role: string;
  custom_permissions: Record<string, unknown>;
}

export interface OrgContext {
  person_id?: string;
  active_assignments: Array<{
    assignment_id: string;
    node_id: string;
    node_name: string;
    node_type: string;
    assignment_type: string;
    responsibility_type: string;
  }>;
  org_group_ids: string[];
  effective_modules: Record<string, boolean>;
  max_role: string;
}

export interface OrgChartNode {
  node: OrgNode;
  assignments: Array<Assignment & { person?: Person }>;
  children: OrgChartNode[];
}

// ── Group Types ──────────────────────────────────────────
export type GroupType = "static" | "dynamic" | "derived" | "hybrid";

export interface OrgGroup {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  group_type: GroupType;
  filter?: Record<string, unknown>;
  managed_by?: string;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
  attributes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrgGroupMember {
  id: string;
  group_id: string;
  member_type: "person" | "group" | "node";
  member_id: string;
  is_manual_override: boolean;
  created_at: string;
}

export interface OrgMemberOf {
  person_id: string;
  group_id: string;
  source: "direct" | "nested_group" | "node";
  computed_at: string;
}

// ── Policy Types ─────────────────────────────────────────
export type PolicyDomain =
  | "security"
  | "modules"
  | "naming"
  | "delegation"
  | "compliance"
  | "custom";

export interface OrgPolicy {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  domain: PolicyDomain;
  priority: number;
  is_enforced: boolean;
  is_disabled: boolean;
  settings: Record<string, unknown>;
  version: number;
  attributes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrgPolicyLink {
  id: string;
  policy_id: string;
  link_type: "node" | "group" | "site" | "country" | "global";
  link_id: string;
  is_blocked: boolean;
  created_at: string;
}

export interface PolicySource {
  key: string;
  value: unknown;
  policy_id: string;
  policy_name: string;
  link_type: string;
  via: string;
}

export interface EffectivePolicy {
  settings: Record<string, unknown>;
  sources: PolicySource[];
}

// ── Delegation Types ─────────────────────────────────────
export interface OrgDelegation {
  id: string;
  tenant_id: string;
  delegator_id: string;
  delegate_type: "person" | "group";
  delegate_id: string;
  scope_node_id: string;
  permissions: Record<string, boolean>;
  depth: number;
  parent_delegation_id?: string;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
}

// ── Audit Types ──────────────────────────────────────────
export interface OrgAuditEntry {
  id: string;
  tenant_id: string;
  actor_id: string;
  actor_type: "user" | "system" | "trigger";
  action: string;
  entity_type: string;
  entity_id: string;
  changes: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Site Assignment ──────────────────────────────────────
export interface SiteAssignment {
  id: string;
  site_id: string;
  assignee_type: "person" | "node";
  assignee_id: string;
  is_primary: boolean;
  schedule?: Record<string, unknown>;
  created_at: string;
}

// ── Board Types ──────────────────────────────────────────

export interface OrgBoard {
  id: string;
  node_id: string;
  created_at: string;
  updated_at: string;
}

export interface OrgBoardMember {
  id: string;
  board_id: string;
  person_id: string;
  role: string;
  is_decision_maker: boolean;
  sort_order: number;
  start_date?: string;
  end_date?: string;
  created_at: string;
}

export interface EffectiveBoard {
  board: OrgBoard;
  members: OrgBoardMember[];
  inherited_from_node_id?: string;
  inherited_from_node_name?: string;
}

// ── Node Type ────────────────────────────────────────────
export interface OrgNodeType {
  id: string;
  tenant_id: string;
  tree_type: TreeType;
  name: string;
  label: string;
  color?: string;
  icon?: string;
  sort_order: number;
  allowed_children?: string[];
  schema: Record<string, unknown>;
  is_active: boolean;
}
