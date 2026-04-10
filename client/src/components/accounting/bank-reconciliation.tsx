"use client";

import { useState } from "react";
import { Check, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  matched?: boolean;
  linkedId?: string;
}

interface BankStmt extends Transaction {
  type: "debit" | "credit";
}

interface LedgerEntry extends Transaction {
  account: string;
}

const DEFAULT_BANK: BankStmt[] = [
  {
    id: "b1",
    date: "2026-03-20",
    description: "Customer Payment ABC Inc",
    amount: 5000,
    type: "credit",
    matched: true,
  },
  {
    id: "b2",
    date: "2026-03-19",
    description: "Vendor Payment XYZ Ltd",
    amount: 2500,
    type: "debit",
    matched: true,
  },
  {
    id: "b3",
    date: "2026-03-18",
    description: "Operating Expenses",
    amount: 1200,
    type: "debit",
    matched: false,
  },
  {
    id: "b4",
    date: "2026-03-17",
    description: "Loan Repayment",
    amount: 3000,
    type: "debit",
    matched: false,
  },
];

const DEFAULT_LEDGER: LedgerEntry[] = [
  {
    id: "l1",
    date: "2026-03-20",
    description: "Invoice #2024-001",
    amount: 5000,
    account: "Accounts Receivable",
    matched: true,
  },
  {
    id: "l2",
    date: "2026-03-19",
    description: "Invoice Payment",
    amount: 2500,
    account: "Accounts Payable",
    matched: true,
  },
  {
    id: "l3",
    date: "2026-03-18",
    description: "Utilities Bill",
    amount: 800,
    account: "Operating Expenses",
    matched: false,
  },
  {
    id: "l4",
    date: "2026-03-17",
    description: "Loan Payment",
    amount: 3000,
    account: "Debt",
    matched: false,
  },
  {
    id: "l5",
    date: "2026-03-16",
    description: "Office Supplies",
    amount: 450,
    account: "Operating Expenses",
    matched: false,
  },
];

