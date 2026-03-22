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
    workforceClient.get<OrgNodeType[]>('/org/node-types'),

  get: (id: string) =>
    workforceClient.get<OrgNodeType>(`/org/node-types/${id}`),

  create: (data: CreateOrgNodeType) =>
    workforceClient.post<OrgNodeType>('/org/node-types', data),

  update: (id: string, data: UpdateOrgNodeType) =>
    workforceClient.put<OrgNodeType>(`/org/node-types/${id}`, data),

  delete: (id: string) =>
    workforceClient.delete(`/org/node-types/${id}`),
};

// ============================================================================
// Organization Nodes (Tree) API
// ============================================================================

export const orgNodesApi = {
  // Tree operations
  getTree: (params?: OrgTreeQueryParams) =>
    workforceClient.get<OrgNodeWithStats[]>('/org/nodes/tree', { params }),

  getNode: (id: string) =>
    workforceClient.get<OrgNodeWithStats>(`/org/nodes/${id}`),

  getChildren: (id: string) =>
    workforceClient.get<OrgNodeWithStats[]>(`/org/nodes/${id}/children`),

  getAncestors: (id: string) =>
    workforceClient.get<OrgNode[]>(`/org/nodes/${id}/ancestors`),

  getDescendants: (id: string) =>
    workforceClient.get<OrgNode[]>(`/org/nodes/${id}/descendants`),

  // CRUD operations
  create: (data: CreateOrgNode) =>
    workforceClient.post<OrgNode>('/org/nodes', data),

  update: (id: string, data: UpdateOrgNode) =>
    workforceClient.put<OrgNode>(`/org/nodes/${id}`, data),

  delete: (id: string) =>
    workforceClient.delete(`/org/nodes/${id}`),

  // Move operations
  move: (id: string, data: MoveOrgNode) =>
    workforceClient.post<OrgNode>(`/org/nodes/${id}/move`, data),

  bulkMove: (data: BulkMoveNodesRequest) =>
    workforceClient.post<BulkMoveNodesResponse>('/org/nodes/bulk-move', data),

  // Activation
  activate: (id: string) =>
    workforceClient.post(`/org/nodes/${id}/activate`),

  deactivate: (id: string) =>
    workforceClient.post(`/org/nodes/${id}/deactivate`),
};

// ============================================================================
// Function Definitions API
// ============================================================================

export const functionDefsApi = {
  list: () =>
    workforceClient.get<FunctionDefinition[]>('/functions'),

  get: (id: string) =>
    workforceClient.get<FunctionDefinition>(`/functions/${id}`),

  create: (data: CreateFunctionDefinition) =>
    workforceClient.post<FunctionDefinition>('/functions', data),

  update: (id: string, data: UpdateFunctionDefinition) =>
    workforceClient.put<FunctionDefinition>(`/functions/${id}`, data),

  delete: (id: string) =>
    workforceClient.delete(`/functions/${id}`),
};

// ============================================================================
// Employees API
// ============================================================================

export const employeesApi = {
  list: (params?: EmployeeQueryParams) =>
    workforceClient.get<{ employees: EmployeeWithDetails[]; total: number }>('/employees', { params }),

  get: (id: string) =>
    workforceClient.get<EmployeeWithDetails>(`/employees/${id}`),

  create: (data: CreateEmployee) =>
    workforceClient.post<Employee>('/employees', data),

  update: (id: string, data: UpdateEmployee) =>
    workforceClient.put<Employee>(`/employees/${id}`, data),

  delete: (id: string) =>
    workforceClient.delete(`/employees/${id}`),

  // Bulk operations
  bulkAssignFunction: (employeeIds: string[], functionCode: string) =>
    workforceClient.post('/employees/bulk/assign-function', { employee_ids: employeeIds, function_code: functionCode }),

  bulkMove: (employeeIds: string[], orgNodeId: string) =>
    workforceClient.post('/employees/bulk/move', { employee_ids: employeeIds, org_node_id: orgNodeId }),

  // Search
  search: (query: string) =>
    workforceClient.get<EmployeeWithDetails[]>('/employees/search', { params: { q: query } }),

  // By org node
  listByOrgNode: (orgNodeId: string, includeDescendants?: boolean) =>
    workforceClient.get<EmployeeWithDetails[]>(`/org/nodes/${orgNodeId}/employees`, {
      params: { include_descendants: includeDescendants },
    }),
};

// ============================================================================
// Coverage Templates API
// ============================================================================

export const coverageTemplatesApi = {
  list: () =>
    workforceClient.get<CoverageTemplate[]>('/coverage/templates'),

  get: (id: string) =>
    workforceClient.get<CoverageTemplate>(`/coverage/templates/${id}`),

  create: (data: CreateCoverageTemplate) =>
    workforceClient.post<CoverageTemplate>('/coverage/templates', data),

  update: (id: string, data: UpdateCoverageTemplate) =>
    workforceClient.put<CoverageTemplate>(`/coverage/templates/${id}`, data),

  delete: (id: string) =>
    workforceClient.delete(`/coverage/templates/${id}`),

  setDefault: (id: string) =>
    workforceClient.post(`/coverage/templates/${id}/set-default`),

  duplicate: (id: string, name: string) =>
    workforceClient.post<CoverageTemplate>(`/coverage/templates/${id}/duplicate`, { name }),
};

// ============================================================================
// Coverage Rules API
// ============================================================================

export const coverageRulesApi = {
  list: (orgNodeId?: string) =>
    workforceClient.get<CoverageRule[]>('/coverage/rules', { params: { org_node_id: orgNodeId } }),

  get: (id: string) =>
    workforceClient.get<CoverageRule>(`/coverage/rules/${id}`),

  create: (data: CreateCoverageRule) =>
    workforceClient.post<CoverageRule>('/coverage/rules', data),

  update: (id: string, data: UpdateCoverageRule) =>
    workforceClient.put<CoverageRule>(`/coverage/rules/${id}`, data),

  delete: (id: string) =>
    workforceClient.delete(`/coverage/rules/${id}`),

  // Effective coverage (considering inheritance)
  getEffective: (orgNodeId: string, date?: string) =>
    workforceClient.get<EffectiveCoverage>(`/coverage/effective/${orgNodeId}`, { params: { date } }),
};

// ============================================================================
// Validation API
// ============================================================================

export const validationApi = {
  validateCoverage: (data: ValidateCoverageRequest) =>
    workforceClient.post<ValidateCoverageResponse>('/validation/coverage', data),

  simulateLeave: (data: LeaveSimulationRequest) =>
    workforceClient.post<LeaveSimulationResponse>('/validation/simulate-leave', data),

  simulateShiftChange: (data: ShiftChangeSimulationRequest) =>
    workforceClient.post<ShiftChangeSimulationResponse>('/validation/simulate-shift-change', data),

  // Quick validation (single org node, current date)
  quickValidate: (orgNodeId: string) =>
    workforceClient.get<ValidateCoverageResponse>(`/validation/quick/${orgNodeId}`),
};

// ============================================================================
// Combined Export
// ============================================================================

export const workforceApi = {
  nodeTypes: orgNodeTypesApi,
  nodes: orgNodesApi,
  functions: functionDefsApi,
  employees: employeesApi,
  templates: coverageTemplatesApi,
  rules: coverageRulesApi,
  validation: validationApi,

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
