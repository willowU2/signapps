"use client";

import { useState } from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";

interface SupplierRisk {
  id: string;
  name: string;
  riskScore: number;
  factors: {
    concentration: number;
    geographic: number;
    dependency: number;
  };
  level: "low" | "medium" | "high" | "critical";
}

const DEFAULT_RISKS: SupplierRisk[] = [
  {
    id: "1",
    name: "TechSupply Inc",
    riskScore: 25,
    factors: {
      concentration: 15,
      geographic: 20,
      dependency: 40,
    },
    level: "low",
  },
  {
    id: "2",
    name: "Global Components",
    riskScore: 52,
    factors: {
      concentration: 60,
      geographic: 45,
      dependency: 50,
    },
    level: "medium",
  },
  {
    id: "3",
    name: "Premium Parts Co",
    riskScore: 78,
    factors: {
      concentration: 85,
      geographic: 70,
      dependency: 75,
    },
    level: "high",
  },
  {
    id: "4",
    name: "Budget Suppliers",
    riskScore: 89,
    factors: {
      concentration: 95,
      geographic: 85,
      dependency: 88,
    },
    level: "critical",
  },
];

export default function RiskScoring() {
  const [suppliers] = useState<SupplierRisk[]>(DEFAULT_RISKS);

  const getRiskColor = (level: string) => {
    switch (level) {
      case "low":
        return "bg-green-100 border-green-300";
      case "medium":
        return "bg-yellow-100 border-yellow-300";
      case "high":
        return "bg-orange-100 border-orange-300";
      case "critical":
        return "bg-red-100 border-red-300";
      default:
        return "bg-muted border-border";
    }
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case "low":
        return "bg-green-600 text-white";
      case "medium":
        return "bg-yellow-600 text-white";
      case "high":
        return "bg-orange-600 text-white";
      case "critical":
        return "bg-red-600 text-white";
      default:
        return "bg-gray-600 text-white";
    }
  };

  const getRiskIcon = (level: string) => {
    if (level === "high" || level === "critical") {
      return <AlertTriangle className="h-5 w-5" />;
    }
    return <TrendingUp className="h-5 w-5" />;
  };

  return (
    <div className="space-y-4 p-6">
      <div className="rounded-lg border">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Supplier Risk Scoring</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 p-4">
          {suppliers.map((supplier) => (
            <div
              key={supplier.id}
              className={`rounded-lg border-2 p-4 ${getRiskColor(supplier.level)}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-full p-2 ${getRiskBadgeColor(supplier.level)}`}
                  >
                    {getRiskIcon(supplier.level)}
                  </div>
                  <div>
                    <h3 className="font-semibold">{supplier.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      Risk Assessment
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{supplier.riskScore}</div>
                  <span
                    className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getRiskBadgeColor(supplier.level)}`}
                  >
                    {supplier.level.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">
                      Concentration Risk
                    </span>
                    <span className="text-xs font-semibold">
                      {supplier.factors.concentration}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-300 overflow-hidden">
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${supplier.factors.concentration}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">Geographic Risk</span>
                    <span className="text-xs font-semibold">
                      {supplier.factors.geographic}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-300 overflow-hidden">
                    <div
                      className="h-full bg-orange-500"
                      style={{ width: `${supplier.factors.geographic}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">Dependency Risk</span>
                    <span className="text-xs font-semibold">
                      {supplier.factors.dependency}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-300 overflow-hidden">
                    <div
                      className="h-full bg-yellow-500"
                      style={{ width: `${supplier.factors.dependency}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
