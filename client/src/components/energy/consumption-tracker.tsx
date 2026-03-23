"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";

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

export function ConsumptionTracker({ data }: ConsumptionTrackerProps) {
  const kWhDifference = data.currentMonth.kWh - data.previousMonth.kWh;
  const costDifference = data.currentMonth.cost - data.previousMonth.cost;
  const kWhChangePercent = Math.round(
    ((kWhDifference / data.previousMonth.kWh) * 100)
  );
  const costChangePercent = Math.round(
    ((costDifference / data.previousMonth.cost) * 100)
  );

  const isConsumptionUp = kWhDifference > 0;
  const isCostUp = costDifference > 0;

  return (
    <div className="space-y-4 w-full max-w-2xl">
      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-bold">Energy Consumption</h2>

        <div className="w-full h-48 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p className="text-sm font-medium">Line Chart Placeholder</p>
            <p className="text-xs text-muted-foreground mt-1">
              30-day consumption trend
            </p>
          </div>
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

          <Card className="p-4 bg-gray-50 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Previous Month</p>
              <span className="text-xs font-semibold bg-gray-200 text-gray-900 px-2 py-1 rounded">
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
              <p className={`text-lg font-semibold ${isConsumptionUp ? "text-red-500" : "text-green-500"}`}>
                {isConsumptionUp ? "+" : ""}{kWhDifference} kWh
              </p>
              <p className="text-sm text-muted-foreground">
                ({isConsumptionUp ? "+" : ""}{kWhChangePercent}%)
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
              <p className={`text-lg font-semibold ${isCostUp ? "text-red-500" : "text-green-500"}`}>
                {isCostUp ? "+" : ""}${costDifference.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">
                ({isCostUp ? "+" : ""}{costChangePercent}%)
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
