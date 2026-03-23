"use client";

import { useState } from "react";
import { Plus, MessageSquare } from "lucide-react";

interface RFQ {
  id: string;
  title: string;
  deadline: string;
  responsesCount: number;
  status: "open" | "closed" | "awarded";
}

const DEFAULT_RFQS: RFQ[] = [
  {
    id: "1",
    title: "Electronic Components Bundle",
    deadline: "2026-04-10",
    responsesCount: 5,
    status: "open",
  },
  {
    id: "2",
    title: "Office Furniture Supply",
    deadline: "2026-03-28",
    responsesCount: 3,
    status: "open",
  },
  {
    id: "3",
    title: "Network Equipment Q2",
    deadline: "2026-03-25",
    responsesCount: 7,
    status: "closed",
  },
];

export default function RFQManager() {
  const [rfqs, setRfqs] = useState<RFQ[]>(DEFAULT_RFQS);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: "", deadline: "" });

  const handleCreateRFQ = () => {
    if (formData.title && formData.deadline) {
      setRfqs([
        ...rfqs,
        {
          id: String(rfqs.length + 1),
          title: formData.title,
          deadline: formData.deadline,
          responsesCount: 0,
          status: "open",
        },
      ]);
      setFormData({ title: "", deadline: "" });
      setShowForm(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClass = "px-2 py-1 rounded text-xs font-semibold";
    switch (status) {
      case "open":
        return baseClass + " bg-green-100 text-green-700";
      case "closed":
        return baseClass + " bg-yellow-100 text-yellow-700";
      case "awarded":
        return baseClass + " bg-blue-100 text-blue-700";
      default:
        return baseClass + " bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">RFQ Manager</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create RFQ
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <h3 className="mb-4 font-semibold">New RFQ</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Electronic Components"
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Deadline</label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateRFQ}
                className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormData({ title: "", deadline: "" });
                }}
                className="rounded bg-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Active RFQs</h2>
        </div>
        <div className="divide-y">
          {rfqs.map((rfq) => (
            <div key={rfq.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{rfq.title}</p>
                <p className="text-sm text-gray-600">Deadline: {rfq.deadline}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-semibold">{rfq.responsesCount} responses</span>
                </div>
                <span className={getStatusBadge(rfq.status)}>{rfq.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
