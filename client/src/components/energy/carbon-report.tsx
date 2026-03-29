"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, Zap, Flame, Truck } from "lucide-react";

interface CarbonSource {
  name: string;
  co2: number;
  icon: React.ReactNode;
  color: string;
}

interface CarbonReportProps {
  sources?: CarbonSource[];
  targetReduction?: number;
  currentReduction?: number;
}

export function CarbonReport({
  sources = [
    {
      name: "Électricité",
      co2: 4500,
      icon: <Zap className="h-5 w-5" />,
      color: "bg-blue-100 text-blue-700",
    },
    {
      name: "Gaz",
      co2: 3200,
      icon: <Flame className="h-5 w-5" />,
      color: "bg-orange-100 text-orange-700",
    },
    {
      name: "Transport",
      co2: 2100,
      icon: <Truck className="h-5 w-5" />,
      color: "bg-green-100 text-green-700",
    },
  ],
  targetReduction = 15,
  currentReduction = 8,
}: CarbonReportProps) {
  const totalCO2 = sources.reduce((sum, s) => sum + s.co2, 0);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Rapport Carbone</h2>

      {/* Total CO2 Display */}
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Émissions Totales CO₂
            </p>
            <p className="text-4xl font-bold text-emerald-700">
              {totalCO2.toLocaleString("fr-FR")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">tonnes équivalent CO₂</p>
          </div>
          <div className="text-right">
            <Badge className="gap-1 bg-emerald-200 text-emerald-800">
              <TrendingDown className="h-4 w-4" />
              {currentReduction}% réduction
            </Badge>
          </div>
        </div>
      </Card>

      {/* Breakdown by Source */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Répartition par Source</h3>
        <div className="space-y-3">
          {sources.map((source, idx) => {
            const percentage = (source.co2 / totalCO2) * 100;

            return (
              <Card key={idx} className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${source.color}`}>
                        {source.icon}
                      </div>
                      <div>
                        <p className="font-medium">{source.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {source.co2.toLocaleString("fr-FR")} t CO₂
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-muted-foreground">
                        {percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div
                      className={`h-2 rounded-full transition-all ${source.color.split(" ")[0]}`}
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: `hsl(${idx === 0 ? 200 : idx === 1 ? 35 : 120}, 70%, 50%)`,
                      }}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Reduction Target Progress */}
      <Card className="border-l-4 border-l-blue-500 p-6">
        <div className="space-y-4">
          <h3 className="font-semibold">Objectif de Réduction</h3>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Cible annuelle</span>
              <span className="font-bold">{targetReduction}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-200">
              <div
                className="h-3 rounded-full bg-blue-500 transition-all"
                style={{ width: `${(currentReduction / targetReduction) * 100}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Progression actuelle: {currentReduction}%</span>
            <span>Restant: {(targetReduction - currentReduction).toFixed(1)}%</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
