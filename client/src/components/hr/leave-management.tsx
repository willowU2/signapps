"use client";

import { useState } from "react";
import { Calendar, Check, X, Clock, Plus, ChevronDown } from "lucide-react";

type LeaveStatus = "pending" | "approved" | "rejected";
type LeaveType = "vacation" | "sick" | "remote" | "unpaid" | "other";

interface LeaveRequest {
  id: string;
  employeeName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
}

interface LeaveBalance {
  type: LeaveType;
  label: string;
  total: number;
  used: number;
  pending: number;
}

const LEAVE_BALANCES: LeaveBalance[] = [
  { type: "vacation", label: "Congés payés", total: 25, used: 8, pending: 3 },
  { type: "sick", label: "Maladie", total: 10, used: 2, pending: 0 },
  { type: "remote", label: "Télétravail", total: 60, used: 22, pending: 5 },
  { type: "other", label: "Événements familiaux", total: 4, used: 1, pending: 0 },
];

const INIT_REQUESTS: LeaveRequest[] = [
  { id: "1", employeeName: "Alice Martin", type: "vacation", startDate: "2026-04-14", endDate: "2026-04-18", days: 5, reason: "Vacances d'avril", status: "pending" },
  { id: "2", employeeName: "Bob Dupont", type: "sick", startDate: "2026-03-25", endDate: "2026-03-26", days: 2, reason: "Grippe", status: "approved" },
  { id: "3", employeeName: "Claire Bernard", type: "remote", startDate: "2026-04-07", endDate: "2026-04-11", days: 5, reason: "Déménagement", status: "pending" },
  { id: "4", employeeName: "David Petit", type: "vacation", startDate: "2026-05-01", endDate: "2026-05-05", days: 5, reason: "Pont du 1er mai", status: "rejected" },
];

const TYPE_LABELS: Record<LeaveType, string> = {
  vacation: "Congés payés", sick: "Maladie", remote: "Télétravail", unpaid: "Sans solde", other: "Autre",
};

const STATUS_STYLES: Record<LeaveStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export function LeaveManagement() {
  const [requests, setRequests] = useState<LeaveRequest[]>(INIT_REQUESTS);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<LeaveStatus | "all">("all");
  const [form, setForm] = useState({ type: "vacation" as LeaveType, startDate: "", endDate: "", reason: "" });

  const filtered = filterStatus === "all" ? requests : requests.filter(r => r.status === filterStatus);

  const handleApprove = (id: string) => setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "approved" } : r));
  const handleReject = (id: string) => setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "rejected" } : r));

  const handleSubmit = () => {
    if (!form.startDate || !form.endDate) return;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    setRequests(prev => [...prev, {
      id: String(Date.now()), employeeName: "Moi", type: form.type,
      startDate: form.startDate, endDate: form.endDate, days,
      reason: form.reason, status: "pending",
    }]);
    setShowForm(false);
    setForm({ type: "vacation", startDate: "", endDate: "", reason: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des congés</h2>
          <p className="text-gray-600">Demandes, approbations et soldes</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Nouvelle demande
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {LEAVE_BALANCES.map(b => (
          <div key={b.type} className="rounded-lg border bg-white p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase">{b.label}</p>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-900">{b.total - b.used - b.pending}</span>
              <span className="text-sm text-gray-500">/ {b.total} j</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${((b.used + b.pending) / b.total) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-gray-500">{b.used} utilisés · {b.pending} en attente</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="rounded-lg border bg-blue-50 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Nouvelle demande de congé</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as LeaveType }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motif</label>
              <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Motif..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Soumettre</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Annuler</button>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Demandes</h3>
          <div className="flex gap-1">
            {(["all", "pending", "approved", "rejected"] as const).map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filterStatus === s ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                {s === "all" ? "Tous" : s === "pending" ? "En attente" : s === "approved" ? "Approuvés" : "Refusés"}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y">
          {filtered.map(r => (
            <div key={r.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50">
              <Calendar className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 text-sm">{r.employeeName}</p>
                  <span className="text-xs text-gray-500">{TYPE_LABELS[r.type]}</span>
                </div>
                <p className="text-xs text-gray-500">{r.startDate} → {r.endDate} · {r.days} jour{r.days > 1 ? "s" : ""}</p>
                {r.reason && <p className="text-xs text-gray-400 truncate">{r.reason}</p>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[r.status]}`}>
                {r.status === "pending" ? "En attente" : r.status === "approved" ? "Approuvé" : "Refusé"}
              </span>
              {r.status === "pending" && (
                <div className="flex gap-1">
                  <button onClick={() => handleApprove(r.id)} className="p-1 rounded hover:bg-green-100 text-green-600"><Check className="w-4 h-4" /></button>
                  <button onClick={() => handleReject(r.id)} className="p-1 rounded hover:bg-red-100 text-red-600"><X className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-sm text-gray-500 py-8">Aucune demande</p>}
        </div>
      </div>
    </div>
  );
}
