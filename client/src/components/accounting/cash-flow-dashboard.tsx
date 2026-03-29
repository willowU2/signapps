"use client";

import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface CashEntry {
  date: string;
  label: string;
  amount: number;
  type: "in" | "out";
  category: string;
}

const ENTRIES: CashEntry[] = [
  { date: "2026-03-01", label: "Facture ABC Corp", amount: 8000, type: "in", category: "Ventes" },
  { date: "2026-03-03", label: "Loyer bureaux", amount: 3200, type: "out", category: "Charges fixes" },
  { date: "2026-03-05", label: "Facture XYZ SAS", amount: 5200, type: "in", category: "Ventes" },
  { date: "2026-03-07", label: "Salaires", amount: 18000, type: "out", category: "Masse salariale" },
  { date: "2026-03-10", label: "Facture DEF SARL", amount: 3100, type: "in", category: "Ventes" },
  { date: "2026-03-12", label: "Fournisseur IT", amount: 2400, type: "out", category: "Achats" },
  { date: "2026-03-15", label: "Abonnements SaaS", amount: 890, type: "out", category: "Charges fixes" },
  { date: "2026-03-17", label: "Facture GHI Tech", amount: 4500, type: "in", category: "Ventes" },
  { date: "2026-03-19", label: "Frais télécom", amount: 340, type: "out", category: "Charges fixes" },
  { date: "2026-03-21", label: "Remboursement client", amount: 800, type: "in", category: "Autres" },
  { date: "2026-03-24", label: "Formation équipe", amount: 1200, type: "out", category: "RH" },
  { date: "2026-03-26", label: "Facture JKL Group", amount: 6700, type: "in", category: "Ventes" },
  { date: "2026-04-01", label: "Loyer (prévision)", amount: 3200, type: "out", category: "Charges fixes" },
  { date: "2026-04-07", label: "Salaires (prévision)", amount: 18000, type: "out", category: "Masse salariale" },
  { date: "2026-04-10", label: "Encaissement prévu", amount: 12000, type: "in", category: "Ventes" },
  { date: "2026-04-15", label: "TVA Q1", amount: 3800, type: "out", category: "Taxes" },
];

const OPENING_BALANCE = 25000;

