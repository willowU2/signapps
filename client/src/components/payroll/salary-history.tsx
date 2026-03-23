"use client";

import { useState } from "react";
import { TrendingUp, Gift, Edit3 } from "lucide-react";

interface SalaryEntry {
  id: string;
  date: string;
  amount: number;
  type: "increase" | "bonus" | "adjustment";
  description: string;
  baseSalary: number;
}

const DEFAULT_HISTORY: SalaryEntry[] = [
  {
    id: "1",
    date: "2026-03-01",
    amount: 4500,
    type: "increase",
    description: "Annual salary increase",
    baseSalary: 4500,
  },
  {
    id: "2",
    date: "2026-02-15",
    amount: 500,
    type: "bonus",
    description: "Q1 performance bonus",
    baseSalary: 4300,
  },
  {
    id: "3",
    date: "2026-01-01",
    amount: 4300,
    type: "increase",
    description: "Promotion adjustment",
    baseSalary: 4300,
  },
  {
    id: "4",
    date: "2025-12-20",
    amount: 1000,
    type: "bonus",
    description: "Year-end bonus",
    baseSalary: 4000,
  },
  {
    id: "5",
    date: "2025-09-01",
    amount: 200,
    type: "adjustment",
    description: "Cost of living adjustment",
    baseSalary: 4000,
  },
];

function getTypeIcon(type: string) {
  switch (type) {
    case "increase":
      return <TrendingUp className="w-4 h-4 text-green-600" />;
    case "bonus":
      return <Gift className="w-4 h-4 text-blue-600" />;
    case "adjustment":
      return <Edit3 className="w-4 h-4 text-orange-600" />;
    default:
      return null;
  }
}

function getTypeBadge(type: string) {
  switch (type) {
    case "increase":
      return (
        <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
          <TrendingUp className="w-3 h-3" />
          Increase
        </span>
      );
    case "bonus":
      return (
        <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
          <Gift className="w-3 h-3" />
          Bonus
        </span>
      );
    case "adjustment":
      return (
        <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">
          <Edit3 className="w-3 h-3" />
          Adjustment
        </span>
      );
    default:
      return null;
  }
}

export function SalaryHistory() {
  const [history] = useState<SalaryEntry[]>(DEFAULT_HISTORY);

  const chartData = history
    .slice()
    .reverse()
    .map((entry, index) => ({
      date: entry.date.substring(5),
      salary: entry.baseSalary,
      label: `${entry.date.substring(5)}: €${entry.baseSalary}`,
    }));

  const minSalary = Math.min(...history.map((h) => h.baseSalary)) - 200;
  const maxSalary = Math.max(...history.map((h) => h.baseSalary)) + 200;
  const range = maxSalary - minSalary;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Salary History</h2>
        <p className="text-gray-600">Salary adjustments and changes over time</p>
      </div>

      <div className="border rounded-lg p-6 bg-white">
        <h3 className="font-semibold text-gray-900 mb-4">Salary Evolution Chart</h3>
        <div className="h-48 flex items-end justify-between gap-2 px-2 pb-4 border-b">
          {chartData.map((data, index) => {
            const height = ((data.salary - minSalary) / range) * 100;
            return (
              <div
                key={index}
                className="flex-1 flex flex-col items-center gap-2"
              >
                <div
                  className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t hover:from-blue-600 hover:to-blue-500 transition-colors cursor-pointer group relative"
                  style={{ height: `${height}%`, minHeight: "20px" }}
                  title={data.label}
                >
                  <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    €{data.salary}
                  </div>
                </div>
                <p className="text-xs text-gray-600 text-center w-full truncate">
                  {data.date}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-100 border-b p-4">
          <h3 className="font-semibold text-gray-900">Salary Changes</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-white">
            <thead className="bg-gray-50 border-b sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Date
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Type
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Description
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-900">
                  Amount
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-900">
                  Base Salary
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{entry.date}</p>
                  </td>
                  <td className="px-4 py-3">
                    {getTypeBadge(entry.type)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700">{entry.description}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-green-700 font-semibold">
                      €{entry.amount.toFixed(2)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-gray-900 font-semibold">
                      €{entry.baseSalary.toFixed(2)}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
