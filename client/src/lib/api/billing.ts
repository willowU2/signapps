/**
 * Billing API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from './factory';

const billingClient = getClient(ServiceName.BILLING);

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export interface Invoice {
  id: string;
  number: string;
  client_name: string;
  total_ttc: number;
  currency: string;
  status: InvoiceStatus;
  created_at: string;
  due_date: string;
  download_url?: string;
}

export interface BillingPlan {
  id: string;
  name: string;
  price_monthly: number;
  currency: string;
  features: string[];
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
  listInvoices: () =>
    billingClient.get<Invoice[]>('/invoices'),

  updateInvoiceStatus: (id: string, status: InvoiceStatus) =>
    billingClient.patch<Invoice>(`/invoices/${id}`, { status }),

  getUsage: () =>
    billingClient.get<BillingUsage>('/usage'),

  health: () =>
    billingClient.get('/health'),
};
