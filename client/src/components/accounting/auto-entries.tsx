"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Clock, Check, X } from "lucide-react";

interface JournalEntry {
  id: string;
  sourceDoc: string;
  debit: {
    account: string;
    amount: number;
  };
  credit: {
    account: string;
    amount: number;
  };
  description: string;
  date: string;
  status: "pending" | "approved" | "rejected";
}

const DEFAULT_ENTRIES: JournalEntry[] = [
  {
    id: "1",
    sourceDoc: "INV-2026-001",
    debit: {
      account: "Accounts Receivable",
      amount: 2500,
    },
    credit: {
      account: "Service Revenue",
      amount: 2500,
    },
    description: "Invoice from Client ABC Inc",
    date: "2026-03-20",
    status: "pending",
  },
  {
    id: "2",
    sourceDoc: "INV-2026-002",
    debit: {
      account: "Accounts Receivable",
      amount: 1800,
    },
    credit: {
      account: "Product Sales",
      amount: 1800,
    },
    description: "Invoice from Client XYZ Ltd",
    date: "2026-03-20",
    status: "pending",
  },
  {
    id: "3",
    sourceDoc: "PO-2026-045",
    debit: {
      account: "Operating Expenses",
      amount: 500,
    },
    credit: {
      account: "Accounts Payable",
      amount: 500,
    },
    description: "Vendor Bill - Office Supplies",
    date: "2026-03-19",
    status: "approved",
  },
  {
    id: "4",
    sourceDoc: "PO-2026-046",
    debit: {
      account: "COGS",
      amount: 3200,
    },
    credit: {
      account: "Accounts Payable",
      amount: 3200,
    },
    description: "Vendor Bill - Inventory",
    date: "2026-03-19",
    status: "approved",
  },
  {
    id: "5",
    sourceDoc: "INV-2026-003",
    debit: {
      account: "Accounts Receivable",
      amount: 4000,
    },
    credit: {
      account: "Service Revenue",
      amount: 4000,
    },
    description: "Invoice from Client DEF Corp",
    date: "2026-03-18",
    status: "rejected",
  },
];

function getStatusIcon(status: string) {
  switch (status) {
    case "pending":
      return <Clock className="w-4 h-4 text-amber-600" />;
    case "approved":
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    case "rejected":
      return <XCircle className="w-4 h-4 text-red-600" />;
    default:
      return null;
  }
}

function getStatusBg(status: string): string {
  switch (status) {
    case "pending":
      return "bg-amber-50 hover:bg-amber-100 border-amber-200";
    case "approved":
      return "bg-green-50 border-green-200";
    case "rejected":
      return "bg-red-50 border-red-200";
    default:
      return "bg-gray-50 border-gray-200";
  }
}

export function AutoEntries() {
  const [entries, setEntries] = useState<JournalEntry[]>(DEFAULT_ENTRIES);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleApprove = (id: string) => {
    setEntries(
      entries.map((e) =>
        e.id === id ? { ...e, status: "approved" } : e
      )
    );
  };

  const handleReject = (id: string) => {
    setEntries(
      entries.map((e) =>
        e.id === id ? { ...e, status: "rejected" } : e
      )
    );
  };

  const handleBatchPost = () => {
    if (selectedIds.size === 0) return;
    setEntries(
      entries.map((e) =>
        selectedIds.has(e.id) ? { ...e, status: "approved" } : e
      )
    );
    setSelectedIds(new Set());
  };

  const pendingCount = entries.filter((e) => e.status === "pending").length;
  const approvedCount = entries.filter((e) => e.status === "approved").length;
  const rejectedCount = entries.filter((e) => e.status === "rejected").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Auto-Generated Journal Entries
          </h2>
          <p className="text-gray-600">
            Review and approve entries from invoices and bills
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-amber-50 p-4">
          <p className="text-sm text-gray-600 font-medium">Pending Review</p>
          <p className="text-2xl font-bold text-amber-900">{pendingCount}</p>
        </div>
        <div className="rounded-lg border bg-green-50 p-4">
          <p className="text-sm text-gray-600 font-medium">Approved</p>
          <p className="text-2xl font-bold text-green-900">{approvedCount}</p>
        </div>
        <div className="rounded-lg border bg-red-50 p-4">
          <p className="text-sm text-gray-600 font-medium">Rejected</p>
          <p className="text-2xl font-bold text-red-900">{rejectedCount}</p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-100 border-b p-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Entry List</h3>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBatchPost}
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-1 px-3 rounded text-sm flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Post {selectedIds.size} Selected
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-white">
            <thead className="bg-gray-50 border-b sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    className="rounded"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(
                          new Set(
                            entries
                              .filter((e) => e.status === "pending")
                              .map((e) => e.id)
                          )
                        );
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Source
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Description
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Debit
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Credit
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((entry) => (
                <tr key={entry.id} className={`border-l-4 ${getStatusBg(entry.status)}`}>
                  <td className="px-4 py-3">
                    {entry.status === "pending" && (
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={selectedIds.has(entry.id)}
                        onChange={() => handleToggleSelect(entry.id)}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono font-semibold text-gray-900">
                      {entry.sourceDoc}
                    </p>
                    <p className="text-xs text-gray-500">{entry.date}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {entry.description}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-900 font-medium">
                      {entry.debit.account}
                    </p>
                    <p className="font-semibold text-gray-900">
                      €{entry.debit.amount.toFixed(2)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-900 font-medium">
                      {entry.credit.account}
                    </p>
                    <p className="font-semibold text-gray-900">
                      €{entry.credit.amount.toFixed(2)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {getStatusIcon(entry.status)}
                      <span className="text-xs font-medium capitalize">
                        {entry.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {entry.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleApprove(entry.id)}
                          className="text-green-600 hover:text-green-800 hover:bg-green-50 rounded px-2 py-1 inline-flex items-center gap-1"
                          title="Approve"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleReject(entry.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded px-2 py-1 inline-flex items-center gap-1"
                          title="Reject"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
