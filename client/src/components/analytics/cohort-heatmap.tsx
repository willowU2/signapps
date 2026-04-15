"use client";

import React from "react";

interface CohortData {
  weekIndex: number;
  weekLabel: string;
  dayData: number[]; // retention percentages (0-100)
}

interface CohortHeatmapProps {
  data?: CohortData[];
  title?: string;
}

const CohortHeatmap: React.FC<CohortHeatmapProps> = ({
  data: customData,
  title = "Cohort Retention Heatmap",
}) => {
  // Default sample data: 8 weeks x 7 days
  const defaultData: CohortData[] = Array.from({ length: 8 }, (_, weekIdx) => ({
    weekIndex: weekIdx,
    weekLabel: `Week ${weekIdx + 1}`,
    dayData: Array.from({ length: 7 }, (_, dayIdx) => {
      // Simulated retention: starts at 100%, decreases exponentially
      const retention = Math.max(
        30,
        100 * Math.exp(-dayIdx * 0.15 - weekIdx * 0.05),
      );
      return Math.round(retention);
    }),
  }));

  const data = customData || defaultData;

  if (data.length === 0) {
    return (
      <div className="w-full bg-background rounded-lg border border-border p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-foreground mb-8">{title}</h2>
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
          <p>Aucune donnée de cohorte disponible</p>
        </div>
      </div>
    );
  }

  // Get color based on retention percentage
  const getHeatmapColor = (value: number) => {
    // Native blending with the app's primary color
    // Use an opacity between 0.05 and 1 based on the value
    const opacity = Math.max(0.05, value / 100);
    return `hsl(var(--primary) / ${opacity})`;
  };

  // Day labels: 0, 1, 2... days since cohort start
  const dayLabels = Array.from({ length: 7 }, (_, i) => `Day ${i}`);

  // Find min and max for legend
  const allValues = data.flatMap((row) => row.dayData);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);

  return (
    <div className="w-full bg-background rounded-lg border border-border p-8 shadow-sm overflow-x-auto">
      {/* Header */}
      <h2 className="text-2xl font-bold text-foreground mb-8">{title}</h2>

      {/* Heatmap container */}
      <div className="inline-block min-w-full">
        {/* Column headers (days) */}
        <div className="flex mb-2">
          <div className="w-24 flex-shrink-0"></div>
          {dayLabels.map((label, idx) => (
            <div
              key={idx}
              className="w-12 flex-shrink-0 text-center text-xs font-medium text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Heatmap rows */}
        <div className="space-y-1">
          {data.map((row) => (
            <div key={row.weekIndex} className="flex gap-1">
              {/* Week label */}
              <div className="w-24 flex-shrink-0 text-sm font-medium text-muted-foreground flex items-center">
                {row.weekLabel}
              </div>

              {/* Cells */}
              {row.dayData.map((value, dayIdx) => (
                <div
                  key={dayIdx}
                  // Text turns white only over very dark/opaque primary backgrounds to keep contrast sharp
                  className={`w-12 h-12 flex-shrink-0 rounded-md flex items-center justify-center text-xs font-semibold transition-all hover:scale-110 cursor-pointer ring-1 ring-inset ring-black/5 dark:ring-white/5 ${value > 60 ? "text-primary-foreground" : "text-foreground/80"}`}
                  style={{
                    backgroundColor: getHeatmapColor(value),
                  }}
                  title={`${value}% retention`}
                >
                  {value}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-8 flex items-center gap-4">
        <p className="text-sm font-medium text-muted-foreground">Low</p>
        <div className="flex gap-1 flex-1">
          {Array.from({ length: 10 }, (_, idx) => {
            const value = minValue + (idx / 9) * (maxValue - minValue);
            return (
              <div
                key={idx}
                className="h-6 flex-1 rounded"
                style={{
                  backgroundColor: getHeatmapColor(value),
                }}
                title={`${Math.round(value)}%`}
              />
            );
          })}
        </div>
        <p className="text-sm font-medium text-muted-foreground">High</p>
      </div>

      {/* Summary stats */}
      <div className="mt-6 pt-6 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Min Retention</p>
          <p className="text-lg font-bold text-foreground">
            {Math.round(minValue)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Max Retention</p>
          <p className="text-lg font-bold text-foreground">
            {Math.round(maxValue)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Avg Retention</p>
          <p className="text-lg font-bold text-foreground">
            {Math.round(
              allValues.reduce((a, b) => a + b, 0) / allValues.length,
            )}
            %
          </p>
        </div>
      </div>
    </div>
  );
};

export default CohortHeatmap;
