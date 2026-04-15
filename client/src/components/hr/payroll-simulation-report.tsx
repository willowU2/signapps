"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { DollarSign, TrendingUp, Users, Download } from "lucide-react";

interface DeptPayroll {
  department: string;
  headcount: number;
  avgGross: number;
  totalGross: number;
  employeeCharges: number;
  employerCharges: number;
  netTotal: number;
  totalCost: number;
}

const BASE_DATA: DeptPayroll[] = [
  {
    department: "Technologie",
    headcount: 8,
    avgGross: 4200,
    totalGross: 33600,
    employeeCharges: 7728,
    employerCharges: 14112,
    netTotal: 25872,
    totalCost: 47712,
  },
  {
    department: "Commercial",
    headcount: 5,
    avgGross: 3600,
    totalGross: 18000,
    employeeCharges: 4140,
    employerCharges: 7560,
    netTotal: 13860,
    totalCost: 25560,
  },
  {
    department: "Finance",
    headcount: 3,
    avgGross: 3900,
    totalGross: 11700,
    employeeCharges: 2691,
    employerCharges: 4914,
    netTotal: 9009,
    totalCost: 16614,
  },
  {
    department: "RH",
    headcount: 2,
    avgGross: 3700,
    totalGross: 7400,
    employeeCharges: 1702,
    employerCharges: 3108,
    netTotal: 5698,
    totalCost: 10508,
  },
  {
    department: "Direction",
    headcount: 2,
    avgGross: 7500,
    totalGross: 15000,
    employeeCharges: 3450,
    employerCharges: 6300,
    netTotal: 11550,
    totalCost: 21300,
  },
];

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

export function PayrollSimulationReport() {
  const [employerRate, setEmployerRate] = useState(42);
  const [employeeRate, setEmployeeRate] = useState(23);

  const data: DeptPayroll[] = BASE_DATA.map((d) => ({
    ...d,
    employeeCharges: Math.round((d.totalGross * employeeRate) / 100),
    employerCharges: Math.round((d.totalGross * employerRate) / 100),
    netTotal: Math.round(d.totalGross * (1 - employeeRate / 100)),
    totalCost: Math.round(d.totalGross * (1 + employerRate / 100)),
  }));

  const totals = data.reduce(
    (acc, d) => ({
      headcount: acc.headcount + d.headcount,
      totalGross: acc.totalGross + d.totalGross,
      employeeCharges: acc.employeeCharges + d.employeeCharges,
      employerCharges: acc.employerCharges + d.employerCharges,
      netTotal: acc.netTotal + d.netTotal,
      totalCost: acc.totalCost + d.totalCost,
    }),
    {
      headcount: 0,
      totalGross: 0,
      employeeCharges: 0,
      employerCharges: 0,
      netTotal: 0,
      totalCost: 0,
    },
  );

  const chartData = data.map((d) => ({
    name: d.department.slice(0, 8),
    "Net Salarié": d.netTotal,
    "Charges Salarié": d.employeeCharges,
    "Charges Employeur": d.employerCharges,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Rapport de simulation de paie
          </h2>
          <p className="text-muted-foreground">
            Estimation des coûts salariaux par département
          </p>
        </div>
        <button className="flex items-center gap-2 border hover:bg-muted px-4 py-2 rounded-lg text-sm font-medium">
          <Download className="w-4 h-4" /> Exporter
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <label className="block text-sm font-semibold text-muted-foreground mb-2">
            Taux charges salariales :{" "}
            <span className="text-red-600 font-bold">{employeeRate}%</span>
          </label>
          <input
            type="range"
            value={employeeRate}
            onChange={(e) => setEmployeeRate(Number(e.target.value))}
            min={15}
            max={35}
            step={0.5}
            className="w-full accent-red-500"
          />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <label className="block text-sm font-semibold text-muted-foreground mb-2">
            Taux charges patronales :{" "}
            <span className="text-orange-600 font-bold">{employerRate}%</span>
          </label>
          <input
            type="range"
            value={employerRate}
            onChange={(e) => setEmployerRate(Number(e.target.value))}
            min={25}
            max={55}
            step={0.5}
            className="w-full accent-orange-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-blue-700 font-medium">
              Effectif total
            </span>
          </div>
          <p className="text-2xl font-bold text-blue-900">{totals.headcount}</p>
        </div>
        <div className="rounded-lg border bg-muted p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">
              Masse brute
            </span>
          </div>
          <p className="text-xl font-bold text-foreground">
            {fmt(totals.totalGross)}
          </p>
        </div>
        <div className="rounded-lg border bg-green-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="text-xs text-green-700 font-medium">
              Net versé
            </span>
          </div>
          <p className="text-xl font-bold text-green-900">
            {fmt(totals.netTotal)}
          </p>
        </div>
        <div className="rounded-lg border bg-purple-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            <span className="text-xs text-purple-700 font-medium">
              Coût employeur
            </span>
          </div>
          <p className="text-xl font-bold text-purple-900">
            {fmt(totals.totalCost)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold text-foreground mb-4">
          Répartition par département
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={chartData}
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
              tick={{ fontSize: 11 }}
            />
            <Tooltip formatter={(value: unknown) => fmt(Number(value))} />
            <Legend />
            <Bar dataKey="Net Salarié" stackId="a" fill="#22c55e" />
            <Bar dataKey="Charges Salarié" stackId="a" fill="#ef4444" />
            <Bar dataKey="Charges Employeur" stackId="a" fill="#f97316" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-lg border bg-background overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                  Département
                </th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">
                  ETP
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                  Brut total
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                  Ch. salariales
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                  Net versé
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                  Ch. patronales
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground bg-purple-50">
                  Coût total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((d) => (
                <tr key={d.department} className="hover:bg-muted">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {d.department}
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {d.headcount}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {fmt(d.totalGross)}
                  </td>
                  <td className="px-4 py-3 text-right text-red-600">
                    {fmt(d.employeeCharges)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600">
                    {fmt(d.netTotal)}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-600">
                    {fmt(d.employerCharges)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-purple-700 bg-purple-50">
                    {fmt(d.totalCost)}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted font-bold border-t-2">
                <td className="px-4 py-3">TOTAL</td>
                <td className="px-4 py-3 text-center">{totals.headcount}</td>
                <td className="px-4 py-3 text-right">
                  {fmt(totals.totalGross)}
                </td>
                <td className="px-4 py-3 text-right text-red-700">
                  {fmt(totals.employeeCharges)}
                </td>
                <td className="px-4 py-3 text-right text-green-700">
                  {fmt(totals.netTotal)}
                </td>
                <td className="px-4 py-3 text-right text-orange-700">
                  {fmt(totals.employerCharges)}
                </td>
                <td className="px-4 py-3 text-right text-purple-700 bg-purple-100">
                  {fmt(totals.totalCost)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
