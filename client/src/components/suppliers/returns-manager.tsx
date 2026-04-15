"use client";

import { useState } from "react";
import { Plus, RotateCcw } from "lucide-react";

interface ReturnRequest {
  id: string;
  rmaNumber: string;
  reason: string;
  items: string[];
  status: "pending" | "approved" | "shipped" | "completed";
  date: string;
}

const DEFAULT_RETURNS: ReturnRequest[] = [
  {
    id: "1",
    rmaNumber: "RMA-2026-0001",
    reason: "Defective unit",
    items: ["5x Electronic Component A", "2x Connector Kit"],
    status: "approved",
    date: "2026-03-20",
  },
  {
    id: "2",
    rmaNumber: "RMA-2026-0002",
    reason: "Wrong specification",
    items: ["10x Office Furniture Part B"],
    status: "pending",
    date: "2026-03-21",
  },
  {
    id: "3",
    rmaNumber: "RMA-2026-0003",
    reason: "Damaged in shipping",
    items: ["3x Network Equipment", "1x Cable Bundle"],
    status: "shipped",
    date: "2026-03-15",
  },
];

export default function ReturnsManager() {
  const [returns, setReturns] = useState<ReturnRequest[]>(DEFAULT_RETURNS);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ reason: "", items: "" });

  const handleCreateReturn = () => {
    if (formData.reason && formData.items) {
      setReturns([
        ...returns,
        {
          id: String(returns.length + 1),
          rmaNumber: `RMA-2026-000${returns.length + 1}`,
          reason: formData.reason,
          items: formData.items.split("\n").filter((i) => i.trim()),
          status: "pending",
          date: new Date().toISOString().split("T")[0],
        },
      ]);
      setFormData({ reason: "", items: "" });
      setShowForm(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "shipped":
        return "bg-blue-100 text-blue-700";
      case "approved":
        return "bg-yellow-100 text-yellow-700";
      case "pending":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Returns Manager</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          New Return
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-muted p-4">
          <h3 className="mb-4 font-semibold">Create Return Request</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium">
                Reason for Return
              </label>
              <input
                type="text"
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
                placeholder="e.g., Defective unit"
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">
                Items (one per line)
              </label>
              <textarea
                value={formData.items}
                onChange={(e) =>
                  setFormData({ ...formData, items: e.target.value })
                }
                placeholder="e.g., 5x Component A&#10;2x Connector Kit"
                rows={4}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateReturn}
                className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
              >
                Create Return
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormData({ reason: "", items: "" });
                }}
                className="rounded bg-gray-300 px-4 py-2 text-sm text-muted-foreground hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Return Requests</h2>
        </div>
        <div className="divide-y">
          {returns.map((ret) => (
            <div key={ret.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <RotateCcw className="h-5 w-5 text-red-500 mt-1" />
                  <div>
                    <p className="font-semibold">{ret.rmaNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      Reason: {ret.reason}
                    </p>
                    <p className="mt-2 text-sm font-medium">Items:</p>
                    <ul className="ml-4 list-disc text-sm text-muted-foreground">
                      {ret.items.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Submitted: {ret.date}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded px-3 py-1 text-xs font-semibold ${getStatusColor(ret.status)}`}
                >
                  {ret.status.charAt(0).toUpperCase() + ret.status.slice(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
