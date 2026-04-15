import React from "react";
import { TrendingUp, BarChart3 } from "lucide-react";

interface MonthlySales {
  month: string;
  forecasted: number;
  confidence: number;
}

interface SeasonalTrend {
  quarter: string;
  trend: "up" | "down" | "stable";
  impact: string;
}

export const SalesForecast: React.FC = () => {
  const monthlySales: MonthlySales[] = [
    { month: "Apr", forecasted: 125000, confidence: 88 },
    { month: "May", forecasted: 132000, confidence: 85 },
    { month: "Jun", forecasted: 148000, confidence: 82 },
  ];

  const seasonalTrends: SeasonalTrend[] = [
    { quarter: "Q1", trend: "up", impact: "+12% vs baseline" },
    { quarter: "Q2", trend: "up", impact: "+18% vs baseline" },
    { quarter: "Q3", trend: "stable", impact: "+5% vs baseline" },
  ];

  const maxSales = Math.max(...monthlySales.map((m) => m.forecasted));
  const avgAccuracy = (
    monthlySales.reduce((sum, m) => sum + m.confidence, 0) / monthlySales.length
  ).toFixed(0);

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case "up":
        return "↑";
      case "down":
        return "↓";
      default:
        return "→";
    }
  };

  const getTrendColor = (trend: string): string => {
    switch (trend) {
      case "up":
        return "text-green-600";
      case "down":
        return "text-red-600";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="p-6 bg-card rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-green-500" />
        Sales Forecast
      </h2>

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          Monthly Forecast
        </h3>
        <div className="flex items-end justify-between gap-2 px-2 h-40">
          {monthlySales.map((month, idx) => {
            const barHeight = (month.forecasted / maxSales) * 140;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <div className="w-full flex items-end justify-center h-40 gap-1">
                  <div
                    className="flex-1 bg-green-500 rounded-t transition-all hover:bg-green-600"
                    style={{ height: `${barHeight}px` }}
                  />
                </div>
                <div className="mt-2 text-center">
                  <p className="text-xs font-semibold text-foreground">
                    {month.month}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ${(month.forecasted / 1000).toFixed(0)}k
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {month.confidence}% confidence
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t pt-4 mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          Seasonal Trends
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {seasonalTrends.map((trend, idx) => (
            <div
              key={idx}
              className="p-3 bg-muted border border-border rounded-lg"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {trend.quarter}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {trend.impact}
                  </p>
                </div>
                <span
                  className={`text-lg font-bold ${getTrendColor(trend.trend)}`}
                >
                  {getTrendIcon(trend.trend)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">
              Forecast Accuracy
            </p>
            <p className="text-2xl font-bold text-blue-600">{avgAccuracy}%</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">
              Avg Monthly Forecast
            </p>
            <p className="text-2xl font-bold text-purple-600">
              $
              {(
                monthlySales.reduce((sum, m) => sum + m.forecasted, 0) /
                monthlySales.length /
                1000
              ).toFixed(0)}
              k
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
