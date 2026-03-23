"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface SprintData {
  day: number;
  ideal: number;
  actual: number;
}

export default function BurndownChart() {
  const [selectedSprint, setSelectedSprint] = useState("Sprint 12");

  const sprintData: Record<string, SprintData[]> = {
    "Sprint 12": [
      { day: 1, ideal: 100, actual: 95 },
      { day: 2, ideal: 85, actual: 88 },
      { day: 3, ideal: 70, actual: 72 },
      { day: 4, ideal: 55, actual: 50 },
      { day: 5, ideal: 40, actual: 42 },
      { day: 6, ideal: 25, actual: 28 },
      { day: 7, ideal: 10, actual: 5 },
    ],
    "Sprint 11": [
      { day: 1, ideal: 100, actual: 100 },
      { day: 2, ideal: 85, actual: 90 },
      { day: 3, ideal: 70, actual: 80 },
      { day: 4, ideal: 55, actual: 70 },
      { day: 5, ideal: 40, actual: 60 },
      { day: 6, ideal: 25, actual: 45 },
      { day: 7, ideal: 10, actual: 20 },
    ],
  };

  const data = sprintData[selectedSprint];
  const maxValue = 105;
  const chartHeight = 200;
  const chartWidth = 300;

  const scaleY = (value: number) => (chartHeight * value) / maxValue;
  const scaleX = (index: number) => (chartWidth / (data.length - 1)) * index;

  const idealPath = data
    .map((d, i) => `${scaleX(i)},${chartHeight - scaleY(d.ideal)}`)
    .join("L");

  const actualPath = data
    .map((d, i) => `${scaleX(i)},${chartHeight - scaleY(d.actual)}`)
    .join("L");

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Burndown Chart</h2>
        <select
          value={selectedSprint}
          onChange={(e) => setSelectedSprint(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          {Object.keys(sprintData).map((sprint) => (
            <option key={sprint} value={sprint}>
              {sprint}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white p-4 rounded-lg border">
        <svg width="100%" height={chartHeight + 30} viewBox={`0 0 ${chartWidth + 40} ${chartHeight + 30}`} className="mx-auto">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((val) => (
            <line
              key={`grid-${val}`}
              x1="30"
              y1={chartHeight + 10 - scaleY(val)}
              x2={chartWidth + 30}
              y2={chartHeight + 10 - scaleY(val)}
              stroke="#f0f0f0"
              strokeWidth="1"
            />
          ))}

          {/* Ideal line */}
          <polyline
            points={`30,${chartHeight + 10} L${idealPath.split("L").map((p) => {
              const [x, y] = p.split(",");
              return `${parseFloat(x) + 30},${parseFloat(y) + 10}`;
            }).join(" L")}`}
            fill="none"
            stroke="#9ca3af"
            strokeWidth="2"
            strokeDasharray="5,5"
          />

          {/* Actual line */}
          <polyline
            points={`30,${chartHeight + 10} L${actualPath.split("L").map((p) => {
              const [x, y] = p.split(",");
              return `${parseFloat(x) + 30},${parseFloat(y) + 10}`;
            }).join(" L")}`}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
          />

          {/* Y-axis */}
          <line x1="30" y1="10" x2="30" y2={chartHeight + 10} stroke="#000" strokeWidth="1" />
          {/* X-axis */}
          <line x1="30" y1={chartHeight + 10} x2={chartWidth + 30} y2={chartHeight + 10} stroke="#000" strokeWidth="1" />
        </svg>
      </div>

      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-400" style={{ borderTop: "2px dashed #9ca3af" }} />
          <span>Ideal Burndown</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500" />
          <span>Actual Progress</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="p-2 bg-blue-50 rounded">Remaining: {data[data.length - 1].actual} story points</div>
        <div className="p-2 bg-gray-50 rounded">Ideal: {data[data.length - 1].ideal} story points</div>
      </div>
    </div>
  );
}
