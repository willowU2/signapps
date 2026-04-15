"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { TrendingDown } from "lucide-react";
import type { HardwareAsset } from "@/lib/api/it-assets";

interface Props {
  assets: HardwareAsset[];
}

// Simplified straight-line depreciation: 5 year life, salvage = 10% of cost
const DEFAULT_COST = 1000;
const DEFAULT_LIFE = 5;
const DEFAULT_SALVAGE_RATE = 0.1;

function estimateBookValue(asset: HardwareAsset): number {
  if (!asset.purchase_date) return DEFAULT_COST;
  const purchaseYear = new Date(asset.purchase_date).getFullYear();
  const currentYear = new Date().getFullYear();
  const age = Math.max(0, currentYear - purchaseYear);
  const cost = DEFAULT_COST;
  const salvage = cost * DEFAULT_SALVAGE_RATE;
  const annual = (cost - salvage) / DEFAULT_LIFE;
  return Math.max(salvage, cost - annual * age);
}

export function AssetNbvReport({ assets }: Props) {
  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    assets.forEach((a) => {
      const bv = estimateBookValue(a);
      map[a.type] = (map[a.type] ?? 0) + bv;
    });
    return Object.entries(map)
      .map(([type, total]) => ({ type, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total);
  }, [assets]);

  const yearlyTrend = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => {
      const year = currentYear - 5 + i;
      const total = assets.reduce((sum, a) => {
        if (!a.purchase_date) return sum;
        const purchaseYear = new Date(a.purchase_date).getFullYear();
        const age = Math.max(0, year - purchaseYear);
        const cost = DEFAULT_COST;
        const salvage = cost * DEFAULT_SALVAGE_RATE;
        const annual = (cost - salvage) / DEFAULT_LIFE;
        return sum + Math.max(salvage, cost - annual * age);
      }, 0);
      return { year: year.toString(), nbv: Math.round(total) };
    });
  }, [assets]);

  const totalNbv = byType.reduce((s, d) => s + d.total, 0);
  const totalCost = assets.length * DEFAULT_COST;
  const depreciationRate =
    totalCost > 0
      ? (((totalCost - totalNbv) / totalCost) * 100).toFixed(1)
      : "0";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-purple-500" />
          Net Book Value Report
        </CardTitle>
        <CardDescription>
          Estimated asset values using straight-line depreciation (5yr, 10%
          salvage)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {assets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingDown className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No assets to display</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  label: "Total NBV",
                  value: `€${totalNbv.toLocaleString()}`,
                  color: "text-blue-600",
                },
                {
                  label: "Original Cost",
                  value: `€${totalCost.toLocaleString()}`,
                  color: "text-foreground",
                },
                {
                  label: "Depreciated",
                  value: `${depreciationRate}%`,
                  color: "text-orange-600",
                },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="rounded-lg bg-muted/50 p-3 text-center"
                >
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-sm font-medium mb-3">NBV by Asset Type</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byType}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `€${v}`}
                    />
                    <Tooltip
                      formatter={(v) => [
                        `€${Number(v).toLocaleString()}`,
                        "NBV",
                      ]}
                    />
                    <Bar dataKey="total" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-3">Fleet NBV Over Time</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yearlyTrend}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `€${v}`}
                    />
                    <Tooltip
                      formatter={(v) => [
                        `€${Number(v).toLocaleString()}`,
                        "Fleet NBV",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="nbv"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
