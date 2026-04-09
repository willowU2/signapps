/**
 * Accounting API Module -- signapps-billing (port 8096)
 *
 * Chart of accounts, journal entries, reports, and seeding.
 * Routes through the gateway at /api/v1/accounting/*.
 */
import { getClient, ServiceName } from "./factory";

// ============================================================================
// Types
// ============================================================================

export interface AccountingAccount {
  id: string;
  parent_id: string | null;
  code: string;
  name: string;
  account_type: "asset" | "liability" | "equity" | "revenue" | "expense";
  balance: number;
  currency: string;
  is_active: boolean;
  owner_id: string;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAccountRequest {
  parent_id?: string | null;
  code: string;
  name: string;
  account_type: string;
  balance?: number;
  currency?: string;
}

export interface JournalLine {
  id: string;
  entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface JournalEntryWithLines {
  id: string;
  date: string;
  reference?: string;
  description?: string;
  is_posted: boolean;
  owner_id: string;
  tenant_id?: string;
  created_at: string;
  lines: JournalLine[];
}

export interface CreateEntryRequest {
  date: string;
  reference?: string;
  description?: string;
  lines: {
    account_id: string;
    debit?: number;
    credit?: number;
    description?: string;
  }[];
}

// ============================================================================
// Client
// ============================================================================

const client = () => getClient(ServiceName.BILLING);

// ============================================================================
// Accounting API
// ============================================================================

export const accountingApi = {
  // Chart of Accounts
  listAccounts: () => client().get<AccountingAccount[]>("/accounting/accounts"),

  getAccount: (id: string) =>
    client().get<AccountingAccount>(`/accounting/accounts/${id}`),

  createAccount: (data: CreateAccountRequest) =>
    client().post<AccountingAccount>("/accounting/accounts", data),

  updateAccount: (id: string, data: CreateAccountRequest) =>
    client().put<AccountingAccount>(`/accounting/accounts/${id}`, data),

  deleteAccount: (id: string) => client().delete(`/accounting/accounts/${id}`),

  // Journal Entries
  listEntries: (params?: Record<string, string>) =>
    client().get<JournalEntryWithLines[]>("/accounting/entries", { params }),

  createEntry: (data: CreateEntryRequest) =>
    client().post<JournalEntryWithLines>("/accounting/entries", data),

  postEntry: (id: string) =>
    client().post<JournalEntryWithLines>(`/accounting/entries/${id}/post`),

  // Reports
  getBalanceSheet: () => client().get("/accounting/reports/balance-sheet"),

  getProfitLoss: (params?: Record<string, string>) =>
    client().get("/accounting/reports/profit-loss", { params }),

  getTrialBalance: () => client().get("/accounting/reports/trial-balance"),

  // Seed with default chart of accounts
  seedDefaultCOA: () => client().post<AccountingAccount[]>("/accounting/seed"),
};
