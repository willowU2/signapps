"use client";

import { useState, useRef } from "react";
import { Upload, CheckCircle, AlertCircle, FileText, X, Download } from "lucide-react";

interface ParsedEntry {
  date: string;
  reference: string;
  account: string;
  label: string;
  debit: number;
  credit: number;
  valid: boolean;
  error?: string;
}

interface ImportStats {
  total: number;
  valid: number;
  errors: number;
  totalDebit: number;
  totalCredit: number;
}

const SAMPLE_CSV = `JournalCode;EcritureDate;CompteNum;CompteLib;EcritureLib;Debit;Credit
VTE;20260301;411000;Clients;Facture ABC Corp;3000.00;0.00
VTE;20260301;706000;Prestation services;Facture ABC Corp;0.00;3000.00
ACH;20260303;606000;Achats;Fournisseur IT;1200.00;0.00
ACH;20260303;401000;Fournisseurs;Fournisseur IT;0.00;1200.00
BNQ;20260307;641000;Salaires;Paie Mars 2026;18000.00;0.00
BNQ;20260307;512000;Banque;Paie Mars 2026;0.00;18000.00`;

function parseFEC(raw: string): { entries: ParsedEntry[]; stats: ImportStats } {
  const lines = raw.trim().split("\n").slice(1).filter(l => l.trim());
  const entries: ParsedEntry[] = lines.map((line, i) => {
    const sep = line.includes(";") ? ";" : ",";
    const cols = line.split(sep).map(c => c.trim().replace(/"/g, ""));
    if (cols.length < 7) return { date: "", reference: "", account: "", label: "", debit: 0, credit: 0, valid: false, error: "Format invalide (colonnes insuffisantes)" };
    const rawDate = cols[1] || "";
    const date = rawDate.length === 8 ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : rawDate;
    const debit = parseFloat(cols[5]?.replace(",", ".") || "0") || 0;
    const credit = parseFloat(cols[6]?.replace(",", ".") || "0") || 0;
    const errors: string[] = [];
    if (!date || date.length < 8) errors.push("Date invalide");
    if (!cols[2]) errors.push("Compte manquant");
    if (debit === 0 && credit === 0) errors.push("Montant nul");
    return { date, reference: cols[0] || "", account: `${cols[2]} - ${cols[3]}`, label: cols[4] || "", debit, credit, valid: errors.length === 0, error: errors.join(", ") || undefined };
  });

  const valid = entries.filter(e => e.valid);
  return {
    entries,
    stats: {
      total: entries.length, valid: valid.length, errors: entries.length - valid.length,
      totalDebit: valid.reduce((s, e) => s + e.debit, 0),
      totalCredit: valid.reduce((s, e) => s + e.credit, 0),
    },
  };
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export function CsvFecImport() {
  const [step, setStep] = useState<"upload" | "preview" | "imported">("upload");
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const result = parseFEC(text);
      setEntries(result.entries);
      setStats(result.stats);
      setStep("preview");
    };
    reader.readAsText(file, "utf-8");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const file = new File([blob], "sample_fec.csv", { type: "text/csv" });
    handleFile(file);
  };

  const handleImport = () => setStep("imported");
  const handleReset = () => { setStep("upload"); setEntries([]); setStats(null); setFileName(""); };

  const isBalanced = stats ? Math.abs(stats.totalDebit - stats.totalCredit) < 0.01 : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Import écritures CSV / FEC</h2>
          <p className="text-muted-foreground">Parsez et créez des écritures depuis un fichier CSV ou FEC</p>
        </div>
        <button onClick={handleSample} className="flex items-center gap-2 border hover:bg-muted px-4 py-2 rounded-lg text-sm font-medium text-blue-600 border-blue-200">
          <Download className="w-4 h-4" /> Télécharger exemple
        </button>
      </div>

      {step === "upload" && (
        <div
          className={`rounded-xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer ${dragOver ? "border-blue-500 bg-blue-50" : "border-border hover:border-blue-400 hover:bg-muted"}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-semibold text-muted-foreground">Déposez votre fichier ici</p>
          <p className="text-sm text-muted-foreground mt-1">ou cliquez pour sélectionner</p>
          <p className="text-xs text-gray-400 mt-3">Formats supportés : CSV (séparateur ; ou ,), FEC (format DGFiP)</p>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      )}

      {(step === "preview" || step === "imported") && stats && (
        <>
          <div className="flex items-center gap-3 rounded-lg border bg-muted p-4">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium text-foreground">{fileName}</p>
              <p className="text-xs text-muted-foreground">{stats.total} lignes analysées</p>
            </div>
            {step !== "imported" && <button onClick={handleReset} className="p-1 hover:bg-gray-200 rounded text-muted-foreground"><X className="w-4 h-4" /></button>}
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-lg border bg-blue-50 p-4">
              <p className="text-xs text-blue-700 font-medium">Total lignes</p>
              <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
            </div>
            <div className="rounded-lg border bg-green-50 p-4">
              <p className="text-xs text-green-700 font-medium">Valides</p>
              <p className="text-2xl font-bold text-green-900">{stats.valid}</p>
            </div>
            <div className={`rounded-lg border p-4 ${stats.errors > 0 ? "bg-red-50" : "bg-muted"}`}>
              <p className={`text-xs font-medium ${stats.errors > 0 ? "text-red-700" : "text-muted-foreground"}`}>Erreurs</p>
              <p className={`text-2xl font-bold ${stats.errors > 0 ? "text-red-900" : "text-gray-400"}`}>{stats.errors}</p>
            </div>
            <div className={`rounded-lg border p-4 ${isBalanced ? "bg-green-50" : "bg-amber-50"}`}>
              <p className={`text-xs font-medium ${isBalanced ? "text-green-700" : "text-amber-700"}`}>Équilibre D/C</p>
              <div className="flex items-center gap-1 mt-1">
                {isBalanced ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-amber-600" />}
                <p className={`text-sm font-bold ${isBalanced ? "text-green-900" : "text-amber-900"}`}>{isBalanced ? "OK" : `Écart: ${fmt(Math.abs(stats.totalDebit - stats.totalCredit))}`}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-background overflow-hidden">
            <div className="bg-muted border-b px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-sm">Aperçu des écritures ({entries.length})</h3>
              {step === "preview" && (
                <button onClick={handleImport} disabled={stats.valid === 0} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Importer {stats.valid} écriture{stats.valid > 1 ? "s" : ""}
                </button>
              )}
              {step === "imported" && <span className="flex items-center gap-1 text-sm text-green-700 font-medium"><CheckCircle className="w-4 h-4" /> Importé</span>}
            </div>
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs">
                <thead className="bg-muted border-b sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Date</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Réf.</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Compte</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Libellé</th>
                    <th className="px-3 py-2 text-right font-semibold text-blue-700">Débit</th>
                    <th className="px-3 py-2 text-right font-semibold text-red-700">Crédit</th>
                    <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((e, i) => (
                    <tr key={i} className={`hover:bg-muted ${!e.valid ? "bg-red-50" : ""}`}>
                      <td className="px-3 py-2 text-muted-foreground">{e.date}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{e.reference}</td>
                      <td className="px-3 py-2 text-muted-foreground">{e.account}</td>
                      <td className="px-3 py-2 text-muted-foreground">{e.label}</td>
                      <td className="px-3 py-2 text-right text-blue-700 font-medium">{e.debit ? fmt(e.debit) : ""}</td>
                      <td className="px-3 py-2 text-right text-red-700 font-medium">{e.credit ? fmt(e.credit) : ""}</td>
                      <td className="px-3 py-2 text-center">
                        {e.valid ? <CheckCircle className="w-3.5 h-3.5 text-green-600 mx-auto" /> : <span className="text-red-600 text-xs" title={e.error}><AlertCircle className="w-3.5 h-3.5 mx-auto" /></span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
