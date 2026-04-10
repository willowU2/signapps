"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronDown, ChevronRight, Plus, Edit2 } from "lucide-react";
import { accountingApi, type AccountingAccount } from "@/lib/api/accounting";

interface Account {
  id: string;
  number: string;
  name: string;
  balance: number;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  children?: Account[];
}

/** Convert flat API accounts into a nested tree structure. */
function buildTree(flat: AccountingAccount[]): Account[] {
  const map = new Map<string, Account>();
  const roots: Account[] = [];

  // First pass: create Account nodes
  for (const a of flat) {
    map.set(a.id, {
      id: a.id,
      number: a.code,
      name: a.name,
      balance: a.balance / 100, // cents to euros
      type: a.account_type as Account["type"],
      children: [],
    });
  }

  // Second pass: link children to parents
  for (const a of flat) {
    const node = map.get(a.id);
    if (!node) continue;
    if (a.parent_id && map.has(a.parent_id)) {
      const parent = map.get(a.parent_id);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function getTypeColor(type: string): string {
  switch (type) {
    case "asset":
      return "text-blue-600";
    case "liability":
      return "text-red-600";
    case "equity":
      return "text-green-600";
    case "revenue":
      return "text-emerald-600";
    case "expense":
      return "text-orange-600";
    default:
      return "text-muted-foreground";
  }
}

function AccountRow({
  account,
  level,
  expandedIds,
  onToggle,
}: {
  account: Account;
  level: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const hasChildren = account.children && account.children.length > 0;
  const isExpanded = expandedIds.has(account.id);

  return (
    <>
      <tr className="hover:bg-muted border-b">
        <td className="px-4 py-3">
          <div
            style={{ marginLeft: `${level * 20}px` }}
            className="flex items-center gap-2"
          >
            {hasChildren ? (
              <button
                onClick={() => onToggle(account.id)}
                className="p-0 hover:bg-gray-200 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            ) : (
              <div className="w-4" />
            )}
            <span className="font-mono text-sm font-medium text-muted-foreground">
              {account.number}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <p className="font-medium text-foreground">{account.name}</p>
        </td>
        <td className="px-4 py-3">
          <span
            className={`text-xs font-semibold px-2 py-1 rounded ${getTypeColor(account.type)}`}
          >
            {account.type}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <p className="font-semibold text-foreground">
            €
            {account.balance.toLocaleString("de-DE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </td>
        <td className="px-4 py-3 text-right">
          <button className="p-1 hover:bg-gray-200 rounded text-muted-foreground hover:text-foreground">
            <Edit2 className="w-4 h-4" />
          </button>
        </td>
      </tr>
      {hasChildren &&
        isExpanded &&
        account.children?.map((child) => (
          <AccountRow
            key={child.id}
            account={child}
            level={level + 1}
            expandedIds={expandedIds}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

export function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const seedAttempted = useRef(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await accountingApi.listAccounts();
      const flat: AccountingAccount[] = res.data;

      // Auto-seed if no accounts exist
      if (flat.length === 0 && !seedAttempted.current) {
        seedAttempted.current = true;
        const seedRes = await accountingApi.seedDefaultCOA();
        const seeded: AccountingAccount[] = seedRes.data;
        const tree = buildTree(seeded);
        setAccounts(tree);
        // Expand root nodes
        setExpandedIds(new Set(tree.map((a) => a.id)));
      } else {
        const tree = buildTree(flat);
        setAccounts(tree);
        if (expandedIds.size === 0) {
          setExpandedIds(new Set(tree.map((a) => a.id)));
        }
      }
    } catch {
      // Backend unavailable -- silently degrade
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleToggle = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const calculateBalances = (accts: Account[]): number => {
    return accts.reduce((sum, acc) => {
      let balance = acc.balance;
      if (acc.children) {
        balance += calculateBalances(acc.children);
      }
      return sum + balance;
    }, 0);
  };

  const totalBalance = calculateBalances(accounts);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-muted-foreground">Loading accounts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Plan comptable
          </h2>
          <p className="text-muted-foreground">
            Manage account structure and balances
          </p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nouveau Compte
        </button>
      </div>

      <div className="rounded-lg border bg-blue-50 p-4">
        <p className="text-sm text-muted-foreground font-medium">
          Total Balance
        </p>
        <p className="text-2xl font-bold text-blue-900">
          €
          {totalBalance.toLocaleString("de-DE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-foreground">
                  Ligne #
                </th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">
                  Type
                </th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">
                  Solde
                </th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {accounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  level={0}
                  expandedIds={expandedIds}
                  onToggle={handleToggle}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Actif", type: "asset", color: "text-blue-600" },
          { label: "Passif", type: "liability", color: "text-red-600" },
          { label: "Capital", type: "equity", color: "text-green-600" },
          { label: "Chiffre d'affaires", type: "revenue", color: "text-emerald-600" },
          { label: "Charges", type: "expense", color: "text-orange-600" },
        ].map(({ label, type, color }) => {
          const sum = calculateBalances(
            accounts.filter((a) => a.type === type),
          );
          return (
            <div key={type} className="rounded-lg border bg-background p-3">
              <p className={`text-xs font-semibold ${color}`}>{label}</p>
              <p className="text-lg font-bold text-foreground">
                €{sum.toLocaleString("de-DE")}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
