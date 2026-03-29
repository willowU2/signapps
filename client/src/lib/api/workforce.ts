/**
 * Workforce API Module
 *
 * API client for organizational structure, employees, and coverage management.
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from './factory';
import type { AxiosRequestConfig } from 'axios';
import type {
  OrgNodeType,
  CreateOrgNodeType,
  UpdateOrgNodeType,
  OrgNode,
  OrgNodeWithStats,
  CreateOrgNode,
  UpdateOrgNode,
  MoveOrgNode,
  FunctionDefinition,
  CreateFunctionDefinition,
  UpdateFunctionDefinition,
  Employee,
  EmployeeWithDetails,
  CreateEmployee,
  UpdateEmployee,
  EmployeeQueryParams,
  CoverageTemplate,
  CreateCoverageTemplate,
  UpdateCoverageTemplate,
  CoverageRule,
  CreateCoverageRule,
  UpdateCoverageRule,
  EffectiveCoverage,
  ValidateCoverageRequest,
  ValidateCoverageResponse,
  LeaveSimulationRequest,
  LeaveSimulationResponse,
  ShiftChangeSimulationRequest,
  ShiftChangeSimulationResponse,
  OrgTreeQueryParams,
  BulkMoveNodesRequest,
  BulkMoveNodesResponse,
} from '@/types/workforce';

// Get the workforce service client (cached)
const workforceClient = getClient(ServiceName.WORKFORCE);

// ============================================================================
// Organization Node Types API
// ============================================================================

export const orgNodeTypesApi = {
  list: () =>
    workforceClient.get<OrgNodeType[]>('/workforce/org/node-types'),

  get: (id: string) =>
    workforceClient.get<OrgNodeType>(`/workforce/org/node-types/${id}`),

  create: (data: CreateOrgNodeType) =>
    workforceClient.post<OrgNodeType>('/workforce/org/node-types', data),

  update: (id: string, data: UpdateOrgNodeType) =>
    workforceClient.put<OrgNodeType>(`/workforce/org/node-types/${id}`, data),

  delete: (id: string) =>
    workforceClient.delete(`/workforce/org/node-types/${id}`),
};

// ============================================================================
// Organization Nodes (Tree) API
// ============================================================================

export const orgNodesApi = {
  // Tree operations
  getTree: (params?: OrgTreeQueryParams) =>
    workforceClient.get<OrgNodeWithStats[]>('/workforce/org/tree', { params }),

  getNode: (id: string) =>
    workforceClient.get<OrgNodeWithStats>(`/workforce/org/nodes/${id}`),

  getChildren: (id: string) =>
    workforceClient.get<OrgNodeWithStats[]>(`/workforce/org/nodes/${id}/children`),

  getAncestors: (id: string) =>
    workforceClient.get<OrgNode[]>(`/workforce/org/nodes/${id}/ancestors`),

  getDescendants: (id: string) =>
    workforceClient.get<OrgNode[]>(`/workforce/org/nodes/${id}/descendants`),

  // CRUD operations
  create: (data: CreateOrgNode) =>
    workforceClient.post<OrgNode>('/workforce/org/nodes', data),

  update: (id: string, data: UpdateOrgNode) =>
    workforceClient.put<OrgNode>(`/workforce/org/nodes/${id}`, data),

  delete: (id: string) =>
    workforceClient.delete(`/workforce/org/nodes/${id}`),

  // Move operations
  move: (id: string, data: MoveOrgNode) =>
    workforceClient.post<OrgNode>(`/workforce/org/nodes/${id}/move`, data),

  bulkMove: (data: BulkMoveNodesRequest) =>
    workforceClient.post<BulkMoveNodesResponse>('/workforce/org/nodes/bulk-move', data),

  // Activation
  activate: (id: string) =>
    workforceClient.post(`/workforce/org/nodes/${id}/activate`),

  deactivate: (id: string) =>
    workforceClient.post(`/workforce/org/nodes/${id}/deactivate`),
};

// ============================================================================
// Function Definitions API
// ============================================================================

export const functionDefsApi = {
  list: () =>
    workforceClient.get<FunctionDefinition[]>('/workforce/functions'),

  get: (id: string) =>
    workforceClient.get<FunctionDefinition>(`/workforce/functions/${id}`),

  create: (data: CreateFunctionDefinition) =>
    workforceClient.post<FunctionDefinition>('/workforce/functions', data),

  update: (id: string, data: UpdateFunctionDefinition) =>
    workforceClient.put<FunctionDefinition>(`/workforce/functions/${id}`, data),

  delete: (id: string) =>
    workforceClient.delete(`/workforce/functions/${id}`),
};

// ============================================================================
// Employees API
// ============================================================================

export const employeesApi = {
  list: (params?: EmployeeQueryParams) =>
    workforceClient.get<{ employees: EmployeeWithDetails[]; total: number }>('/workforce/employees', { params }),

  get: (id: string) =>
    workforceClient.get<EmployeeWithDetails>(`/workforce/employees/${id}`),

  create: (data: CreateEmployee) =>
    workforceClient.post<Employee>('/workforce/employees', data),

  update: (id: string, data: UpdateEmployee) =>
    workforceClient.put<Employee>(`/workforce/employees/${id}`, data),

  delete: (id: string) =>
    workforceClient.delete(`/workforce/employees/${id}`),

  // Bulk operations
  bulkAssignFunction: (employeeIds: string[], functionCode: string) =>
    workforceClient.post('/workforce/employees/bulk/assign-function', { employee_ids: employeeIds, function_code: functionCode }),

  bulkMove: (employeeIds: string[], orgNodeId: string) =>
    workforceClient.post('/workforce/employees/bulk/move', { employee_ids: employeeIds, org_node_id: orgNodeId }),

  // Search
  search: (query: string) =>
    workforceClient.get<EmployeeWithDetails[]>('/workforce/employees/search', { params: { q: query } }),

  // By org node
  listByOrgNode: (orgNodeId: string, includeDescendants?: boolean) =>
    workforceClient.get<EmployeeWithDetails[]>(`/workforce/employees/by-node/${orgNodeId}`, {
      params: { include_descendants: includeDescendants },
    }),
};

// ============================================================================
// Coverage Templates API
// ============================================================================

export const coverageTemplatesApi = {
  list: () =>
    workforceClient.get<CoverageTemplate[]>('/workforce/coverage/templates'),

  get: (id: string) =>
    workforceClient.get<CoverageTemplate>(`/workforce/coverage/templates/${id}`),

  create: (data: CreateCoverageTemplate) =>
    workforceClient.post<CoverageTemplate>('/workforce/coverage/templates', data),

  update: (id: string, data: UpdateCoverageTemplate) =>
    workforceClient.put<CoverageTemplate>(`/workforce/coverage/templates/${id}`, data),

  delete: (id: string) =>
    workforceClient.delete(`/workforce/coverage/templates/${id}`),

  setDefault: (id: string) =>
    workforceClient.post(`/workforce/coverage/templates/${id}/set-default`),

  duplicate: (id: string, name: string) =>
    workforceClient.post<CoverageTemplate>(`/workforce/coverage/templates/${id}/duplicate`, { name }),
};

// ============================================================================
// Coverage Rules API
// ============================================================================

export const coverageRulesApi = {
  list: (orgNodeId?: string) =>
    workforceClient.get<CoverageRule[]>('/workforce/coverage/rules', { params: { org_node_id: orgNodeId } }),

  get: (id: string) =>
    workforceClient.get<CoverageRule>(`/workforce/coverage/rules/${id}`),

  create: (data: CreateCoverageRule) =>
    workforceClient.post<CoverageRule>('/workforce/coverage/rules', data),

  update: (id: string, data: UpdateCoverageRule) =>
    workforceClient.put<CoverageRule>(`/workforce/coverage/rules/${id}`, data),

  delete: (id: string) =>
    workforceClient.delete(`/workforce/coverage/rules/${id}`),

  // Effective coverage (considering inheritance)
  getEffective: (orgNodeId: string, date?: string) =>
    workforceClient.get<EffectiveCoverage>(`/workforce/coverage/effective/${orgNodeId}`, { params: { date } }),
};

// ============================================================================
// Validation API
// ============================================================================

export const validationApi = {
  validateCoverage: (data: ValidateCoverageRequest) =>
    workforceClient.post<ValidateCoverageResponse>('/workforce/validation/coverage', data),

  simulateLeave: (data: LeaveSimulationRequest) =>
    workforceClient.post<LeaveSimulationResponse>('/workforce/validation/leave-simulation', data),

  simulateShiftChange: (data: ShiftChangeSimulationRequest) =>
    workforceClient.post<ShiftChangeSimulationResponse>('/workforce/validation/shift-simulation', data),

  // Quick validation (single org node, current date)
  quickValidate: (orgNodeId: string) =>
    workforceClient.get<ValidateCoverageResponse>(`/workforce/validation/quick/${orgNodeId}`),
};

// ============================================================================
// Combined Export
// ============================================================================

// ============================================================================
// Learning API — /api/v1/learning/*
// ============================================================================

export interface Course {
  id: string;
  title: string;
  description: string;
  modules: unknown; // JSON array of module objects
  created_by: string;
  created_at: string;
}

export interface CourseProgress {
  id: string;
  course_id: string;
  user_id: string;
  module_completions: unknown;
  progress: number;
  status: string;
  updated_at: string;
}

export interface UpdateProgressRequest {
  module_completions: unknown;
  progress: number;
  status?: string;
}

export const learningApi = {
  listCourses: () =>
    workforceClient.get<{ courses: (Course & { user_progress?: CourseProgress })[] }>('/learning/courses'),
  getCourse: (id: string) =>
    workforceClient.get<Course & { user_progress?: CourseProgress }>(`/learning/courses/${id}`),
  updateProgress: (courseId: string, data: UpdateProgressRequest) =>
    workforceClient.put<CourseProgress>(`/learning/courses/${courseId}/progress`, data),
};

export const workforceApi = {
  nodeTypes: orgNodeTypesApi,
  nodes: orgNodesApi,
  functions: functionDefsApi,
  employees: employeesApi,
  templates: coverageTemplatesApi,
  rules: coverageRulesApi,
  validation: validationApi,
  learning: learningApi,

  // Raw HTTP access for custom endpoints
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    workforceClient.get<T>(url, config),

  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    workforceClient.post<T>(url, data, config),

  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    workforceClient.put<T>(url, data, config),

  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    workforceClient.delete<T>(url, config),
};
