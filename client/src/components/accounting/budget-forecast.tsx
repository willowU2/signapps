"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Edit2, Check } from "lucide-react";

interface CostCenter {
  id: string;
  name: string;
  budget: number;
  actual: number;
  months: { month: string; budget: number; actual: number }[];
}

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun"];

const INIT_CENTERS: CostCenter[] = [
  {
    id: "1", name: "Technologie", budget: 48000, actual: 43200,
    months: [
      { month: "Jan", budget: 8000, actual: 7200 }, { month: "Fév", budget: 8000, actual: 8100 },
      { month: "Mar", budget: 8000, actual: 7900 }, { month: "Avr", budget: 8000, actual: 7800 },
      { month: "Mai", budget: 8000, actual: 7100 }, { month: "Jun", budget: 8000, actual: 5100 },
    ],
  },
  {
    id: "2", name: "Commercial", budget: 30000, actual: 31500,
    months: [
      { month: "Jan", budget: 5000, actual: 4800 }, { month: "Fév", budget: 5000, actual: 5200 },
      { month: "Mar", budget: 5000, actual: 5700 }, { month: "Avr", budget: 5000, actual: 5400 },
      { month: "Mai", budget: 5000, actual: 5600 }, { month: "Jun", budget: 5000, actual: 4800 },
    ],
  },
  {
    id: "3", name: "Finance & RH", budget: 24000, actual: 22800,
    months: [
      { month: "Jan", budget: 4000, actual: 3900 }, { month: "Fév", budget: 4000, actual: 3800 },
      { month: "Mar", budget: 4000, actual: 3800 }, { month: "Avr", budget: 4000, actual: 3700 },
      { month: "Mai", budget: 4000, actual: 3800 }, { month: "Jun", budget: 4000, actual: 3800 },
    ],
  },
  {
    id: "4", name: "Direction", budget: 18000, actual: 17100,
    months: [
      { month: "Jan", budget: 3000, actual: 2800 }, { month: "Fév", budget: 3000, actual: 3000 },
      { month: "Mar", budget: 3000, actual: 2900 }, { month: "Avr", budget: 3000, actual: 2800 },
      { month: "Mai", budget: 3000, actual: 2900 }, { month: "Jun", budget: 3000, actual: 2700 },
    ],
  },
];

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const pct = (actual: number, budget: number) => budget > 0 ? ((actual / budget - 1) * 100).toFixed(1) : "0";

export function BudgetForecast() {
  const [centers, setCenters] = useState<CostCenter[]>(INIT_CENTERS);
  const [selectedCenter, setSelectedCenter] = useState<string>(INIT_CENTERS[0].id);
  const [editBudget, setEditBudget] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState("");

  const center = centers.find(c => c.id === selectedCenter)!;
  const totalBudget = centers.reduce((s, c) => s + c.budget, 0);
  const totalActual = centers.reduce((s, c) => s + c.actual, 0);
  const variance = totalActual - totalBudget;
  const isOverBudget = variance > 0;

  const chartData = center.months.map(m => ({
    name: m.month,
    Budget: m.budget,
    Réalisé: m.actual,
    Écart: m.actual - m.budget,
  }));

  const handleSaveBudget = (id: string) => {
    const val = Number(budgetInput);
    if (!isNaN(val) && val > 0) {
      setCenters(prev => prev.map(c => c.id === id ? { ...c, budget: val } : c));
    }
    setEditBudget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Budget prévisionnel par centre de coûts</h2>
          <p className="text-muted-foreground">Budget vs réalisé avec graphique comparatif</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-blue-600" /><span className="text-xs text-blue-700 font-medium">Budget total</span></div>
          <p className="text-2xl font-bold text-blue-900">{fmt(totalBudget)}</p>
        </div>
        <div className="rounded-lg border bg-muted p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground font-medium">Réalisé</span></div>
          <p className="text-2xl font-bold text-foreground">{fmt(totalActual)}</p>
        </div>
        <div className={`rounded-lg border p-4 ${isOverBudget ? "bg-red-50" : "bg-green-50"}`}>
          <div className="flex items-center gap-2 mb-1">
            {isOverBudget ? <TrendingUp className="w-4 h-4 text-red-600" /> : <TrendingDown className="w-4 h-4 text-green-600" />}
            <span className={`text-xs font-medium ${isOverBudget ? "text-red-700" : "text-green-700"}`}>Écart</span>
          </div>
          <p className={`text-2xl font-bold ${isOverBudget ? "text-red-900" : "text-green-900"}`}>
            {variance >= 0 ? "+" : ""}{fmt(variance)}
          </p>
          <p className={`text-xs ${isOverBudget ? "text-red-600" : "text-green-600"}`}>
            {isOverBudget ? `Dépassement de ${pct(totalActual, totalBudget)}%` : `Sous-consommation de ${Math.abs(Number(pct(totalActual, totalBudget)))}%`}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          {centers.map(c => {
            const over = c.actual > c.budget;
            const p = Math.min(100, Math.round((c.actual / c.budget) * 100));
            return (
              <div key={c.id} onClick={() => setSelectedCenter(c.id)} className={`rounded-lg border p-3 cursor-pointer transition-all ${selectedCenter === c.id ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950" : "bg-background hover:border-blue-200"}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-foreground">{c.name}</p>
                  {editBudget === c.id ? (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <input value={budgetInput} onChange={e => setBudgetInput(e.target.value)} className="w-24 border rounded px-1 py-0.5 text-xs" autoFocus />
                      <button onClick={() => handleSaveBudget(c.id)} className="p-0.5 text-green-600"><Check className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{fmt(c.budget)}</span>
                      <button onClick={e => { e.stopPropagation(); setEditBudget(c.id); setBudgetInput(String(c.budget)); }} className="p-0.5 hover:text-blue-600 text-gray-300"><Edit2 className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
                <div className="h-1.5 rounded-full bg-muted mb-1">
                  <div className={`h-full rounded-full transition-all ${over ? "bg-red-500" : "bg-blue-500"}`} style={{ width: `${p}%` }} />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Réalisé : {fmt(c.actual)}</span>
                  <span className={over ? "text-red-600 font-medium" : "text-green-600 font-medium"}>{p}%</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="md:col-span-2 rounded-lg border bg-background p-4">
          <h3 className="font-semibold text-foreground mb-4">{center.name} — Budget vs Réalisé (mensuel)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: unknown) => fmt(Number(v))} />
              <Legend />
              <Bar dataKey="Budget" fill="#93c5fd" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Réalisé" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => <Cell key={i} fill={entry.Réalisé > entry.Budget ? "#ef4444" : "#22c55e"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
