/**
 * Org Structure Types
 *
 * Types for the Enterprise Org Structure feature.
 */

export type PersonRoleType = 'employee' | 'client_contact' | 'supplier_contact' | 'partner';
export type TreeType = 'internal' | 'clients' | 'suppliers';
export type AssignmentType = 'holder' | 'interim' | 'deputy' | 'intern' | 'contractor';
export type ResponsibilityType = 'hierarchical' | 'functional' | 'matrix';
export type SiteType = 'campus' | 'building' | 'floor' | 'room';

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
  tree_id: string;
  parent_id?: string;
  node_type: string;
  name: string;
  code?: string;
  description?: string;
  config: Record<string, unknown>;
  sort_order: number;
  is_active: boolean;
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
