"use client";

import { useState } from "react";
import {
  CheckCircle,
  AlertCircle,
  FileText,
  Download,
  Info,
} from "lucide-react";

interface VatLine {
  label: string;
  base: number;
  rate: number;
  vat: number;
  account: string;
}

interface VatPeriod {
  period: string;
  label: string;
  status: "draft" | "validated" | "submitted";
}

const SALES_LINES: VatLine[] = [];

const PURCHASE_LINES: VatLine[] = [];

const PERIODS: VatPeriod[] = [];

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    n,
  );
const fmtBase = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

export function VatDeclaration() {
  const [selectedPeriod, setSelectedPeriod] = useState("2026-Q1");
  const [status, setStatus] = useState<"draft" | "validated" | "submitted">(
    "draft",
  );
  const [adjustments, setAdjustments] = useState(0);

  const totalSalesBase = SALES_LINES.reduce((s, l) => s + l.base, 0);
  const totalSalesVat = SALES_LINES.reduce((s, l) => s + l.vat, 0);
  const totalPurchaseBase = PURCHASE_LINES.reduce((s, l) => s + l.base, 0);
  const totalPurchaseVat = PURCHASE_LINES.reduce((s, l) => s + l.vat, 0);
  const vatDue = totalSalesVat - totalPurchaseVat + adjustments;
  const isCredit = vatDue < 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Déclaration TVA assistée
          </h2>
          <p className="text-muted-foreground">
            Calculée automatiquement depuis les écritures comptables
          </p>
        </div>
        <button className="flex items-center gap-2 border hover:bg-muted px-4 py-2 rounded-lg text-sm font-medium">
          <Download className="w-4 h-4" /> Exporter CA3
        </button>
      </div>

      <div className="flex gap-3">
        {PERIODS.map((p) => (
          <button
            key={p.period}
            onClick={() => setSelectedPeriod(p.period)}
            className={`flex-1 rounded-lg border p-3 text-left transition-all ${selectedPeriod === p.period ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950" : "bg-background hover:border-blue-200"}`}
          >
            <p className="text-sm font-semibold text-foreground">{p.label}</p>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${p.status === "submitted" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
            >
              {p.status === "submitted" ? "Déposée" : "Brouillon"}
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-blue-50 p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">
          Les montants ci-dessous sont calculés automatiquement depuis les
          écritures validées du journal. Vérifiez les données avant de valider
          la déclaration.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border bg-background overflow-hidden">
          <div className="bg-green-50 dark:bg-green-950/30 border-b px-4 py-3">
            <h3 className="font-semibold text-green-900 dark:text-green-300">
              TVA collectée (Ventes)
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted border-b sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2 text-left text-muted-foreground">
                  Ligne
                </th>
                <th className="px-4 py-2 text-right text-muted-foreground">
                  Base HT
                </th>
                <th className="px-4 py-2 text-right text-muted-foreground">
                  Taux
                </th>
                <th className="px-4 py-2 text-right text-muted-foreground">
                  TVA
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {SALES_LINES.map((l) => (
                <tr key={l.account} className="hover:bg-muted">
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {l.label}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {fmtBase(l.base)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {l.rate}%
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-green-700">
                    {fmtBase(l.vat)}
                  </td>
                </tr>
              ))}
              <tr className="bg-green-50 font-bold border-t-2">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-4 py-2.5 text-right">
                  {fmtBase(totalSalesBase)}
                </td>
                <td />
                <td className="px-4 py-2.5 text-right text-green-700">
                  {fmtBase(totalSalesVat)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border bg-background overflow-hidden">
          <div className="bg-orange-50 dark:bg-orange-950/30 border-b px-4 py-3">
            <h3 className="font-semibold text-orange-900 dark:text-orange-300">
              TVA déductible (Achats)
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted border-b sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2 text-left text-muted-foreground">
                  Ligne
                </th>
                <th className="px-4 py-2 text-right text-muted-foreground">
                  Base HT
                </th>
                <th className="px-4 py-2 text-right text-muted-foreground">
                  Taux
                </th>
                <th className="px-4 py-2 text-right text-muted-foreground">
                  TVA
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {PURCHASE_LINES.map((l) => (
                <tr key={l.account} className="hover:bg-muted">
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {l.label}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {fmtBase(l.base)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {l.rate}%
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-orange-700">
                    {fmtBase(l.vat)}
                  </td>
                </tr>
              ))}
              <tr className="bg-orange-50 font-bold border-t-2">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-4 py-2.5 text-right">
                  {fmtBase(totalPurchaseBase)}
                </td>
                <td />
                <td className="px-4 py-2.5 text-right text-orange-700">
                  {fmtBase(totalPurchaseVat)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div
        className={`rounded-xl border-2 p-6 ${isCredit ? "bg-blue-50 border-blue-300" : "bg-red-50 border-red-300"}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-foreground">
              {isCredit ? "Crédit de TVA" : "TVA à décaisser"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              TVA collectée ({fmt(totalSalesVat)}) − TVA déductible (
              {fmt(totalPurchaseVat)})
            </p>
            <div className="mt-2 flex items-center gap-2">
              <label className="text-sm text-muted-foreground">
                Ajustement :
              </label>
              <input
                type="number"
                value={adjustments}
                onChange={(e) => setAdjustments(Number(e.target.value))}
                className="w-28 border rounded px-2 py-1 text-sm"
                step="0.01"
              />
            </div>
          </div>
          <p
            className={`text-4xl font-bold ${isCredit ? "text-blue-700" : "text-red-700"}`}
          >
            {fmt(Math.abs(vatDue))}
          </p>
        </div>
        {status === "draft" && (
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setStatus("validated")}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              <CheckCircle className="w-4 h-4" /> Valider la déclaration
            </button>
          </div>
        )}
        {status === "validated" && (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex items-center gap-2 text-green-700 bg-green-100 px-3 py-2 rounded-lg">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Déclaration validée</span>
            </div>
            <button
              onClick={() => setStatus("submitted")}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              <FileText className="w-4 h-4" /> Marquer comme déposée
            </button>
          </div>
        )}
        {status === "submitted" && (
          <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-100 px-3 py-2 rounded-lg w-fit">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Déclaration déposée</span>
          </div>
        )}
      </div>
    </div>
  );
}
