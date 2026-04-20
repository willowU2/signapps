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
  | "governance"
  | "custom";

export interface GovernancePolicySettings {
  board_required?: boolean;
  min_members?: number;
  max_members?: number;
  required_roles?: string[];
  optional_roles?: string[];
}

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

export interface BoardSummary {
  node_id: string;
  board_id: string;
  decision_maker_person_id?: string;
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

// ═════════════════════════════════════════════════════════════════════
// SO1 foundations — 2026-04-19
// ═════════════════════════════════════════════════════════════════════

/** Canonical axis for org_assignments (matches backend enum). */
export type OrgAxis = "structure" | "focus" | "group";

/** `signapps-db::models::org::Position`. */
export interface OrgPosition {
  id: string;
  tenant_id: string;
  node_id: string;
  title: string;
  head_count: number;
  attributes: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** PositionWithOccupancy DTO : Position + filled/vacant counters. */
export interface OrgPositionWithOccupancy extends OrgPosition {
  filled: number;
  vacant: number;
}

/** `signapps-db::models::org::PositionIncumbent`. */
export interface OrgPositionIncumbent {
  id: string;
  tenant_id: string;
  position_id: string;
  person_id: string;
  start_date: string;
  end_date?: string | null;
  active: boolean;
  created_at: string;
}

/** SO1 scope for org_delegations. */
export type OrgDelegationScope = "manager" | "rbac" | "all";

/** `signapps-db::models::org::Delegation` (SO1). */
export interface OrgDelegationV2 {
  id: string;
  tenant_id: string;
  delegator_person_id: string;
  delegate_person_id: string;
  node_id?: string | null;
  scope: OrgDelegationScope;
  start_at: string;
  end_at: string;
  reason?: string | null;
  active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

/** `signapps-db::models::org::AuditLogEntry`. */
export interface OrgAuditLogEntry {
  id: number;
  tenant_id: string;
  actor_user_id?: string | null;
  entity_type: string;
  entity_id: string;
  action: "insert" | "update" | "delete";
  diff_json: Record<string, unknown>;
  at: string;
}

/** Response of `/api/v1/org/assignments/axes/summary`. */
export interface OrgAxesSummary {
  counts: { structure: number; focus: number; group: number };
  focus_nodes: Array<{ id: string; name: string; slug: string | null }>;
  group_nodes: Array<{ id: string; name: string; slug: string | null }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// SO7 — groupes transverses & sites physiques
// ═══════════════════════════════════════════════════════════════════════════

/** Kind canonique d'un groupe transverse. */
export type OrgGroupKind = "static" | "dynamic" | "hybrid" | "derived";

/** `org_groups` row. */
export interface OrgGroupRecord {
  id: string;
  tenant_id: string;
  slug: string;
  name: string;
  description?: string | null;
  kind: OrgGroupKind;
  rule_json?: Record<string, unknown> | null;
  source_node_id?: string | null;
  attributes: Record<string, unknown>;
  archived: boolean;
  created_by_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

/** `org_group_members` row. */
export interface OrgGroupMembership {
  group_id: string;
  person_id: string;
  kind: "include" | "exclude";
  created_at: string;
}

/** Response of `GET /api/v1/org/groups/:id/members`. */
export interface OrgGroupMembersResponse {
  group_id: string;
  kind: OrgGroupKind;
  persons: Person[];
  memberships: OrgGroupMembership[];
}

/** Kind canonique d'un site. */
export type OrgSiteKind = "building" | "floor" | "room" | "desk";

/** `org_sites` row. */
export interface OrgSiteRecord {
  id: string;
  tenant_id: string;
  parent_id?: string | null;
  slug: string;
  name: string;
  kind: OrgSiteKind;
  address?: string | null;
  gps?: { lat: number; lng: number } | null;
  timezone?: string | null;
  capacity?: number | null;
  equipment: Record<string, unknown>;
  bookable: boolean;
  active: boolean;
  attributes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** `org_site_persons` row. */
export interface OrgSitePersonLink {
  id: string;
  person_id: string;
  site_id: string;
  desk_id?: string | null;
  role: "primary" | "secondary";
  valid_from: string;
  valid_until?: string | null;
  created_at: string;
}

/** Response of `GET /api/v1/org/sites/:id/persons`. */
export interface OrgSitePersonsResponse {
  assignments: OrgSitePersonLink[];
  persons: Person[];
}

/** `org_site_bookings` row. */
export interface OrgSiteBookingRecord {
  id: string;
  site_id: string;
  person_id: string;
  start_at: string;
  end_at: string;
  purpose?: string | null;
  status: "confirmed" | "tentative" | "cancelled";
  meet_room_id?: string | null;
  created_at: string;
  updated_at: string;
}

/** One 30-minute slot returned by `/availability`. */
export interface OrgAvailabilitySlot {
  start_at: string;
  end_at: string;
  available: boolean;
}

/** Response of `GET /api/v1/org/sites/:id/availability`. */
export interface OrgAvailabilityResponse {
  site_id: string;
  day: string;
  slot_minutes: number;
  slots: OrgAvailabilitySlot[];
}

/** One bucket of the occupancy heatmap. */
export interface OrgOccupancyBucket {
  key: string;
  count: number;
}

/** Response of `GET /api/v1/org/sites/:id/occupancy`. */
export interface OrgOccupancyResponse {
  site_id: string;
  granularity: "day" | "hour";
  capacity?: number | null;
  buckets: OrgOccupancyBucket[];
}

// ═══════════════════════════════════════════════════════════════════════════
// SO8 — catalogue unifié de ressources tangibles
// ═══════════════════════════════════════════════════════════════════════════

/** Taxonomie fermée des ressources gérées. */
export type ResourceKind =
  | "it_device"
  | "vehicle"
  | "key_physical"
  | "badge"
  | "av_equipment"
  | "furniture"
  | "mobile_phone"
  | "license_software"
  | "other";

/** Cycle de vie d'une ressource. */
export type ResourceStatus =
  | "ordered"
  | "active"
  | "loaned"
  | "in_maintenance"
  | "returned"
  | "retired";

/** `org_resources` row. */
export interface Resource {
  id: string;
  tenant_id: string;
  kind: ResourceKind;
  slug: string;
  name: string;
  description?: string | null;
  serial_or_ref?: string | null;
  attributes: Record<string, unknown>;
  status: ResourceStatus;
  assigned_to_person_id?: string | null;
  assigned_to_node_id?: string | null;
  primary_site_id?: string | null;
  purchase_date?: string | null;
  purchase_cost_cents?: number | null;
  currency?: string | null;
  amortization_months?: number | null;
  warranty_end_date?: string | null;
  next_maintenance_date?: string | null;
  qr_token?: string | null;
  /** SO9 — hero photo URL (uploaded via /org/resources/:id/photo). */
  photo_url?: string | null;
  /** SO9 — type de l'identifiant primaire. */
  primary_identifier_type?: ResourcePrimaryIdentifierType;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

/** SO9 — Type de l'identifiant primaire d'une ressource. */
export type ResourcePrimaryIdentifierType =
  | "serial"
  | "plate"
  | "vin"
  | "license_key"
  | "badge_number"
  | "key_number"
  | "none";

/** Append-only status log entry. */
export interface ResourceStatusLog {
  id: number;
  resource_id: string;
  from_status?: ResourceStatus | null;
  to_status: ResourceStatus;
  actor_user_id?: string | null;
  reason?: string | null;
  at: string;
}

/** Response of `GET /org/resources/counts`. */
export interface ResourceCountsResponse {
  buckets: Array<{ kind: string; count: number }>;
  total: number;
}

/** Response of `GET /me/inventory`. */
export interface InventoryResponse {
  by_kind: Array<{ kind: string; resources: Resource[] }>;
  total: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// SO9 — multi-assign + ACL universelle + renouvellements
// ═══════════════════════════════════════════════════════════════════════════

/** Type de sujet d'un `org_resource_assignments` row. */
export type AssignmentSubjectType = "person" | "node" | "group" | "site";

/** Rôle dans un assignment. */
export type AssignmentRole =
  | "owner"
  | "primary_user"
  | "secondary_user"
  | "caretaker"
  | "maintainer";

/** `org_resource_assignments` row. */
export interface ResourceAssignment {
  id: string;
  tenant_id: string;
  resource_id: string;
  subject_type: AssignmentSubjectType;
  subject_id: string;
  role: AssignmentRole;
  is_primary: boolean;
  start_at: string;
  end_at?: string | null;
  reason?: string | null;
  created_by_user_id?: string | null;
  created_at: string;
}

/** Type de sujet ACL. */
export type AclSubjectType =
  | "person"
  | "group"
  | "role"
  | "everyone"
  | "auth_user";

/** Effet ACL. */
export type AclEffect = "allow" | "deny";

/** Action ACL (valeur reconnues côté resolver). */
export type AclAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "list"
  | "assign"
  | "unassign"
  | "transition"
  | "renew"
  | "*";

/** `org_acl` row. */
export interface Acl {
  id: string;
  tenant_id: string;
  subject_type: AclSubjectType;
  subject_id?: string | null;
  subject_ref?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  effect: AclEffect;
  reason?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  created_by_user_id?: string | null;
  created_at: string;
}

/** Type de renouvellement. */
export type RenewalKind =
  | "warranty_end"
  | "license_expiry"
  | "badge_validity"
  | "insurance_expiry"
  | "technical_inspection"
  | "maintenance_due"
  | "battery_replacement"
  | "key_rotation"
  | "custom";

/** Statut d'un renouvellement. */
export type RenewalStatus =
  | "pending"
  | "snoozed"
  | "renewed"
  | "escalated"
  | "cancelled";

/** `org_resource_renewals` row. */
export interface ResourceRenewal {
  id: string;
  tenant_id: string;
  resource_id: string;
  kind: RenewalKind;
  due_date: string;
  grace_period_days: number;
  status: RenewalStatus;
  last_reminded_at?: string | null;
  snoozed_until?: string | null;
  renewed_at?: string | null;
  renewed_by_user_id?: string | null;
  renewal_notes?: string | null;
  created_at: string;
  updated_at: string;
}

/** Matched rule returned by `POST /org/acl/test`. */
export interface MatchedRule {
  source: "acl" | "inherited_from_assignment" | "global_admin";
  acl_id?: string | null;
  subject_type?: string | null;
  role?: string | null;
  effect: AclEffect;
  reason: string;
}

/** `POST /org/acl/test` response. */
export interface TestAclResponse {
  effect: AclEffect;
  source: string;
  matched_acls: MatchedRule[];
  inherited_reasons: MatchedRule[];
}