function buildChartData(entries: CashEntry[]) {
  let balance = OPENING_BALANCE;
  const grouped: Record<string, { in: number; out: number }> = {};
  entries.forEach(e => {
    if (!grouped[e.date]) grouped[e.date] = { in: 0, out: 0 };
    grouped[e.date][e.type] += e.amount;
  });
  return Object.entries(grouped).sort().map(([date, v]) => {
    balance += v.in - v.out;
    return { date: date.slice(5), Entrées: v.in, Sorties: v.out, Solde: balance };
  });
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function CashFlowDashboard() {
  const [view, setView] = useState<"area" | "bar">("area");
  const [periodFilter, setPeriodFilter] = useState<"march" | "april" | "all">("all");

  const filteredEntries = periodFilter === "all" ? ENTRIES
    : ENTRIES.filter(e => e.date.startsWith(periodFilter === "march" ? "2026-03" : "2026-04"));

  const chartData = buildChartData(filteredEntries);

  const totalIn = filteredEntries.filter(e => e.type === "in").reduce((s, e) => s + e.amount, 0);
  const totalOut = filteredEntries.filter(e => e.type === "out").reduce((s, e) => s + e.amount, 0);
  const netFlow = totalIn - totalOut;
  const currentBalance = OPENING_BALANCE + ENTRIES.filter(e => e.type === "in").reduce((s, e) => s + e.amount, 0)
    - ENTRIES.filter(e => e.type === "out").reduce((s, e) => s + e.amount, 0);

  const categoryOut = filteredEntries.filter(e => e.type === "out").reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Tableau de bord cash flow</h2>
          <p className="text-muted-foreground">Entrées/sorties et solde sur la ligne du temps</p>
        </div>
        <div className="flex gap-2">
          {(["all", "march", "april"] as const).map(p => (
            <button key={p} onClick={() => setPeriodFilter(p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${periodFilter === p ? "bg-foreground text-background" : "bg-muted hover:bg-muted/80 text-foreground"}`}>
              {p === "all" ? "Tout" : p === "march" ? "Mars" : "Avril"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-blue-600" /><span className="text-xs text-blue-700 font-medium">Solde actuel</span></div>
          <p className="text-2xl font-bold text-blue-900">{fmt(currentBalance)}</p>
        </div>
        <div className="rounded-lg border bg-green-50 p-4">
          <div className="flex items-center gap-2 mb-1"><ArrowUpRight className="w-4 h-4 text-green-600" /><span className="text-xs text-green-700 font-medium">Entrées</span></div>
          <p className="text-2xl font-bold text-green-900">{fmt(totalIn)}</p>
        </div>
        <div className="rounded-lg border bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-1"><ArrowDownRight className="w-4 h-4 text-red-600" /><span className="text-xs text-red-700 font-medium">Sorties</span></div>
          <p className="text-2xl font-bold text-red-900">{fmt(totalOut)}</p>
        </div>
        <div className={`rounded-lg border p-4 ${netFlow >= 0 ? "bg-emerald-50" : "bg-orange-50"}`}>
          <div className="flex items-center gap-2 mb-1">
            {netFlow >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : <TrendingDown className="w-4 h-4 text-orange-600" />}
            <span className={`text-xs font-medium ${netFlow >= 0 ? "text-emerald-700" : "text-orange-700"}`}>Flux net</span>
          </div>
          <p className={`text-2xl font-bold ${netFlow >= 0 ? "text-emerald-900" : "text-orange-900"}`}>{netFlow >= 0 ? "+" : ""}{fmt(netFlow)}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-background p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Évolution du cash flow</h3>
          <div className="flex gap-1">
            <button onClick={() => setView("area")} className={`px-3 py-1 rounded text-xs font-medium ${view === "area" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Aire</button>
            <button onClick={() => setView("bar")} className={`px-3 py-1 rounded text-xs font-medium ${view === "bar" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Barres</button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          {view === "area" ? (
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorSolde" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: unknown) => fmt(Number(v))} />
              <Legend />
              <Area type="monotone" dataKey="Solde" stroke="#3b82f6" fill="url(#colorSolde)" strokeWidth={2} />
              <Area type="monotone" dataKey="Entrées" stroke="#22c55e" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
              <Area type="monotone" dataKey="Sorties" stroke="#ef4444" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
            </AreaChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: unknown) => fmt(Number(v))} />
              <Legend />
              <Bar dataKey="Entrées" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Sorties" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-background overflow-hidden">
          <div className="bg-muted border-b px-4 py-3"><h3 className="font-semibold text-foreground text-sm">Sorties par catégorie</h3></div>
          <div className="divide-y">
            {Object.entries(categoryOut).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
              <div key={cat} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-gray-700">{cat}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-red-400" style={{ width: `${(amount / totalOut) * 100}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 w-20 text-right">{fmt(amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-background overflow-hidden">
          <div className="bg-muted border-b px-4 py-3"><h3 className="font-semibold text-foreground text-sm">Derniers mouvements</h3></div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {filteredEntries.slice(-8).reverse().map((e, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${e.type === "in" ? "bg-green-100" : "bg-red-100"}`}>
                  {e.type === "in" ? <ArrowUpRight className="w-3.5 h-3.5 text-green-600" /> : <ArrowDownRight className="w-3.5 h-3.5 text-red-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{e.label}</p>
                  <p className="text-xs text-gray-500">{e.date} · {e.category}</p>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${e.type === "in" ? "text-green-600" : "text-red-600"}`}>
                  {e.type === "in" ? "+" : "-"}{fmt(e.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
