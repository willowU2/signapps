"use client";

import { useState } from "react";
import { Plus, Trash2, CheckCircle, AlertCircle, Save } from "lucide-react";

interface JournalLine {
  id: string;
  account: string;
  label: string;
  debit: number | "";
  credit: number | "";
}

interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  lines: JournalLine[];
  posted: boolean;
}

const ACCOUNTS = [
  "1.1.1 - Liquidités", "1.1.2 - Clients", "1.1.3 - Stock",
  "2.1.1 - Fournisseurs", "2.1.2 - Dettes CT",
  "4.1 - Ventes services", "4.2 - Ventes produits",
  "5.1.1 - Salaires", "5.1.2 - Loyer", "5.1.3 - Charges",
  "5.2 - COGS", "3.1 - Capital", "3.2 - Résultats cumulés",
];

const INIT_ENTRIES: JournalEntry[] = [
  {
    id: "je1", date: "2026-03-25", reference: "VTE-001", description: "Vente de services au client ABC",
    posted: true,
    lines: [
      { id: "l1", account: "1.1.2 - Clients", label: "Facture ABC Corp", debit: 3000, credit: "" },
      { id: "l2", account: "4.1 - Ventes services", label: "CA services Q1", debit: "", credit: 3000 },
    ],
  },
];

function newLine(): JournalLine {
  return { id: String(Date.now() + Math.random()), account: "", label: "", debit: "", credit: "" };
}

export function JournalEntry() {
  const [entries, setEntries] = useState<JournalEntry[]>(INIT_ENTRIES);
  const [draft, setDraft] = useState<JournalEntry>({
    id: "", date: new Date().toISOString().split("T")[0], reference: "", description: "",
    lines: [newLine(), newLine()], posted: false,
  });
  const [showForm, setShowForm] = useState(false);

  const totalDebit = draft.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = draft.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const updateLine = (id: string, field: keyof JournalLine, value: string | number) => {
    setDraft(d => ({ ...d, lines: d.lines.map(l => l.id === id ? { ...l, [field]: value } : l) }));
  };

  const addLine = () => setDraft(d => ({ ...d, lines: [...d.lines, newLine()] }));
  const removeLine = (id: string) => setDraft(d => ({ ...d, lines: d.lines.filter(l => l.id !== id) }));

  const handlePost = () => {
    if (!isBalanced || !draft.date || !draft.description) return;
    const newEntry = { ...draft, id: String(Date.now()), posted: true };
    // Persist to API (fire-and-forget; local state is source of truth)
    const totalDebit = draft.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = draft.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    fetch('/api/accounting/entries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: draft.date, reference: draft.reference, description: draft.description, lines: draft.lines, debit: totalDebit, credit: totalCredit }),
    }).catch(() => {});
    setEntries(prev => [...prev, newEntry]);
    setDraft({ id: "", date: new Date().toISOString().split("T")[0], reference: "", description: "", lines: [newLine(), newLine()], posted: false });
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Saisie d'écritures comptables</h2>
          <p className="text-muted-foreground">Débit/crédit avec vérification d'équilibre</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Nouvelle écriture
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-background p-5 space-y-4">
          <h3 className="font-semibold text-foreground">Nouvelle écriture</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
              <input type="date" value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Référence</label>
              <input value={draft.reference} onChange={e => setDraft(d => ({ ...d, reference: e.target.value }))} placeholder="VTE-001" className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
              <input value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="Description..." className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground w-48">Compte</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Libellé</th>
                  <th className="px-3 py-2 text-right font-semibold text-blue-700 w-28">Débit (€)</th>
                  <th className="px-3 py-2 text-right font-semibold text-red-700 w-28">Crédit (€)</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {draft.lines.map(line => (
                  <tr key={line.id}>
                    <td className="px-2 py-1.5">
                      <select value={line.account} onChange={e => updateLine(line.id, "account", e.target.value)} className="w-full border rounded px-2 py-1 text-xs">
                        <option value="">Choisir un compte...</option>
                        {ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={line.label} onChange={e => updateLine(line.id, "label", e.target.value)} className="w-full border rounded px-2 py-1 text-sm" placeholder="Libellé..." />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={line.debit} onChange={e => { updateLine(line.id, "debit", e.target.value ? Number(e.target.value) : ""); if (e.target.value) updateLine(line.id, "credit", ""); }} className="w-full border rounded px-2 py-1 text-sm text-right focus:ring-2 focus:ring-blue-300" min="0" step="0.01" placeholder="0.00" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={line.credit} onChange={e => { updateLine(line.id, "credit", e.target.value ? Number(e.target.value) : ""); if (e.target.value) updateLine(line.id, "debit", ""); }} className="w-full border rounded px-2 py-1 text-sm text-right focus:ring-2 focus:ring-red-300" min="0" step="0.01" placeholder="0.00" />
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => removeLine(line.id)} className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
                <tr className={`border-t-2 font-bold ${isBalanced ? "bg-green-50" : totalDebit > 0 ? "bg-red-50" : "bg-muted"}`}>
                  <td className="px-3 py-2 text-muted-foreground" colSpan={2}>
                    <button onClick={addLine} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"><Plus className="w-3.5 h-3.5" />Ajouter une ligne</button>
                  </td>
                  <td className="px-3 py-2 text-right text-blue-700">{totalDebit.toFixed(2)} €</td>
                  <td className="px-3 py-2 text-right text-red-700">{totalCredit.toFixed(2)} €</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          <div className={`flex items-center gap-3 p-3 rounded-lg ${isBalanced ? "bg-green-50 text-green-700" : totalDebit > 0 ? "bg-red-50 text-red-700" : "bg-muted text-muted-foreground"}`}>
            {isBalanced ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-sm font-medium">
              {isBalanced ? "Écriture équilibrée" : totalDebit > 0 ? `Déséquilibre : ${(totalDebit - totalCredit).toFixed(2)} €` : "Saisissez les montants débit/crédit"}
            </span>
            <button onClick={handlePost} disabled={!isBalanced} className="ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Save className="w-4 h-4" /> Valider l'écriture
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-background overflow-hidden">
        <div className="bg-muted border-b px-4 py-3"><h3 className="font-semibold text-foreground">Écritures enregistrées</h3></div>
        {entries.map(entry => (
          <div key={entry.id} className="border-b last:border-0">
            <div className="px-4 py-3 bg-muted flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs bg-background border rounded px-2 py-0.5">{entry.reference || "—"}</span>
                <span className="font-medium text-foreground text-sm">{entry.description}</span>
                <span className="text-xs text-muted-foreground">{entry.date}</span>
              </div>
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <table className="w-full text-xs">
              <tbody>
                {entry.lines.map(l => (
                  <tr key={l.id} className="border-t">
                    <td className="px-8 py-1.5 text-muted-foreground w-52">{l.account}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{l.label}</td>
                    <td className="px-3 py-1.5 text-right text-blue-700 w-24">{l.debit ? `${Number(l.debit).toFixed(2)} €` : ""}</td>
                    <td className="px-3 py-1.5 text-right text-red-700 w-24">{l.credit ? `${Number(l.credit).toFixed(2)} €` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {entries.length === 0 && <p className="text-center text-sm text-gray-400 py-8">Aucune écriture pour l'instant</p>}
      </div>
    </div>
  );
}
