"use client";

import { useState } from "react";

interface Invoice {
  id: string;
  number: string;
  client_name: string;
  total_ttc: number;
  status: "draft" | "sent" | "paid" | "overdue";
  created_at: string;
  due_date: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-muted text-muted-foreground" },
  sent: { label: "Envoyee", color: "bg-blue-500/10 text-blue-500" },
  paid: { label: "Payee", color: "bg-green-500/10 text-green-500" },
  overdue: { label: "En retard", color: "bg-red-500/10 text-red-500" },
};

export default function BillingPage() {
  const [invoices] = useState<Invoice[]>([]);
  const [tab, setTab] = useState<"invoices" | "quotes">("invoices");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Facturation</h1>
        <button className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          + Nouvelle facture
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {(["invoices", "quotes"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {t === "invoices" ? "Factures" : "Devis"}
          </button>
        ))}
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <p className="text-lg">Aucune {tab === "invoices" ? "facture" : "devis"}</p>
          <p className="text-sm mt-1">Creez votre {tab === "invoices" ? "premiere facture" : "premier devis"} pour commencer</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 text-sm font-medium">Numero</th>
                <th className="text-left p-3 text-sm font-medium">Client</th>
                <th className="text-right p-3 text-sm font-medium">Montant TTC</th>
                <th className="text-left p-3 text-sm font-medium">Statut</th>
                <th className="text-left p-3 text-sm font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const st = STATUS_LABELS[inv.status] || STATUS_LABELS.draft;
                return (
                  <tr key={inv.id} className="border-t hover:bg-accent/50 transition-colors">
                    <td className="p-3 text-sm font-mono">{inv.number}</td>
                    <td className="p-3 text-sm">{inv.client_name}</td>
                    <td className="p-3 text-sm text-right font-mono">{inv.total_ttc.toFixed(2)} EUR</td>
                    <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span></td>
                    <td className="p-3 text-sm text-muted-foreground">{new Date(inv.created_at).toLocaleDateString("fr-FR")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
