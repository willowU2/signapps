"use client";

import { useState } from "react";
import { Zap } from "lucide-react";

interface Metric {
  name: string;
  value: string;
  unit: string;
  benchmark: string;
  status: "good" | "fair" | "warning";
}

export default function GreenITScore() {
  const [metrics] = useState<Metric[]>([
    {
      name: "Energy per Request",
      value: "0.45",
      unit: "kWh/1M requests",
      benchmark: "<0.5 (Good)",
      status: "good",
    },
    {
      name: "PUE (Power Usage Effectiveness)",
      value: "1.25",
      unit: "ratio",
      benchmark: "<1.5 (Good)",
      status: "good",
    },
    {
      name: "Renewable Energy",
      value: "68",
      unit: "%",
      benchmark: ">60% (Good)",
      status: "good",
    },
    {
      name: "Carbon per GB Transferred",
      value: "12.5",
      unit: "g CO₂/GB",
      benchmark: "<15 (Fair)",
      status: "fair",
    },
  ]);

  const greenScore = 82;

  const recommendations = [
    "Upgrade to ARM-based servers (25-30% energy savings)",
    "Implement liquid cooling in data center",
    "Increase renewable energy contract to 80%+",
    "Optimize CDN for edge computing",
  ];

  const getStatusColor = (status: string) => {
    if (status === "good") return "bg-green-100 text-green-800";
    if (status === "fair") return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-6 h-6 text-yellow-600" />
        <h2 className="text-2xl font-bold">Green IT Score</h2>
      </div>

      {/* Main Score Gauge */}
      <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
        <div className="text-center mb-4">
          <p className="text-sm text-green-600 mb-1">Infrastructure Green Score</p>
          <div className="flex items-baseline justify-center gap-2">
            <p className="text-5xl font-bold text-green-900">{greenScore}</p>
            <p className="text-2xl text-green-600">/100</p>
          </div>
          <p className="text-xs text-green-600 mt-2">
            ✓ Above industry average (72)
          </p>
        </div>

        {/* Circular Gauge */}
        <div className="flex justify-center">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full border-4 border-border"></div>
            <div
              className="absolute inset-0 rounded-full border-4 border-transparent border-t-green-500 border-r-green-500"
              style={{
                transform: `rotate(${(greenScore / 100) * 360 - 90}deg)`,
              }}
            ></div>
            <div className="absolute inset-1 rounded-full bg-card flex items-center justify-center">
              <span className="font-bold text-sm">{greenScore}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-2">
        <p className="font-semibold text-sm text-muted-foreground">Key Metrics</p>
        {metrics.map((metric) => (
          <div
            key={metric.name}
            className="border rounded-lg p-3 bg-card hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium text-sm">{metric.name}</p>
                <p className="text-xs text-muted-foreground">{metric.benchmark}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(metric.status)}`}>
                {metric.status === "good"
                  ? "✓ Good"
                  : metric.status === "fair"
                    ? "⚠ Fair"
                    : "✗ Warning"}
              </span>
            </div>
            <p className="text-lg font-bold">
              {metric.value} <span className="text-xs text-muted-foreground font-normal">{metric.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="font-semibold text-sm text-blue-900 mb-2">Recommendations</p>
        <ul className="space-y-1 text-xs text-blue-900">
          {recommendations.map((rec, idx) => (
            <li key={idx} className="flex gap-2">
              <span>→</span>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
