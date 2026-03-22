"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Experiment {
  id: string;
  name: string;
  variants: {
    name: string;
    percentage: number;
    conversions: number;
  }[];
  status: "running" | "completed";
  winner?: string;
  startDate: Date;
  endDate?: Date;
}

const MOCK_EXPERIMENTS: Experiment[] = [
  {
    id: "1",
    name: "Checkout Flow A/B Test",
    variants: [
      { name: "Control (A)", percentage: 50, conversions: 1245 },
      { name: "New Flow (B)", percentage: 50, conversions: 1389 },
    ],
    status: "completed",
    winner: "New Flow (B)",
    startDate: new Date(Date.now() - 30 * 24 * 3600000),
    endDate: new Date(Date.now() - 5 * 24 * 3600000),
  },
  {
    id: "2",
    name: "Dark Mode Default",
    variants: [
      { name: "Light (A)", percentage: 50, conversions: 2156 },
      { name: "Dark (B)", percentage: 50, conversions: 2089 },
    ],
    status: "running",
    startDate: new Date(Date.now() - 14 * 24 * 3600000),
  },
  {
    id: "3",
    name: "Search Bar Placeholder",
    variants: [
      { name: "Default (A)", percentage: 33, conversions: 897 },
      { name: "Hint Text (B)", percentage: 33, conversions: 945 },
      { name: "Icon (C)", percentage: 34, conversions: 903 },
    ],
    status: "running",
    startDate: new Date(Date.now() - 7 * 24 * 3600000),
  },
  {
    id: "4",
    name: "Email Notification Frequency",
    variants: [
      { name: "Daily (A)", percentage: 50, conversions: 1567 },
      { name: "Weekly (B)", percentage: 50, conversions: 1634 },
    ],
    status: "completed",
    winner: "Weekly (B)",
    startDate: new Date(Date.now() - 60 * 24 * 3600000),
    endDate: new Date(Date.now() - 30 * 24 * 3600000),
  },
  {
    id: "5",
    name: "Onboarding Tour vs. Tooltips",
    variants: [
      { name: "Tour (A)", percentage: 50, conversions: 782 },
      { name: "Tooltips (B)", percentage: 50, conversions: 856 },
    ],
    status: "running",
    startDate: new Date(Date.now() - 3 * 24 * 3600000),
  },
];

const getStatusBadge = (status: "running" | "completed"): string => {
  return status === "running"
    ? "bg-blue-100 text-blue-700"
    : "bg-green-100 text-green-700";
};

const getStatusText = (status: "running" | "completed"): string => {
  return status === "running" ? "Running" : "Completed";
};

const getWinnerPercentage = (
  variants: Experiment["variants"],
  winner?: string
): { [key: string]: number } => {
  if (!winner) return {};

  const winnerVariant = variants.find((v) => v.name === winner);
  if (!winnerVariant) return {};

  const totalConversions = variants.reduce((sum, v) => sum + v.conversions, 0);
  const winnerConversions = winnerVariant.conversions;

  return {
    improvement: ((winnerConversions - totalConversions / variants.length) / (totalConversions / variants.length)) * 100,
  };
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export function ABTesting() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setExperiments(MOCK_EXPERIMENTS);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return <div className="text-center text-gray-500">Loading experiments...</div>;
  }

  const runningCount = experiments.filter((e) => e.status === "running").length;
  const completedCount = experiments.filter(
    (e) => e.status === "completed"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">A/B Testing</h2>
        </div>
        <div className="space-x-6 text-sm text-gray-600">
          <span>
            <span className="font-semibold text-gray-900">{runningCount}</span>{" "}
            running
          </span>
          <span>
            <span className="font-semibold text-gray-900">{completedCount}</span>{" "}
            completed
          </span>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">New Experiment</Button>
      </div>

      {/* Experiments List */}
      <div className="space-y-4">
        {experiments.map((experiment) => (
          <div
            key={experiment.id}
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {experiment.name}
                </h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatDate(experiment.startDate)}
                    {experiment.endDate && ` - ${formatDate(experiment.endDate)}`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                    experiment.status
                  )}`}
                >
                  {getStatusText(experiment.status)}
                </span>

                {experiment.winner && (
                  <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                    ✓ Winner: {experiment.winner}
                  </span>
                )}
              </div>
            </div>

            {/* Variants */}
            <div className="space-y-3">
              {experiment.variants.map((variant, idx) => {
                const totalConversions = experiment.variants.reduce(
                  (sum, v) => sum + v.conversions,
                  0
                );
                const conversionRate =
                  ((variant.conversions / totalConversions) * 100).toFixed(1);

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-900">
                        {variant.name}
                      </span>
                      <span className="text-gray-600">
                        {variant.conversions.toLocaleString()} conversions
                        {experiment.winner === variant.name && (
                          <span className="ml-2 text-yellow-600 font-semibold">
                            🏆
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            experiment.winner === variant.name
                              ? "bg-yellow-500"
                              : "bg-blue-500"
                          }`}
                          style={{ width: `${conversionRate}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 w-12 text-right">
                        {variant.percentage}%
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
