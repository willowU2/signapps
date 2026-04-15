/**
 * Billing API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import axios from "axios";
import { getClient, getServiceBaseUrl, ServiceName } from "./factory";

const billingClient = getClient(ServiceName.BILLING);

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export interface Invoice {
  id: string;
  number: string;
  // client_name is extracted from metadata by backend (InvoiceResponse)
  client_name?: string;
  // total_ttc is amount_cents / 100
  total_ttc: number;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  issued_at: string;
  due_at?: string;
  // Alias for compatibility
  due_date?: string;
  paid_at?: string;
  download_url?: string;
  tenant_id?: string;
  plan_id?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateInvoiceRequest {
  number: string;
  amount_cents: number;
  currency?: string;
  tenant_id?: string;
  plan_id?: string;
  due_at?: string;
  metadata?: Record<string, unknown>;
}

export interface LineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  sort_order: number;
  created_at: string;
}

export interface CreateLineItemRequest {
  description: string;
  quantity?: number;
  unit_price_cents: number;
  sort_order?: number;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount_cents: number;
  currency: string;
  method: string;
  reference?: string;
  paid_at: string;
  created_at: string;
}

export interface CreatePaymentRequest {
  amount_cents: number;
  currency?: string;
  method?: string;
  reference?: string;
  paid_at?: string;
}

export interface BillingPlan {
  id: string;
  name: string;
  description?: string;
  // Backend stores price_cents, not price_monthly
  price_cents: number;
  currency: string;
  features: string[] | Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface CreatePlanRequest {
  name: string;
  description?: string;
  price_cents: number;
  currency?: string;
  features?: string[] | Record<string, unknown>;
}

export interface BillingUsage {
  storage_used_bytes: number;
  storage_limit_bytes: number;
  api_calls_this_month: number;
  api_calls_limit: number;
  active_users: number;
  user_limit: number;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const billingApi = {
  // Plans
  listPlans: () => billingClient.get<BillingPlan[]>("/plans"),

  createPlan: (data: CreatePlanRequest) =>
    billingClient.post<BillingPlan>("/plans", data),

  updatePlan: (id: string, data: Partial<CreatePlanRequest>) =>
    billingClient.put<BillingPlan>(`/plans/${id}`, data),

  deletePlan: (id: string) => billingClient.delete(`/plans/${id}`),

  // Invoices
  listInvoices: () => billingClient.get<Invoice[]>("/invoices"),

  createInvoice: (data: CreateInvoiceRequest) =>
    billingClient.post<Invoice>("/invoices", data),

  getInvoice: (id: string) => billingClient.get<Invoice>(`/invoices/${id}`),

  updateInvoiceStatus: (id: string, status: string) =>
    billingClient.patch<Invoice>(`/invoices/${id}`, { status }),

  updateInvoice: (
    id: string,
    data: Partial<CreateInvoiceRequest> & { status?: string },
  ) => billingClient.patch<Invoice>(`/invoices/${id}`, data),

  deleteInvoice: (id: string) => billingClient.delete(`/invoices/${id}`),

  // Line Items — AQ-BILLDB
  listLineItems: (invoiceId: string) =>
    billingClient.get<LineItem[]>(`/invoices/${invoiceId}/line-items`),

  createLineItem: (invoiceId: string, data: CreateLineItemRequest) =>
    billingClient.post<LineItem>(`/invoices/${invoiceId}/line-items`, data),

  deleteLineItem: (invoiceId: string, itemId: string) =>
    billingClient.delete(`/invoices/${invoiceId}/line-items/${itemId}`),

  // Payments — AQ-BILLDB
  listPayments: (invoiceId: string) =>
    billingClient.get<Payment[]>(`/invoices/${invoiceId}/payments`),

  createPayment: (invoiceId: string, data: CreatePaymentRequest) =>
    billingClient.post<Payment>(`/invoices/${invoiceId}/payments`, data),

  // Usage
  getUsage: () => billingClient.get<BillingUsage>("/usage"),

  // EX3: Stripe Checkout — create a payment session for an invoice
  createStripeCheckout: (
    invoiceId: string,
    options?: { successUrl?: string; cancelUrl?: string },
  ) =>
    billingClient.post<{ checkout_url: string; session_id: string }>(
      "/billing/stripe/checkout",
      {
        invoice_id: invoiceId,
        success_url: options?.successUrl,
        cancel_url: options?.cancelUrl,
      },
    ),

  // Health endpoint is at root /health (not under /api/v1)
  health: () =>
    axios.get(`${getServiceBaseUrl(ServiceName.BILLING)}/health`, {
      withCredentials: true,
    }),
};
