"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ConsumptionData {
  currentMonth: {
    kWh: number;
    cost: number;
  };
  previousMonth: {
    kWh: number;
    cost: number;
  };
}

interface ConsumptionTrackerProps {
  data: ConsumptionData;
}

// Generate a plausible 30-day trend from previousMonth to currentMonth
function buildChartData(
  prev: number,
  curr: number,
): { day: string; kWh: number }[] {
  const points: { day: string; kWh: number }[] = [];
  const dailyPrev = prev / 30;
  const dailyCurr = curr / 30;
  for (let i = 1; i <= 30; i++) {
    const t = i / 30;
    const base = dailyPrev + (dailyCurr - dailyPrev) * t;
    // Add slight variance (±8%)
    const variance = base * 0.08 * (Math.sin(i * 2.3) * 0.5 + 0.5 - 0.25);
    points.push({
      day: `D${i}`,
      kWh: parseFloat((base + variance).toFixed(1)),
    });
  }
  return points;
}

export function ConsumptionTracker({ data }: ConsumptionTrackerProps) {
  const kWhDifference = data.currentMonth.kWh - data.previousMonth.kWh;
  const costDifference = data.currentMonth.cost - data.previousMonth.cost;
  const kWhChangePercent = Math.round(
    (kWhDifference / data.previousMonth.kWh) * 100,
  );
  const costChangePercent = Math.round(
    (costDifference / data.previousMonth.cost) * 100,
  );

  const isConsumptionUp = kWhDifference > 0;
  const isCostUp = costDifference > 0;

  const chartData = buildChartData(
    data.previousMonth.kWh,
    data.currentMonth.kWh,
  );

  return (
    <div className="space-y-4 w-full max-w-2xl">
      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-bold">Energy Consumption</h2>

        {/* Real recharts LineChart */}
        <div className="w-full h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10 }}
                interval={4}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                unit=" kWh"
                width={60}
              />
              <Tooltip
                formatter={(v: unknown) =>
                  [`${v ?? 0} kWh`, "Consumption"] as [string, string]
                }
                contentStyle={{ fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="kWh"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4">
          <Card className="p-4 bg-blue-50 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Current Month</p>
              <span className="text-xs font-semibold bg-blue-200 text-blue-900 px-2 py-1 rounded">
                This Month
              </span>
            </div>
            <p className="text-2xl font-bold">{data.currentMonth.kWh} kWh</p>
            <p className="text-sm text-muted-foreground">
              ${data.currentMonth.cost.toFixed(2)}
            </p>
          </Card>

          <Card className="p-4 bg-muted space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Previous Month</p>
              <span className="text-xs font-semibold bg-gray-200 text-foreground px-2 py-1 rounded">
                Last Month
              </span>
            </div>
            <p className="text-2xl font-bold">{data.previousMonth.kWh} kWh</p>
            <p className="text-sm text-muted-foreground">
              ${data.previousMonth.cost.toFixed(2)}
            </p>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">kWh Change</p>
            <div className="flex items-center gap-2">
              {isConsumptionUp ? (
                <TrendingUp className="w-5 h-5 text-red-500" />
              ) : (
                <TrendingDown className="w-5 h-5 text-green-500" />
              )}
              <p
                className={`text-lg font-semibold ${isConsumptionUp ? "text-red-500" : "text-green-500"}`}
              >
                {isConsumptionUp ? "+" : ""}
                {kWhDifference} kWh
              </p>
              <p className="text-sm text-muted-foreground">
                ({isConsumptionUp ? "+" : ""}
                {kWhChangePercent}%)
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Cost Change</p>
            <div className="flex items-center gap-2">
              {isCostUp ? (
                <TrendingUp className="w-5 h-5 text-red-500" />
              ) : (
                <TrendingDown className="w-5 h-5 text-green-500" />
              )}
              <p
                className={`text-lg font-semibold ${isCostUp ? "text-red-500" : "text-green-500"}`}
              >
                {isCostUp ? "+" : ""}${costDifference.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">
                ({isCostUp ? "+" : ""}
                {costChangePercent}%)
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
