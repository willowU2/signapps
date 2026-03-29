"use client";

import { useState } from "react";

interface VelocityData {
  sprint: string;
  completed: number;
}

export default function VelocityTracker() {
  const [showForecast, setShowForecast] = useState(true);

  const velocityData: VelocityData[] = [
    { sprint: "Sprint 7", completed: 32 },
    { sprint: "Sprint 8", completed: 38 },
    { sprint: "Sprint 9", completed: 35 },
    { sprint: "Sprint 10", completed: 42 },
    { sprint: "Sprint 11", completed: 40 },
    { sprint: "Sprint 12", completed: 45 },
  ];

  const average = Math.round(velocityData.reduce((sum, d) => sum + d.completed, 0) / velocityData.length);
  const maxVelocity = Math.max(...velocityData.map((d) => d.completed));
  const forecastSprints = [
    { sprint: "Sprint 13", velocity: average },
    { sprint: "Sprint 14", velocity: average },
  ];

  const allData = showForecast ? [...velocityData, ...forecastSprints] : velocityData;
  const chartHeight = 180;
  const barWidth = 100 / allData.length;
  const scale = chartHeight / (maxVelocity + 5);

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Velocity Tracker</h2>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showForecast}
            onChange={(e) => setShowForecast(e.target.checked)}
            className="w-4 h-4"
          />
          Show Forecast
        </label>
      </div>

      <div className="bg-card p-4 rounded-lg border">
        <svg width="100%" height={chartHeight + 50} viewBox={`0 0 ${allData.length * 50 + 50} ${chartHeight + 50}`}>
          {allData.map((data, idx) => {
            const velocity = "velocity" in data ? data.velocity : data.completed;
            const barHeight = velocity * scale;
            const x = idx * 50 + 25;
            const y = chartHeight - barHeight;
            const isForecast = idx >= velocityData.length;

            return (
              <g key={data.sprint}>
                <rect
                  x={x}
                  y={y}
                  width="40"
                  height={barHeight}
                  fill={isForecast ? "#d1d5db" : "#3b82f6"}
                  opacity={isForecast ? 0.6 : 1}
                />
                <text x={x + 20} y={y - 5} textAnchor="middle" fontSize="12" fontWeight="bold">
                  {"velocity" in data ? data.velocity : data.completed}
                </text>
                <text x={x + 20} y={chartHeight + 15} textAnchor="middle" fontSize="11" fill="#666">
                  {data.sprint}
                </text>
              </g>
            );
          })}

          {/* Average line */}
          <line x1="0" y1={chartHeight - average * scale} x2={allData.length * 50 + 50} y2={chartHeight - average * scale} stroke="#f59e0b" strokeWidth="2" strokeDasharray="5,5" />
          <text x="5" y={chartHeight - average * scale - 5} fontSize="11" fill="#f59e0b" fontWeight="bold">
            Avg: {average}
          </text>
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="p-3 bg-blue-50 rounded">
          <p className="text-xs text-muted-foreground">Current</p>
          <p className="text-xl font-bold text-blue-600">{velocityData[velocityData.length - 1].completed}</p>
        </div>
        <div className="p-3 bg-orange-50 rounded">
          <p className="text-xs text-muted-foreground">Average</p>
          <p className="text-xl font-bold text-orange-600">{average}</p>
        </div>
        <div className="p-3 bg-green-50 rounded">
          <p className="text-xs text-muted-foreground">Peak</p>
          <p className="text-xl font-bold text-green-600">{maxVelocity}</p>
        </div>
      </div>
    </div>
  );
}
