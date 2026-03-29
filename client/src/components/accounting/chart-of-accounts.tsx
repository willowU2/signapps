"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Edit2 } from "lucide-react";

interface Account {
  id: string;
  number: string;
  name: string;
  balance: number;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  children?: Account[];
}

const DEFAULT_COA: Account[] = [
  {
    id: "1",
    number: "1",
    name: "Assets",
    balance: 0,
    type: "asset",
    children: [
      {
        id: "11",
        number: "1.1",
        name: "Current Assets",
        balance: 0,
        type: "asset",
        children: [
          {
            id: "111",
            number: "1.1.1",
            name: "Cash",
            balance: 25000,
            type: "asset",
          },
          {
            id: "112",
            number: "1.1.2",
            name: "Accounts Receivable",
            balance: 15000,
            type: "asset",
          },
          {
            id: "113",
            number: "1.1.3",
            name: "Inventory",
            balance: 8000,
            type: "asset",
          },
        ],
      },
      {
        id: "12",
        number: "1.2",
        name: "Fixed Assets",
        balance: 0,
        type: "asset",
        children: [
          {
            id: "121",
            number: "1.2.1",
            name: "Property & Equipment",
            balance: 50000,
            type: "asset",
          },
          {
            id: "122",
            number: "1.2.2",
            name: "Accumulated Depreciation",
            balance: -10000,
            type: "asset",
          },
        ],
      },
    ],
  },
  {
    id: "2",
    number: "2",
    name: "Liabilities",
    balance: 0,
    type: "liability",
    children: [
      {
        id: "21",
        number: "2.1",
        name: "Current Liabilities",
        balance: 0,
        type: "liability",
        children: [
          {
            id: "211",
            number: "2.1.1",
            name: "Accounts Payable",
            balance: 5000,
            type: "liability",
          },
          {
            id: "212",
            number: "2.1.2",
            name: "Short-term Debt",
            balance: 10000,
            type: "liability",
          },
        ],
      },
      {
        id: "22",
        number: "2.2",
        name: "Long-term Liabilities",
        balance: 0,
        type: "liability",
        children: [
          {
            id: "221",
            number: "2.2.1",
            name: "Long-term Debt",
            balance: 25000,
            type: "liability",
          },
        ],
      },
    ],
  },
  {
    id: "3",
    number: "3",
    name: "Equity",
    balance: 0,
    type: "equity",
    children: [
      {
        id: "31",
        number: "3.1",
        name: "Capital Stock",
        balance: 50000,
        type: "equity",
      },
      {
        id: "32",
        number: "3.2",
        name: "Retained Earnings",
        balance: 8000,
        type: "equity",
      },
    ],
  },
  {
    id: "4",
    number: "4",
    name: "Revenue",
    balance: 0,
    type: "revenue",
    children: [
      {
        id: "41",
        number: "4.1",
        name: "Service Revenue",
        balance: 120000,
        type: "revenue",
      },
      {
        id: "42",
        number: "4.2",
        name: "Product Sales",
        balance: 80000,
        type: "revenue",
      },
    ],
  },
  {
    id: "5",
    number: "5",
    name: "Expenses",
    balance: 0,
    type: "expense",
    children: [
      {
        id: "51",
        number: "5.1",
        name: "Operating Expenses",
        balance: 0,
        type: "expense",
        children: [
          {
            id: "511",
            number: "5.1.1",
            name: "Salaries & Wages",
            balance: 60000,
            type: "expense",
          },
          {
            id: "512",
            number: "5.1.2",
            name: "Rent",
            balance: 12000,
            type: "expense",
          },
          {
            id: "513",
            number: "5.1.3",
            name: "Utilities",
            balance: 2400,
            type: "expense",
          },
        ],
      },
      {
        id: "52",
        number: "5.2",
        name: "COGS",
        balance: 40000,
        type: "expense",
      },
    ],
  },
];

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
      return "text-gray-600";
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
      <tr className="hover:bg-gray-50 border-b">
        <td className="px-4 py-3">
          <div style={{ marginLeft: `${level * 20}px` }} className="flex items-center gap-2">
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
            <span className="font-mono text-sm font-medium text-gray-700">
              {account.number}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <p className="font-medium text-gray-900">{account.name}</p>
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs font-semibold px-2 py-1 rounded ${getTypeColor(account.type)}`}>
            {account.type}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <p className="font-semibold text-gray-900">
            €{account.balance.toLocaleString("de-DE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </td>
        <td className="px-4 py-3 text-right">
          <button className="p-1 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-900">
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(["1", "2", "3", "4", "5"])
  );

  const handleToggle = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const calculateBalances = (accounts: Account[]): number => {
    return accounts.reduce((sum, acc) => {
      let balance = acc.balance;
      if (acc.children) {
        balance += calculateBalances(acc.children);
      }
      return sum + balance;
    }, 0);
  };

  const totalBalance = calculateBalances(DEFAULT_COA);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Chart of Accounts
          </h2>
          <p className="text-gray-600">Manage account structure and balances</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Account
        </button>
      </div>

      <div className="rounded-lg border bg-blue-50 p-4">
        <p className="text-sm text-gray-600 font-medium">Total Balance</p>
        <p className="text-2xl font-bold text-blue-900">
          €{totalBalance.toLocaleString("de-DE", {
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
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Account #
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Type
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-900">
                  Balance
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {DEFAULT_COA.map((account) => (
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
          { label: "Assets", type: "asset", color: "text-blue-600" },
          { label: "Liabilities", type: "liability", color: "text-red-600" },
          { label: "Equity", type: "equity", color: "text-green-600" },
          { label: "Revenue", type: "revenue", color: "text-emerald-600" },
          { label: "Expenses", type: "expense", color: "text-orange-600" },
        ].map(({ label, type, color }) => {
          const sum = calculateBalances(
            DEFAULT_COA.filter((a) => a.type === type)
          );
          return (
            <div key={type} className="rounded-lg border bg-background p-3">
              <p className={`text-xs font-semibold ${color}`}>{label}</p>
              <p className="text-lg font-bold text-gray-900">
                €{sum.toLocaleString("de-DE")}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