export function BankReconciliation() {
  const [bankTxns, setBankTxns] = useState<BankStmt[]>(DEFAULT_BANK);
  const [ledgerTxns, setLedgerTxns] = useState<LedgerEntry[]>(DEFAULT_LEDGER);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [selectedLedger, setSelectedLedger] = useState<string | null>(null);

  const handleMatch = () => {
    if (!selectedBank || !selectedLedger) return;

    const bankTxn = bankTxns.find((t) => t.id === selectedBank);
    const ledgerTxn = ledgerTxns.find((t) => t.id === selectedLedger);

    if (
      bankTxn &&
      ledgerTxn &&
      Math.abs(bankTxn.amount - ledgerTxn.amount) < 0.01
    ) {
      setBankTxns(
        bankTxns.map((t) =>
          t.id === selectedBank ? { ...t, matched: true, linkedId: selectedLedger } : t
        )
      );
      setLedgerTxns(
        ledgerTxns.map((t) =>
          t.id === selectedLedger ? { ...t, matched: true, linkedId: selectedBank } : t
        )
      );
      setSelectedBank(null);
      setSelectedLedger(null);
    }
  };

  const handleUnmatch = (type: "bank" | "ledger", id: string) => {
    if (type === "bank") {
      const txn = bankTxns.find((t) => t.id === id);
      if (txn?.linkedId) {
        setLedgerTxns(
          ledgerTxns.map((t) =>
            t.id === txn.linkedId ? { ...t, matched: false, linkedId: undefined } : t
          )
        );
      }
      setBankTxns(
        bankTxns.map((t) =>
          t.id === id ? { ...t, matched: false, linkedId: undefined } : t
        )
      );
    } else {
      const txn = ledgerTxns.find((t) => t.id === id);
      if (txn?.linkedId) {
        setBankTxns(
          bankTxns.map((t) =>
            t.id === txn.linkedId ? { ...t, matched: false, linkedId: undefined } : t
          )
        );
      }
      setLedgerTxns(
        ledgerTxns.map((t) =>
          t.id === id ? { ...t, matched: false, linkedId: undefined } : t
        )
      );
    }
  };

  const bankBalance = bankTxns.reduce(
    (sum, t) => sum + (t.type === "credit" ? t.amount : -t.amount),
    0
  );
  const ledgerBalance = ledgerTxns.reduce((sum, t) => sum + t.amount, 0);
  const balanceDiff = Math.abs(bankBalance - ledgerBalance);
  const isReconciled = balanceDiff < 0.01;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Rapprochement bancaire
          </h2>
          <p className="text-muted-foreground">Match bank statements with ledger</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-primary/10 p-4">
          <p className="text-sm text-muted-foreground font-medium">Bank Balance</p>
          <p className="text-2xl font-bold text-primary">
            €{bankBalance.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border bg-emerald-500/10 p-4">
          <p className="text-sm text-muted-foreground font-medium">Ledger Balance</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            €{ledgerBalance.toFixed(2)}
          </p>
        </div>
        <div
          className={`rounded-lg border p-4 transition-colors ${
            isReconciled
              ? "bg-emerald-500/10"
              : balanceDiff > 100
                ? "bg-destructive/10"
                : "bg-amber-500/10"
          }`}
        >
          <p className="text-sm text-muted-foreground font-medium">Difference</p>
          <p
            className={`text-2xl font-bold transition-colors ${
              isReconciled
                ? "text-emerald-600 dark:text-emerald-400"
                : balanceDiff > 100
                  ? "text-destructive"
                  : "text-amber-600 dark:text-amber-500"
            }`}
          >
            €{balanceDiff.toFixed(2)}
          </p>
        </div>
      </div>

      {!isReconciled && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-700 dark:text-amber-500">
              Reconciliation Incomplete
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400/80">
              Match remaining transactions to complete reconciliation
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted border-b p-3">
            <h3 className="font-semibold text-foreground">Bank Statement</h3>
            <p className="text-xs text-muted-foreground">
              {bankTxns.filter((t) => t.matched).length} of {bankTxns.length}{" "}
              matched
            </p>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {bankTxns.map((txn) => (
              <div
                key={txn.id}
                onClick={() => setSelectedBank(txn.id)}
                className={`p-3 cursor-pointer transition-all ${
                  selectedBank === txn.id
                    ? "bg-primary/10 border-l-4 border-l-primary"
                    : txn.matched
                      ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                      : "hover:bg-muted"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {txn.description}
                    </p>
                    <p className="text-xs text-muted-foreground">{txn.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">
                      {txn.type === "debit" ? "-" : "+"}€{txn.amount.toFixed(2)}
                    </p>
                    {txn.matched && (
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                  </div>
                </div>
                {txn.matched && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnmatch("bank", txn.id);
                    }}
                    className="mt-2 h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    Unmatch
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted border-b p-3">
            <h3 className="font-semibold text-foreground">Ledger Entries</h3>
            <p className="text-xs text-muted-foreground">
              {ledgerTxns.filter((t) => t.matched).length} of{" "}
              {ledgerTxns.length} matched
            </p>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {ledgerTxns.map((txn) => (
              <div
                key={txn.id}
                onClick={() => setSelectedLedger(txn.id)}
                className={`p-3 cursor-pointer transition-all ${
                  selectedLedger === txn.id
                    ? "bg-primary/10 border-l-4 border-l-primary"
                    : txn.matched
                      ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                      : "hover:bg-muted"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {txn.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {txn.account} • {txn.date}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">
                      €{txn.amount.toFixed(2)}
                    </p>
                    {txn.matched && (
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                  </div>
                </div>
                {txn.matched && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnmatch("ledger", txn.id);
                    }}
                    className="mt-2 h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    Unmatch
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <Button
          onClick={handleMatch}
          disabled={!selectedBank || !selectedLedger}
          className="w-full transition-all"
        >
          Match Selected Transactions
        </Button>
      </div>
    </div>
  );
}
