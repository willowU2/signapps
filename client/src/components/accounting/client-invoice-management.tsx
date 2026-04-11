"use client";

import { useState } from "react";
import { Plus, Send, Download, Eye, CheckCircle, Clock, AlertCircle, X } from "lucide-react";

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

interface InvoiceLine {
  id: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
}

interface Invoice {
  id: string;
  number: string;
  client: string;
  clientEmail: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  notes: string;
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: "Brouillon", color: "bg-muted text-muted-foreground", icon: <Clock className="w-3.5 h-3.5" /> },
  sent: { label: "Envoyée", color: "bg-blue-100 text-blue-700", icon: <Send className="w-3.5 h-3.5" /> },
  paid: { label: "Payée", color: "bg-green-100 text-green-700", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  overdue: { label: "En retard", color: "bg-red-100 text-red-700", icon: <AlertCircle className="w-3.5 h-3.5" /> },
};

const INIT_INVOICES: Invoice[] = [];

function calcTotals(lines: InvoiceLine[]) {
  const ht = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const vat = lines.reduce((s, l) => s + l.qty * l.unitPrice * l.vatRate / 100, 0);
  return { ht, vat, ttc: ht + vat };
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export function ClientInvoiceManagement() {
  const [invoices, setInvoices] = useState<Invoice[]>(INIT_INVOICES);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newInvoice, setNewInvoice] = useState({ client: "", clientEmail: "", dueDate: "", notes: "" });

  const filtered = statusFilter === "all" ? invoices : invoices.filter(i => i.status === statusFilter);

  const totals = invoices.reduce((acc, inv) => {
    const { ttc } = calcTotals(inv.lines);
    if (inv.status === "paid") acc.paid += ttc;
    if (inv.status === "overdue") acc.overdue += ttc;
    if (inv.status === "sent") acc.pending += ttc;
    return acc;
  }, { paid: 0, overdue: 0, pending: 0 });

  const handleStatusChange = (id: string, status: InvoiceStatus) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const handleCreate = () => {
    if (!newInvoice.client) return;
    const n = invoices.length + 1;
    setInvoices(prev => [...prev, {
      id: String(Date.now()), number: `FA-2026-${String(n).padStart(3, "0")}`,
      client: newInvoice.client, clientEmail: newInvoice.clientEmail,
      issueDate: new Date().toISOString().split("T")[0], dueDate: newInvoice.dueDate,
      status: "draft", notes: newInvoice.notes, lines: [{ id: "l0", description: "", qty: 1, unit: "forfait", unitPrice: 0, vatRate: 20 }],
    }]);
    setShowCreate(false);
    setNewInvoice({ client: "", clientEmail: "", dueDate: "", notes: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Factures clients</h2>
          <p className="text-muted-foreground">Créer, envoyer et suivre les factures</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Nouvelle facture
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-green-50 p-4">
          <p className="text-xs text-green-700 font-medium">Encaissé</p>
          <p className="text-2xl font-bold text-green-900">{fmt(totals.paid)}</p>
        </div>
        <div className="rounded-lg border bg-blue-50 p-4">
          <p className="text-xs text-blue-700 font-medium">En attente</p>
          <p className="text-2xl font-bold text-blue-900">{fmt(totals.pending)}</p>
        </div>
        <div className="rounded-lg border bg-red-50 p-4">
          <p className="text-xs text-red-700 font-medium">En retard</p>
          <p className="text-2xl font-bold text-red-900">{fmt(totals.overdue)}</p>
        </div>
      </div>

      {showCreate && (
        <div className="rounded-lg border bg-blue-50 p-5 space-y-4">
          <h3 className="font-semibold text-foreground">Nouvelle facture</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium mb-1">Client</label><input value={newInvoice.client} onChange={e => setNewInvoice(f => ({ ...f, client: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium mb-1">Email client</label><input type="email" value={newInvoice.clientEmail} onChange={e => setNewInvoice(f => ({ ...f, clientEmail: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium mb-1">Échéance</label><input type="date" value={newInvoice.dueDate} onChange={e => setNewInvoice(f => ({ ...f, dueDate: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium mb-1">Notes</label><input value={newInvoice.notes} onChange={e => setNewInvoice(f => ({ ...f, notes: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Créer</button>
            <button onClick={() => setShowCreate(false)} className="bg-gray-200 hover:bg-gray-300 text-muted-foreground px-4 py-2 rounded-lg text-sm font-medium">Annuler</button>
          </div>
        </div>
      )}

      <div className="flex gap-1">
        {(["all", "draft", "sent", "paid", "overdue"] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? "bg-foreground text-background" : "bg-muted hover:bg-muted/80 text-foreground"}`}>
            {s === "all" ? "Toutes" : STATUS_CONFIG[s as InvoiceStatus]?.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">N°</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Client</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Montant TTC</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Émission</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Échéance</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Statut</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(inv => {
              const { ttc } = calcTotals(inv.lines);
              const cfg = STATUS_CONFIG[inv.status];
              return (
                <tr key={inv.id} className={`hover:bg-muted ${inv.status === "overdue" ? "bg-red-50/30" : ""}`}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-muted-foreground">{inv.number}</td>
                  <td className="px-4 py-3"><p className="font-medium text-foreground">{inv.client}</p><p className="text-xs text-muted-foreground">{inv.clientEmail}</p></td>
                  <td className="px-4 py-3 text-right font-bold text-foreground">{fmt(ttc)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.issueDate}</td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.dueDate || "—"}</td>
                  <td className="px-4 py-3"><span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit ${cfg.color}`}>{cfg.icon}{cfg.label}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setViewInvoice(inv)} className="p-1.5 hover:bg-muted rounded text-muted-foreground"><Eye className="w-4 h-4" /></button>
                      {inv.status === "draft" && <button onClick={() => handleStatusChange(inv.id, "sent")} className="p-1.5 hover:bg-blue-100 rounded text-blue-600" title="Envoyer"><Send className="w-4 h-4" /></button>}
                      {inv.status === "sent" && <button onClick={() => handleStatusChange(inv.id, "paid")} className="p-1.5 hover:bg-green-100 rounded text-green-600" title="Marquer payée"><CheckCircle className="w-4 h-4" /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {viewInvoice && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewInvoice(null)}>
          <div className="bg-background rounded-2xl p-6 max-w-lg w-full shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div><h3 className="text-xl font-bold">{viewInvoice.number}</h3><p className="text-muted-foreground">{viewInvoice.client}</p></div>
              <button onClick={() => setViewInvoice(null)}><X className="w-5 h-5 text-gray-400 hover:text-muted-foreground" /></button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted border-b sticky top-0 z-10">
                <tr><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-center">Qté</th><th className="px-3 py-2 text-right">PU</th><th className="px-3 py-2 text-right">Total HT</th></tr>
              </thead>
              <tbody className="divide-y">
                {viewInvoice.lines.map(l => (
                  <tr key={l.id}><td className="px-3 py-2">{l.description}</td><td className="px-3 py-2 text-center">{l.qty} {l.unit}</td><td className="px-3 py-2 text-right">{fmt(l.unitPrice)}</td><td className="px-3 py-2 text-right font-medium">{fmt(l.qty * l.unitPrice)}</td></tr>
                ))}
              </tbody>
            </table>
            {(() => { const { ht, vat, ttc } = calcTotals(viewInvoice.lines); return (
              <div className="space-y-1 text-sm border-t pt-3">
                <div className="flex justify-between"><span className="text-muted-foreground">HT</span><span>{fmt(ht)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TVA (20%)</span><span>{fmt(vat)}</span></div>
                <div className="flex justify-between font-bold text-lg border-t pt-1"><span>TTC</span><span>{fmt(ttc)}</span></div>
              </div>
            );})()}
          </div>
        </div>
      )}
    </div>
  );
}
