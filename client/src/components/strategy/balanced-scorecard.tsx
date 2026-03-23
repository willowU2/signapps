"use client";

import { TrendingUp, TrendingDown, Target } from "lucide-react";

interface KPI {
  id: string;
  name: string;
  target: number;
  actual: number;
  unit: string;
  status: "on-track" | "at-risk" | "off-track";
}

interface Perspective {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  kpis: KPI[];
}

const DEFAULT_PERSPECTIVES: Perspective[] = [
  {
    id: "financial",
    title: "Financial",
    icon: <TrendingUp className="w-5 h-5" />,
    color: "bg-blue-50 border-blue-200",
    kpis: [
      {
        id: "revenue",
        name: "Revenue Growth",
        target: 100000,
        actual: 85000,
        unit: "EUR",
        status: "at-risk",
      },
      {
        id: "margin",
        name: "Profit Margin",
        target: 25,
        actual: 22,
        unit: "%",
        status: "on-track",
      },
    ],
  },
  {
    id: "customer",
    title: "Customer",
    icon: <Target className="w-5 h-5" />,
    color: "bg-green-50 border-green-200",
    kpis: [
      {
        id: "satisfaction",
        name: "Customer Satisfaction",
        target: 95,
        actual: 92,
        unit: "%",
        status: "on-track",
      },
      {
        id: "retention",
        name: "Retention Rate",
        target: 90,
        actual: 88,
        unit: "%",
        status: "on-track",
      },
    ],
  },
  {
    id: "internal",
    title: "Internal Processes",
    icon: <TrendingDown className="w-5 h-5" />,
    color: "bg-purple-50 border-purple-200",
    kpis: [
      {
        id: "efficiency",
        name: "Process Efficiency",
        target: 85,
        actual: 78,
        unit: "%",
        status: "at-risk",
      },
      {
        id: "defects",
        name: "Defect Rate",
        target: 2,
        actual: 3.5,
        unit: "%",
        status: "off-track",
      },
    ],
  },
  {
    id: "learning",
    title: "Learning & Growth",
    icon: <Target className="w-5 h-5" />,
    color: "bg-orange-50 border-orange-200",
    kpis: [
      {
        id: "training",
        name: "Training Hours per Employee",
        target: 40,
        actual: 35,
        unit: "hrs",
        status: "on-track",
      },
      {
        id: "innovation",
        name: "Innovation Index",
        target: 80,
        actual: 75,
        unit: "pts",
        status: "on-track",
      },
    ],
  },
];

function getStatusColor(status: string): string {
  switch (status) {
    case "on-track":
      return "text-green-600 bg-green-50";
    case "at-risk":
      return "text-amber-600 bg-amber-50";
    case "off-track":
      return "text-red-600 bg-red-50";
    default:
      return "text-gray-600 bg-gray-50";
  }
}

function getProgressColor(status: string): string {
  switch (status) {
    case "on-track":
      return "bg-green-500";
    case "at-risk":
      return "bg-amber-500";
    case "off-track":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
}

export function BalancedScorecard() {
  const perspectives = DEFAULT_PERSPECTIVES;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Balanced Scorecard
          </h2>
          <p className="text-gray-600">
            Monitor KPIs across four strategic perspectives
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {perspectives.map((perspective) => (
          <div
            key={perspective.id}
            className={`rounded-lg border-2 p-5 ${perspective.color}`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="text-gray-700">{perspective.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900">
                {perspective.title}
              </h3>
            </div>

            <div className="space-y-4">
              {perspective.kpis.map((kpi) => {
                const percentage = (kpi.actual / kpi.target) * 100;
                return (
                  <div key={kpi.id} className="bg-white rounded p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {kpi.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Target: {kpi.target} {kpi.unit}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded ${getStatusColor(kpi.status)}`}
                      >
                        {kpi.actual} {kpi.unit}
                      </span>
                    </div>

                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(kpi.status)}`}
                        style={{
                          width: `${Math.min(percentage, 100)}%`,
                        }}
                      />
                    </div>

                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-500">
                        {percentage.toFixed(0)}% of target
                      </span>
                      <span className="text-xs font-medium text-gray-600">
                        {kpi.status.replace("-", " ")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
