"use client";

import { useState } from "react";
import { Plus, Check, X, Upload, Receipt, AlertCircle } from "lucide-react";

type ExpenseStatus = "pending" | "approved" | "rejected";

interface Expense {
  id: string;
  submittedBy: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  vatRate: number;
  hasReceipt: boolean;
  status: ExpenseStatus;
  notes?: string;
}

const CATEGORIES = [
  "Transport",
  "Hébergement",
  "Repas",
  "Fournitures",
  "Formation",
  "Télécom",
  "Autre",
];

const INIT_EXPENSES: Expense[] = [];
const STATUS_CONFIG: Record<ExpenseStatus, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700" },
  approved: { label: "Approuvée", color: "bg-green-100 text-green-700" },
  rejected: { label: "Refusée", color: "bg-red-100 text-red-700" },
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    n,
  );

export function ExpenseManagement() {
  const [expenses, setExpenses] = useState<Expense[]>(INIT_EXPENSES);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<ExpenseStatus | "all">("all");
  const [form, setForm] = useState({
    date: "",
    category: "Transport",
    description: "",
    amount: "",
    vatRate: "20",
    hasReceipt: false,
  });
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const filtered =
    filter === "all" ? expenses : expenses.filter((e) => e.status === filter);

  const totals = expenses.reduce(
    (acc, e) => {
      if (e.status === "approved") acc.approved += e.amount;
      if (e.status === "pending") acc.pending += e.amount;
      return acc;
    },
    { approved: 0, pending: 0 },
  );

  const handleSubmit = () => {
    if (!form.date || !form.description || !form.amount) return;
    setExpenses((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        submittedBy: "Moi",
        date: form.date,
        category: form.category,
        description: form.description,
        amount: Number(form.amount),
        vatRate: Number(form.vatRate),
        hasReceipt: form.hasReceipt,
        status: "pending",
      },
    ]);
    setShowForm(false);
    setForm({
      date: "",
      category: "Transport",
      description: "",
      amount: "",
      vatRate: "20",
      hasReceipt: false,
    });
  };

  const handleApprove = (id: string) =>
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "approved" } : e)),
    );

  const handleReject = () => {
    if (!rejectId) return;
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === rejectId ? { ...e, status: "rejected", notes: rejectNote } : e,
      ),
    );
    setRejectId(null);
    setRejectNote("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Gestion des notes de frais
          </h2>
          <p className="text-muted-foreground">
            Soumission, approbation et suivi des dépenses
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Nouvelle note de frais
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-green-50 p-4">
          <p className="text-xs text-green-700 font-medium">Approuvées</p>
          <p className="text-2xl font-bold text-green-900">
            {fmt(totals.approved)}
          </p>
          <p className="text-xs text-green-600">
            {expenses.filter((e) => e.status === "approved").length} notes
          </p>
        </div>
        <div className="rounded-lg border bg-amber-50 p-4">
          <p className="text-xs text-amber-700 font-medium">En attente</p>
          <p className="text-2xl font-bold text-amber-900">
            {fmt(totals.pending)}
          </p>
          <p className="text-xs text-amber-600">
            {expenses.filter((e) => e.status === "pending").length} notes
          </p>
        </div>
        <div className="rounded-lg border bg-red-50 p-4">
          <p className="text-xs text-red-700 font-medium">Sans justificatif</p>
          <p className="text-2xl font-bold text-red-900">
            {
              expenses.filter((e) => !e.hasReceipt && e.status !== "rejected")
                .length
            }
          </p>
          <p className="text-xs text-red-600">justificatifs manquants</p>
        </div>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-blue-50 p-5 space-y-4">
          <h3 className="font-semibold text-foreground">
            Nouvelle note de frais
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Catégorie
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                className="w-full border rounded px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">
                Description
              </label>
              <input
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Montant TTC (€)
              </label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
                className="w-full border rounded px-3 py-2 text-sm"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Taux TVA</label>
              <select
                value={form.vatRate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, vatRate: e.target.value }))
                }
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="0">0%</option>
                <option value="10">10%</option>
                <option value="20">20%</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.hasReceipt}
              onChange={(e) =>
                setForm((f) => ({ ...f, hasReceipt: e.target.checked }))
              }
              className="rounded"
            />
            <span className="text-sm text-muted-foreground">
              Justificatif joint
            </span>
            <Upload className="w-4 h-4 text-gray-400" />
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Soumettre
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="bg-gray-200 hover:bg-gray-300 text-muted-foreground px-4 py-2 rounded-lg text-sm font-medium"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {rejectId && (
        <div className="rounded-lg border bg-red-50 p-4 space-y-3">
          <p className="font-semibold text-red-700">Motif de refus</p>
          <input
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Expliquer le refus..."
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Confirmer le refus
            </button>
            <button
              onClick={() => setRejectId(null)}
              className="bg-gray-200 hover:bg-gray-300 text-muted-foreground px-4 py-2 rounded-lg text-sm font-medium"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-1 mb-4">
        {(["all", "pending", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === s ? "bg-foreground text-background" : "bg-muted hover:bg-muted/80 text-foreground"}`}
          >
            {s === "all" ? "Toutes" : STATUS_CONFIG[s as ExpenseStatus]?.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                Employé
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                Description
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                Catégorie
              </th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                Montant
              </th>
              <th className="px-4 py-3 text-center font-semibold text-muted-foreground">
                Justif.
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                Statut
              </th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((exp) => (
              <tr
                key={exp.id}
                className={`hover:bg-muted ${exp.status === "rejected" ? "opacity-60" : ""}`}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">
                    {exp.submittedBy}
                  </p>
                  <p className="text-xs text-muted-foreground">{exp.date}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {exp.description}
                  {exp.notes && (
                    <p className="text-xs text-red-500">{exp.notes}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                    {exp.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-foreground">
                  {fmt(exp.amount)}
                </td>
                <td className="px-4 py-3 text-center">
                  {exp.hasReceipt ? (
                    <Check className="w-4 h-4 text-green-600 mx-auto" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400 mx-auto" />
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[exp.status].color}`}
                  >
                    {STATUS_CONFIG[exp.status].label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {exp.status === "pending" && (
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => handleApprove(exp.id)}
                        className="p-1.5 hover:bg-green-100 rounded text-green-600"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setRejectId(exp.id)}
                        className="p-1.5 hover:bg-red-100 rounded text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
