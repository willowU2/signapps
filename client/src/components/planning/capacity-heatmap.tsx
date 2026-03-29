"use client";

import { useState } from "react";

interface HeatmapCell {
  member: string;
  week: string;
  load: number;
}

export default function CapacityHeatmap() {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const teamMembers = ["Alice Chen", "Bob Martinez", "Carol Smith", "David Lee", "Eve Wilson"];
  const weeks = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];

  const heatmapData: HeatmapCell[] = [
    { member: "Alice Chen", week: "W1", load: 65 },
    { member: "Alice Chen", week: "W2", load: 72 },
    { member: "Alice Chen", week: "W3", load: 85 },
    { member: "Bob Martinez", week: "W1", load: 95 },
    { member: "Bob Martinez", week: "W2", load: 105 },
    { member: "Bob Martinez", week: "W3", load: 110 },
    { member: "Carol Smith", week: "W1", load: 55 },
    { member: "Carol Smith", week: "W2", load: 60 },
    { member: "Carol Smith", week: "W3", load: 68 },
    { member: "David Lee", week: "W1", load: 80 },
    { member: "David Lee", week: "W2", load: 88 },
    { member: "David Lee", week: "W3", load: 92 },
    { member: "Eve Wilson", week: "W1", load: 70 },
    { member: "Eve Wilson", week: "W2", load: 75 },
    { member: "Eve Wilson", week: "W3", load: 78 },
  ];

  const getColor = (load: number) => {
    if (load >= 100) return "bg-red-500 text-white";
    if (load >= 85) return "bg-orange-500 text-white";
    if (load >= 70) return "bg-yellow-400 text-foreground";
    if (load >= 50) return "bg-green-300 text-foreground";
    return "bg-green-100 text-foreground";
  };

  const getCellData = (member: string, week: string) => {
    return heatmapData.find((d) => d.member === member && d.week === week);
  };

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-2xl font-bold mb-4">Capacity Heatmap</h2>

      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="border p-2 bg-muted text-left font-bold w-24">Team</th>
              {weeks.map((week) => (
                <th key={week} className="border p-2 bg-muted text-center font-bold w-12">
                  {week}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teamMembers.map((member) => (
              <tr key={member}>
                <td className="border p-2 font-medium text-sm bg-muted">{member}</td>
                {weeks.map((week) => {
                  const cell = getCellData(member, week);
                  const key = `${member}-${week}`;
                  return (
                    <td
                      key={key}
                      className={`border p-2 text-center font-bold text-sm cursor-pointer transition-transform hover:scale-110 ${getColor(cell?.load || 0)}`}
                      onMouseEnter={() => setHoveredCell(key)}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {cell ? `${cell.load}%` : "-"}
                      {hoveredCell === key && cell && (
                        <div className="absolute bg-black text-white text-xs px-2 py-1 rounded mt-1 whitespace-nowrap">
                          {cell.member}: {cell.load}%
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-5 gap-2 text-xs">
        <div className="p-2 bg-red-500 text-white rounded font-medium text-center">&gt;=100%</div>
        <div className="p-2 bg-orange-500 text-white rounded font-medium text-center">85-99%</div>
        <div className="p-2 bg-yellow-400 text-foreground rounded font-medium text-center">70-84%</div>
        <div className="p-2 bg-green-300 text-foreground rounded font-medium text-center">50-69%</div>
        <div className="p-2 bg-green-100 text-foreground rounded font-medium text-center">&lt;50%</div>
      </div>
    </div>
  );
}
