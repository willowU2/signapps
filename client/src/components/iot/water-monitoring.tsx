"use client";

import { useState } from "react";
import { Droplet, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface WaterData {
  dailyConsumption: number[];
  monthlyConsumption: number[];
  isLeakDetected: boolean;
  leakLocation: string;
}

export default function WaterMonitoring() {
  const [waterData] = useState<WaterData>({
    dailyConsumption: [12, 15, 14, 18, 16, 19, 22],
    monthlyConsumption: [450, 480, 520, 510, 485, 490],
    isLeakDetected: true,
    leakLocation: "Floor 2 - Restroom",
  });

  const today =
    waterData.dailyConsumption[waterData.dailyConsumption.length - 1];
  const yesterday =
    waterData.dailyConsumption[waterData.dailyConsumption.length - 2];
  const percentChange = ((today - yesterday) / yesterday) * 100;

  const currentMonth =
    waterData.monthlyConsumption[waterData.monthlyConsumption.length - 1];
  const lastMonth =
    waterData.monthlyConsumption[waterData.monthlyConsumption.length - 2];
  const monthPercentChange = ((currentMonth - lastMonth) / lastMonth) * 100;

  const getDays = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(
        d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      );
    }
    return days;
  };

  const getMonths = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(
        d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      );
    }
    return months;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Droplet className="w-6 h-6" />
        Water Monitoring
      </h2>

      {waterData.isLeakDetected && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">Leak Detected</p>
            <p className="text-sm text-red-700">{waterData.leakLocation}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-4">
            Daily Consumption (Last 7 Days)
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Today: {today} L</span>
              <Badge
                className={percentChange > 0 ? "bg-red-500" : "bg-green-500"}
              >
                {percentChange > 0 ? "+" : ""}
                {percentChange.toFixed(1)}%
              </Badge>
            </div>
            <div className="flex gap-1 items-end h-32">
              {waterData.dailyConsumption.map((value, idx) => (
                <div
                  key={idx}
                  className="flex-1 bg-blue-500 rounded-t-sm relative group"
                  style={{ height: `${(value / 25) * 100}%` }}
                  title={`${getDays()[idx]}: ${value}L`}
                />
              ))}
            </div>
            <div className="text-xs text-muted-foreground text-center">
              {getDays().map((day, idx) => (
                <span key={idx} className={idx === 6 ? "font-semibold" : ""}>
                  {day}
                  {idx < 6 ? " • " : ""}
                </span>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-4">Monthly Comparison</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>This Month: {currentMonth} L</span>
              <Badge
                className={
                  monthPercentChange > 0 ? "bg-orange-500" : "bg-green-500"
                }
              >
                {monthPercentChange > 0 ? "+" : ""}
                {monthPercentChange.toFixed(1)}%
              </Badge>
            </div>
            <div className="flex gap-1 items-end h-32">
              {waterData.monthlyConsumption.map((value, idx) => (
                <div
                  key={idx}
                  className="flex-1 bg-green-500 rounded-t-sm"
                  style={{ height: `${(value / 550) * 100}%` }}
                  title={`${getMonths()[idx]}: ${value}L`}
                />
              ))}
            </div>
            <div className="text-xs text-muted-foreground text-center">
              {getMonths().map((month, idx) => (
                <span key={idx} className={idx === 5 ? "font-semibold" : ""}>
                  {month}
                  {idx < 5 ? " • " : ""}
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
