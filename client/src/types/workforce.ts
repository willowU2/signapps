//! Workforce domain types
//!
//! Types for organizational structure, employees, and coverage management.

// ============================================================================
// Organization Node Types
// ============================================================================

export interface OrgNodeType {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  icon?: string;
  color?: string;
  allowed_children: string[];
  config_schema?: Record<string, unknown>;
  sort_order: number;
  created_at: string;
}

export interface CreateOrgNodeType {
  code: string;
  name: string;
  icon?: string;
  color?: string;
  allowed_children?: string[];
  config_schema?: Record<string, unknown>;
  sort_order?: number;
}

export interface UpdateOrgNodeType {
  name?: string;
  icon?: string;
  color?: string;
  allowed_children?: string[];
  config_schema?: Record<string, unknown>;
  sort_order?: number;
}

// ============================================================================
// Organization Nodes
// ============================================================================

export interface OrgNode {
  id: string;
  tenant_id: string;
  parent_id?: string;
  node_type: string;
  name: string;
  code?: string;
  description?: string;
  config: Record<string, unknown>;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrgNodeWithStats extends OrgNode {
  descendant_count: number;
  employee_count: number;
  ancestor_path: string[];
  children?: OrgNodeWithStats[];
}

export interface CreateOrgNode {
  parent_id?: string;
  node_type: string;
  name: string;
  code?: string;
  description?: string;
  config?: Record<string, unknown>;
  sort_order?: number;
}

export interface UpdateOrgNode {
  name?: string;
  code?: string;
  description?: string;
  config?: Record<string, unknown>;
  sort_order?: number;
  is_active?: boolean;
}

export interface MoveOrgNode {
  new_parent_id?: string;
  before_sibling_id?: string;
}

// ============================================================================
// Function Definitions (Job roles/positions)
// ============================================================================

export interface FunctionDefinition {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface CreateFunctionDefinition {
  code: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
}

export interface UpdateFunctionDefinition {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
}

// ============================================================================
// Employees
// ============================================================================

export type EmployeeStatus = "active" | "on_leave" | "suspended" | "terminated";

export type ContractType =
  | "full-time"
  | "part-time"
  | "contract"
  | "intern"
  | "temporary";

export interface Employee {
  id: string;
  tenant_id: string;
  user_id?: string;
  org_node_id: string;
  employee_number?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  functions: string[]; // Function codes
  contract_type: ContractType;
  fte_ratio: number; // 0.00 - 1.00
  hire_date?: string;
  termination_date?: string;
  status: EmployeeStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EmployeeWithDetails extends Employee {
  org_node_name: string;
  function_names: string[];
  user_email?: string;
}

export interface CreateEmployee {
  user_id?: string;
  org_node_id: string;
  employee_number?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  functions?: string[];
  contract_type?: ContractType;
  fte_ratio?: number;
  hire_date?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateEmployee {
  org_node_id?: string;
  employee_number?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  functions?: string[];
  contract_type?: ContractType;
  fte_ratio?: number;
  hire_date?: string;
  termination_date?: string;
  status?: EmployeeStatus;
  metadata?: Record<string, unknown>;
}

export interface EmployeeQueryParams {
  org_node_id?: string;
  include_descendants?: boolean;
  status?: EmployeeStatus;
  contract_type?: ContractType;
  function?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

// ============================================================================
// Coverage Templates
// ============================================================================

export interface CoverageSlot {
  day_of_week: number; // 0=Sunday, 6=Saturday
  start_time: string; // "HH:MM"
  end_time: string;
  min_employees: number;
  max_employees?: number;
  required_functions: string[];
  label?: string;
}

export interface WeeklyPattern {
  monday: CoverageSlot[];
  tuesday: CoverageSlot[];
  wednesday: CoverageSlot[];
  thursday: CoverageSlot[];
  friday: CoverageSlot[];
  saturday: CoverageSlot[];
  sunday: CoverageSlot[];
}

export interface CoverageTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  weekly_pattern: WeeklyPattern;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCoverageTemplate {
  name: string;
  description?: string;
  weekly_pattern: WeeklyPattern;
  is_default?: boolean;
}

export interface UpdateCoverageTemplate {
  name?: string;
  description?: string;
  weekly_pattern?: WeeklyPattern;
  is_default?: boolean;
}

// ============================================================================
// Coverage Rules
// ============================================================================

export interface CoverageRule {
  id: string;
  tenant_id: string;
  org_node_id: string;
  template_id?: string;
  name: string;
  valid_from: string; // YYYY-MM-DD
  valid_to?: string;
  custom_slots?: unknown; // Raw JSON when not using template
  inherit_from_parent: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCoverageRule {
  org_node_id: string;
  template_id?: string;
  name: string;
  valid_from: string;
  valid_to?: string;
  custom_slots?: unknown;
  inherit_from_parent?: boolean;
}

export interface UpdateCoverageRule {
  template_id?: string;
  name?: string;
  valid_from?: string;
  valid_to?: string;
  custom_slots?: unknown;
  inherit_from_parent?: boolean;
  is_active?: boolean;
}

export interface EffectiveCoverage {
  org_node_id: string;
  org_node_name: string;
  rule?: CoverageRule;
  template?: CoverageTemplate;
  effective_slots: CoverageSlot[];
  inherited_from?: string;
  effective_date: string;
}

// ============================================================================
// Validation & Gap Analysis
// ============================================================================

export type GapSeverity = "critical" | "high" | "medium" | "low";

export interface CoverageGap {
  start_time: string;
  end_time: string;
  day_of_week: number;
  required_employees: number;
  assigned_employees: number;
  missing_functions: string[];
  severity: GapSeverity;
  slot_label?: string;
}

export interface ValidationSummary {
  total_slots: number;
  covered_slots: number;
  gap_count: number;
  overstaffed_count: number;
  coverage_percentage: number;
  critical_gaps: number;
  high_gaps: number;
  medium_gaps: number;
  low_gaps: number;
}

export interface ValidateCoverageRequest {
  org_node_id: string;
  date_from: string;
  date_to: string;
  include_descendants?: boolean;
}

export interface ValidateCoverageResponse {
  org_node_id: string;
  date_from: string;
  date_to: string;
  gaps: CoverageGap[];
  summary: ValidationSummary;
}

export type ConflictType =
  | "overlap"
  | "rest_time_violation"
  | "max_hours_exceeded"
  | "function_mismatch";

export interface ScheduleConflict {
  employee_id: string;
  employee_name: string;
  conflict_type: ConflictType;
  shift1_start?: string;
  shift1_end?: string;
  shift2_start?: string;
  shift2_end?: string;
  message: string;
}

export interface LeaveSimulationRequest {
  employee_id: string;
  date_from: string;
  date_to: string;
}

export interface LeaveSimulationResponse {
  employee_id: string;
  date_from: string;
  date_to: string;
  affected_slots: CoverageSlot[];
  resulting_gaps: CoverageGap[];
  can_approve: boolean;
  warnings: string[];
}

export interface ShiftChangeSimulationRequest {
  employee_id: string;
  current_shift: {
    date: string;
    start_time: string;
    end_time: string;
  };
  new_shift: {
    date: string;
    start_time: string;
    end_time: string;
  };
  reason?: string;
}

export interface ShiftChangeSimulationResponse {
  employee_id: string;
  is_valid: boolean;
  conflicts: ScheduleConflict[];
  coverage_impact: {
    old_slot_coverage: number;
    new_slot_coverage: number;
  };
  warnings: string[];
}

// ============================================================================
// Tree Operations
// ============================================================================

export interface OrgTreeQueryParams {
  root_id?: string;
  max_depth?: number;
  include_inactive?: boolean;
  include_employees?: boolean;
}

export interface BulkMoveNodesRequest {
  node_ids: string[];
  new_parent_id?: string;
}

export interface BulkMoveNodesResponse {
  moved_count: number;
  failed_ids: string[];
  errors: string[];
}
