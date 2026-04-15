"use client";

import { useState } from "react";
import { Flag } from "lucide-react";

interface RoadmapItem {
  id: string;
  name: string;
  type: "epic" | "release";
  start: number;
  duration: number;
  teams: string[];
  status: "planned" | "in-progress" | "completed";
}

export default function ProductRoadmap() {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const roadmapItems: RoadmapItem[] = [
    {
      id: "1",
      name: "Foundation",
      type: "release",
      start: 0,
      duration: 8,
      teams: ["Backend", "Frontend"],
      status: "completed",
    },
    {
      id: "2",
      name: "Core Features",
      type: "epic",
      start: 2,
      duration: 15,
      teams: ["Backend", "Frontend", "QA"],
      status: "in-progress",
    },
    {
      id: "3",
      name: "Mobile Optimization",
      type: "epic",
      start: 10,
      duration: 12,
      teams: ["Frontend", "Mobile"],
      status: "planned",
    },
    {
      id: "4",
      name: "v1.0 Release",
      type: "release",
      start: 8,
      duration: 3,
      teams: ["All"],
      status: "in-progress",
    },
    {
      id: "5",
      name: "Analytics Dashboard",
      type: "epic",
      start: 15,
      duration: 10,
      teams: ["Backend", "Frontend"],
      status: "planned",
    },
    {
      id: "6",
      name: "API Stability",
      type: "epic",
      start: 20,
      duration: 8,
      teams: ["Backend", "DevOps"],
      status: "planned",
    },
  ];

  const timelineMonths = 24;
  const monthWidth = 60;

  const getStatusColor = (status: RoadmapItem["status"]) => {
    const colors = {
      completed: "bg-green-500",
      "in-progress": "bg-blue-500",
      planned: "bg-gray-400",
    };
    return colors[status];
  };

  const getTypeIcon = (type: string) => {
    return type === "release" ? "📦" : "⭐";
  };

  return (
    <div className="space-y-4 p-4 overflow-x-auto">
      <h2 className="text-2xl font-bold mb-4">Product Roadmap</h2>

      <div className="min-w-max">
        {/* Timeline header */}
        <div className="flex mb-4">
          <div className="w-40" />
          {Array.from({ length: Math.ceil(timelineMonths / 3) }).map((_, i) => (
            <div
              key={i}
              style={{ width: monthWidth * 3 }}
              className="text-xs font-bold text-muted-foreground text-center"
            >
              Month {i * 3 + 1}-{Math.min(i * 3 + 3, timelineMonths)}
            </div>
          ))}
        </div>

        {/* Roadmap items */}
        {roadmapItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center h-12 mb-2 cursor-pointer hover:bg-muted rounded"
            onClick={() => setSelectedItem(item.id)}
          >
            <div className="w-40 flex items-center gap-2 font-medium text-sm truncate">
              <span>{getTypeIcon(item.type)}</span>
              <span>{item.name}</span>
            </div>
            <div className="relative flex-1 h-full bg-muted rounded">
              <div
                className={`absolute h-full rounded transition-all ${getStatusColor(item.status)}`}
                style={{
                  left: `${item.start * monthWidth}px`,
                  width: `${item.duration * monthWidth}px`,
                }}
              >
                <div className="flex items-center h-full px-2 text-white text-xs font-bold">
                  {item.name}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="flex gap-4 mt-8 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded" />
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-400 rounded" />
            <span>Planned</span>
          </div>
        </div>
      </div>

      {selectedItem && (
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mt-4">
          {roadmapItems
            .filter((item) => item.id === selectedItem)
            .map((item) => (
              <div key={item.id}>
                <p className="font-bold text-lg mb-2">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  Teams: {item.teams.join(", ")}
                </p>
                <p className="text-sm text-muted-foreground">
                  Status: {item.status}
                </p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
