"use client";

import { AlertTriangle, AlertCircle } from "lucide-react";

interface Risk {
  id: string;
  name: string;
  description: string;
  probability: number;
  impact: number;
  owner: string;
  mitigation: string;
}

const DEFAULT_RISKS: Risk[] = [
  {
    id: "1",
    name: "Market Volatility",
    description: "Economic downturn affecting customer spending",
    probability: 3,
    impact: 5,
    owner: "CFO",
    mitigation: "Diversify revenue streams",
  },
  {
    id: "2",
    name: "Staff Turnover",
    description: "Loss of key technical talent",
    probability: 4,
    impact: 4,
    owner: "HR",
    mitigation: "Competitive compensation & career development",
  },
  {
    id: "3",
    name: "Cyber Security Breach",
    description: "Data breach or ransomware attack",
    probability: 2,
    impact: 5,
    owner: "IT",
    mitigation: "Enhanced security infrastructure & regular audits",
  },
  {
    id: "4",
    name: "Supply Chain Disruption",
    description: "Delays in product delivery",
    probability: 3,
    impact: 3,
    owner: "Operations",
    mitigation: "Maintain inventory buffer & alternate suppliers",
  },
  {
    id: "5",
    name: "Regulatory Changes",
    description: "New compliance requirements",
    probability: 2,
    impact: 3,
    owner: "Legal",
    mitigation: "Monitor regulatory updates & maintain compliance",
  },
];

function getRiskLevel(score: number): string {
  if (score <= 5) return "Low";
  if (score <= 10) return "Medium";
  if (score <= 16) return "High";
  return "Critical";
}

function getRiskColor(score: number): string {
  if (score <= 5) return "bg-green-50 border-green-200";
  if (score <= 10) return "bg-yellow-50 border-yellow-200";
  if (score <= 16) return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
}

function getHeatmapColor(p: number, i: number): string {
  const score = p * i;
  if (score <= 5) return "bg-green-500";
  if (score <= 10) return "bg-yellow-500";
  if (score <= 16) return "bg-orange-500";
  return "bg-red-600";
}

export function RiskRegister() {
  const risks = DEFAULT_RISKS;
  const sortedRisks = [...risks].sort(
    (a, b) => b.probability * b.impact - a.probability * a.impact
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Risk Register</h2>
          <p className="text-gray-600">
            Identify, assess, and mitigate organizational risks
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Risk Assessment</h3>
          <div className="overflow-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Risk</th>
                  <th className="px-3 py-2 text-center font-semibold">P</th>
                  <th className="px-3 py-2 text-center font-semibold">I</th>
                  <th className="px-3 py-2 text-center font-semibold">Score</th>
                  <th className="px-3 py-2 text-left font-semibold">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedRisks.map((risk) => {
                  const score = risk.probability * risk.impact;
                  return (
                    <tr
                      key={risk.id}
                      className={`border-l-4 ${getRiskColor(score)}`}
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-900">
                          {risk.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {risk.description}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-center font-semibold">
                        {risk.probability}
                      </td>
                      <td className="px-3 py-2 text-center font-semibold">
                        {risk.impact}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-sm">
                          <span>{score}</span>
                          <span className="text-xs font-normal text-gray-600">
                            ({getRiskLevel(score)})
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{risk.owner}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Risk Heatmap</h3>
          <div className="border rounded-lg p-4 bg-white">
            <div className="mb-4 text-xs text-gray-600 flex gap-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded" />
                <span>Low (1-5)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500 rounded" />
                <span>Medium (6-10)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded" />
                <span>High (11-16)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-600 rounded" />
                <span>Critical (17+)</span>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <td className="border p-1 text-center font-semibold">
                      P\I
                    </td>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <td
                        key={i}
                        className="border p-1 text-center font-semibold"
                      >
                        {i}
                      </td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[5, 4, 3, 2, 1].map((p) => (
                    <tr key={p}>
                      <td className="border p-1 text-center font-semibold">
                        {p}
                      </td>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <td
                          key={`${p}-${i}`}
                          className={`border p-2 text-center font-bold text-white ${getHeatmapColor(p, i)}`}
                        >
                          {p * i}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-gray-600">
              <strong>P:</strong> Probability (1-5) | <strong>I:</strong> Impact
              (1-5)
            </p>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-white">
        <h3 className="font-semibold text-gray-900 mb-3">
          Mitigation Strategies
        </h3>
        <div className="space-y-2">
          {sortedRisks.slice(0, 3).map((risk) => (
            <div
              key={risk.id}
              className="flex gap-3 p-2 rounded bg-gray-50 border"
            >
              <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{risk.name}</p>
                <p className="text-sm text-gray-600">{risk.mitigation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
