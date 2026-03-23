"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";

interface ESGScore {
  category: string;
  score: number;
  trend: "up" | "down" | "stable";
  color: string;
}

export default function ESGReporting() {
  const [scores] = useState<ESGScore[]>([
    {
      category: "Environmental",
      score: 78,
      trend: "up",
      color: "bg-green-100 text-green-800",
    },
    {
      category: "Social",
      score: 72,
      trend: "stable",
      color: "bg-blue-100 text-blue-800",
    },
    {
      category: "Governance",
      score: 85,
      trend: "up",
      color: "bg-purple-100 text-purple-800",
    },
  ]);

  const avgScore = (scores.reduce((sum, s) => sum + s.score, 0) / scores.length).toFixed(1);

  const getTrendIcon = (trend: string) => {
    if (trend === "up") return "📈";
    if (trend === "down") return "📉";
    return "➡️";
  };

  const handleExport = () => {
    alert("Generating ESG Report PDF...");
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-6 h-6 text-indigo-600" />
        <h2 className="text-2xl font-bold">ESG Reporting</h2>
      </div>

      {/* Overall Score */}
      <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
        <div className="text-center">
          <p className="text-sm text-indigo-600 mb-2">Overall ESG Score</p>
          <p className="text-5xl font-bold text-indigo-900">{avgScore}</p>
          <p className="text-sm text-indigo-600 mt-1">out of 100</p>
        </div>
      </div>

      {/* Score Cards */}
      <div className="grid gap-3">
        {scores.map((item) => (
          <div
            key={item.category}
            className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold">{item.category}</h3>
                <p className="text-sm text-gray-600">
                  Score: {item.score}/100
                </p>
              </div>
              <span className="text-xl">{getTrendIcon(item.trend)}</span>
            </div>

            {/* Score Bar */}
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full ${
                  item.score >= 80
                    ? "bg-green-500"
                    : item.score >= 70
                      ? "bg-yellow-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${item.score}%` }}
              ></div>
            </div>

            <div className="text-xs text-gray-500">
              {item.score >= 80
                ? "Excellent performance"
                : item.score >= 70
                  ? "Good performance"
                  : "Needs improvement"}
            </div>
          </div>
        ))}
      </div>

      {/* Trend Chart Placeholder */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="font-semibold mb-2 text-sm">Quarterly Trend</p>
        <div className="h-20 flex items-end gap-2 justify-around">
          {[65, 70, 75, 78].map((value, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center">
              <div
                className="w-full bg-indigo-500 rounded-t"
                style={{ height: `${(value / 80) * 100}%` }}
              ></div>
              <p className="text-xs text-gray-600 mt-1">Q{idx + 1}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Export Button */}
      <Button
        onClick={handleExport}
        className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700"
      >
        📄 Export Report
      </Button>
    </div>
  );
}
