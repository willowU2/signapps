"use client";

import { useState } from "react";
import { Globe } from "lucide-react";

interface SDG {
  id: number;
  name: string;
  emoji: string;
  progress: number;
  contributions: number;
}

export default function OddTracker() {
  const [sdgs] = useState<SDG[]>([
    { id: 1, name: "No Poverty", emoji: "🤝", progress: 45, contributions: 120 },
    {
      id: 2,
      name: "Zero Hunger",
      emoji: "🥘",
      progress: 62,
      contributions: 180,
    },
    { id: 3, name: "Good Health", emoji: "🏥", progress: 55, contributions: 150 },
    {
      id: 4,
      name: "Quality Education",
      emoji: "📚",
      progress: 72,
      contributions: 200,
    },
    {
      id: 5,
      name: "Gender Equality",
      emoji: "♀️",
      progress: 68,
      contributions: 190,
    },
    {
      id: 6,
      name: "Clean Water",
      emoji: "💧",
      progress: 58,
      contributions: 170,
    },
    {
      id: 7,
      name: "Clean Energy",
      emoji: "⚡",
      progress: 75,
      contributions: 210,
    },
    {
      id: 8,
      name: "Decent Work",
      emoji: "💼",
      progress: 65,
      contributions: 185,
    },
    {
      id: 9,
      name: "Innovation",
      emoji: "🔬",
      progress: 70,
      contributions: 195,
    },
    {
      id: 10,
      name: "Reduced Inequalities",
      emoji: "⚖️",
      progress: 60,
      contributions: 175,
    },
    {
      id: 11,
      name: "Sustainable Cities",
      emoji: "🏙️",
      progress: 63,
      contributions: 180,
    },
    {
      id: 12,
      name: "Responsible Consumption",
      emoji: "♻️",
      progress: 71,
      contributions: 205,
    },
    {
      id: 13,
      name: "Climate Action",
      emoji: "🌍",
      progress: 77,
      contributions: 220,
    },
    {
      id: 14,
      name: "Life Below Water",
      emoji: "🐋",
      progress: 52,
      contributions: 160,
    },
    {
      id: 15,
      name: "Life on Land",
      emoji: "🌲",
      progress: 66,
      contributions: 188,
    },
    {
      id: 16,
      name: "Peace & Justice",
      emoji: "⚔️",
      progress: 57,
      contributions: 165,
    },
    {
      id: 17,
      name: "Partnerships",
      emoji: "🤲",
      progress: 64,
      contributions: 182,
    },
  ]);

  const avgProgress = (sdgs.reduce((sum, s) => sum + s.progress, 0) / sdgs.length).toFixed(1);
  const totalContributions = sdgs.reduce((sum, s) => sum + s.contributions, 0);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold">UN SDG Tracker</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-gray-600">Average Progress</p>
          <p className="text-2xl font-bold text-blue-900">{avgProgress}%</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-gray-600">Total Contributions</p>
          <p className="text-2xl font-bold text-green-900">{totalContributions}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {sdgs.map((sdg) => (
          <div
            key={sdg.id}
            className="p-3 rounded-lg border bg-white hover:shadow-md transition-shadow"
          >
            <div className="text-center mb-2">
              <p className="text-2xl mb-1">{sdg.emoji}</p>
              <p className="text-xs font-medium line-clamp-2">{sdg.name}</p>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-blue-500"
                style={{ width: `${sdg.progress}%` }}
              ></div>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-gray-700">{sdg.progress}%</p>
              <p className="text-xs text-gray-500">{sdg.contributions} pts</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-sm">
        <p className="text-purple-900">
          <strong>Great progress!</strong> Your company contributes to all 17 UN Sustainable
          Development Goals.
        </p>
      </div>
    </div>
  );
}
