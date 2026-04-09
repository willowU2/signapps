/**
 * Expenses API Module — via signapps-workforce (port 3024)
 *
 * Provides CRUD + approval workflow for expense reports.
 * Routes through gateway at /api/v1/workforce/expenses.
 */
import { getClient, ServiceName } from "./factory";

// ============================================================================
// Types
// ============================================================================

export type ExpenseStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "paid";

export interface ExpenseReport {
  id: string;
  title: string;
  description?: string;
  /** Amount in minor currency units (cents) */
  amount: number;
  currency: string;
  category?: string;
  status: ExpenseStatus;
  receipt_url?: string;
  date: string;
  owner_id: string;
  approver_id?: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateExpenseRequest {
  title: string;
  description?: string;
  amount?: number;
  currency?: string;
  category?: string;
  receipt_url?: string;
  date?: string;
}

export interface UpdateExpenseRequest {
  title?: string;
  description?: string;
  amount?: number;
  currency?: string;
  category?: string;
  receipt_url?: string;
  date?: string;
}

// ============================================================================
// Client
// ============================================================================

const workforceClient = () => getClient(ServiceName.WORKFORCE);

// ============================================================================
// Expenses API
// ============================================================================

export const expensesApi = {
  /** List expense reports for the authenticated user */
  list: (params?: { status?: string; limit?: number; offset?: number }) =>
    workforceClient().get<ExpenseReport[]>("/workforce/expenses", { params }),

  /** Create a new expense report (draft) */
  create: (data: CreateExpenseRequest) =>
    workforceClient().post<ExpenseReport>("/workforce/expenses", data),

  /** Update a draft expense report */
  update: (id: string, data: UpdateExpenseRequest) =>
    workforceClient().put<ExpenseReport>(`/workforce/expenses/${id}`, data),

  /** Delete a draft expense report */
  delete: (id: string) => workforceClient().delete(`/workforce/expenses/${id}`),

  /** Submit a draft expense for approval */
  submitForApproval: (id: string) =>
    workforceClient().post<ExpenseReport>(`/workforce/expenses/${id}/submit`),

  /** Approve a submitted expense */
  approve: (id: string, comment?: string) =>
    workforceClient().post<ExpenseReport>(`/workforce/expenses/${id}/approve`, {
      comment,
    }),

  /** Reject a submitted expense */
  reject: (id: string, comment?: string) =>
    workforceClient().post<ExpenseReport>(`/workforce/expenses/${id}/reject`, {
      comment,
    }),

  /** Mark an approved expense as paid */
  markPaid: (id: string) =>
    workforceClient().post<ExpenseReport>(
      `/workforce/expenses/${id}/mark-paid`,
    ),
};
