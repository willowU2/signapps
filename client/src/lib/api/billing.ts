/**
 * Billing API Module
 *
 * Connects to the billing service on port 8096.
 * Endpoints: GET /api/invoices, GET /health
 */
import axios from 'axios';

const BILLING_BASE_URL =
  process.env.NEXT_PUBLIC_BILLING_URL || 'http://localhost:8096';

const billingClient = axios.create({
  baseURL: BILLING_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 10000,
});

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
  /** Optional download URL returned by the backend */
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
  /** Fetch all invoices */
  listInvoices: () =>
    billingClient.get<Invoice[]>('/api/invoices'),

  /** Health check */
  health: () =>
    billingClient.get('/health'),
};
