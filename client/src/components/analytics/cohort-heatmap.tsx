'use client';

import React from 'react';

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
  title = 'Cohort Retention Heatmap',
}) => {
  // Default sample data: 8 weeks x 7 days
  const defaultData: CohortData[] = Array.from({ length: 8 }, (_, weekIdx) => ({
    weekIndex: weekIdx,
    weekLabel: `Week ${weekIdx + 1}`,
    dayData: Array.from({ length: 7 }, (_, dayIdx) => {
      // Simulated retention: starts at 100%, decreases exponentially
      const retention = Math.max(
        30,
        100 * Math.exp(-dayIdx * 0.15 - weekIdx * 0.05)
      );
      return Math.round(retention);
    }),
  }));

  const data = customData || defaultData;

  // Get color based on retention percentage
  const getHeatmapColor = (value: number) => {
    // Green (high) to Red (low): HSL-based
    const hue = (value / 100) * 120; // 0-120 (red to green)
    const saturation = Math.max(30, 50 + (value - 50) * 0.6);
    return `hsl(${hue}, ${saturation}%, 45%)`;
  };

  // Day labels: 0, 1, 2... days since cohort start
  const dayLabels = Array.from({ length: 7 }, (_, i) => `Day ${i}`);

  // Find min and max for legend
  const allValues = data.flatMap((row) => row.dayData);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);

  return (
    <div className="w-full bg-white rounded-lg border border-gray-200 p-8 shadow-sm overflow-x-auto">
      {/* Header */}
      <h2 className="text-2xl font-bold text-gray-900 mb-8">{title}</h2>

      {/* Heatmap container */}
      <div className="inline-block min-w-full">
        {/* Column headers (days) */}
        <div className="flex mb-2">
          <div className="w-24 flex-shrink-0"></div>
          {dayLabels.map((label, idx) => (
            <div
              key={idx}
              className="w-12 flex-shrink-0 text-center text-xs font-medium text-gray-600"
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
              <div className="w-24 flex-shrink-0 text-sm font-medium text-gray-700 flex items-center">
                {row.weekLabel}
              </div>

              {/* Cells */}
              {row.dayData.map((value, dayIdx) => (
                <div
                  key={dayIdx}
                  className="w-12 h-12 flex-shrink-0 rounded-md flex items-center justify-center text-xs font-semibold text-white transition-all hover:scale-110 cursor-pointer"
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
        <p className="text-sm font-medium text-gray-700">Low</p>
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
        <p className="text-sm font-medium text-gray-700">High</p>
      </div>

      {/* Summary stats */}
      <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-600">Min Retention</p>
          <p className="text-lg font-bold text-gray-900">{Math.round(minValue)}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Max Retention</p>
          <p className="text-lg font-bold text-gray-900">{Math.round(maxValue)}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Avg Retention</p>
          <p className="text-lg font-bold text-gray-900">
            {Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length)}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default CohortHeatmap;
