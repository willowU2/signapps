"use client";

import { useState } from "react";
import { TrendingUp, Heart, Zap } from "lucide-react";

interface EnergyCheckIn {
  day: string;
  level: number;
  taskCount: number;
  timestamp: string;
}

const DEFAULT_DATA: EnergyCheckIn[] = [
  {
    day: "Mon",
    level: 4,
    taskCount: 8,
    timestamp: "2026-03-16 09:30",
  },
  {
    day: "Tue",
    level: 3,
    taskCount: 6,
    timestamp: "2026-03-17 10:15",
  },
  {
    day: "Wed",
    level: 5,
    taskCount: 12,
    timestamp: "2026-03-18 09:00",
  },
  {
    day: "Thu",
    level: 4,
    taskCount: 9,
    timestamp: "2026-03-19 10:45",
  },
  {
    day: "Fri",
    level: 2,
    taskCount: 4,
    timestamp: "2026-03-20 14:20",
  },
  {
    day: "Sat",
    level: 3,
    taskCount: 5,
    timestamp: "2026-03-21 11:00",
  },
  {
    day: "Sun",
    level: 4,
    taskCount: 7,
    timestamp: "2026-03-22 10:30",
  },
];

function getEnergyColor(level: number): string {
  switch (level) {
    case 5:
      return "bg-green-500";
    case 4:
      return "bg-green-400";
    case 3:
      return "bg-yellow-400";
    case 2:
      return "bg-orange-400";
    case 1:
      return "bg-red-500";
    default:
      return "bg-gray-300";
  }
}

function getEnergyLabel(level: number): string {
  switch (level) {
    case 5:
      return "Excellent";
    case 4:
      return "Good";
    case 3:
      return "Okay";
    case 2:
      return "Low";
    case 1:
      return "Exhausted";
    default:
      return "Unknown";
  }
}

export function EnergyTracker() {
  const [checkInData, setCheckInData] = useState<EnergyCheckIn[]>(DEFAULT_DATA);
  const [selectedLevel, setSelectedLevel] = useState<number>(0);

  const handleQuickCheckIn = (level: number) => {
    setSelectedLevel(level);
    const now = new Date();
    const today = now.toLocaleDateString("en-US", { weekday: "short" });
    const timestamp = now.toLocaleString();

    const newCheckIn: EnergyCheckIn = {
      day: today,
      level,
      taskCount: Math.floor(Math.random() * 8) + 4,
      timestamp,
    };

    setCheckInData([...checkInData, newCheckIn]);
    setTimeout(() => setSelectedLevel(0), 1500);
  };

  const avgEnergy =
    checkInData.length > 0
      ? (
          checkInData.reduce((sum, d) => sum + d.level, 0) / checkInData.length
        ).toFixed(1)
      : 0;

  const correlation = checkInData.length > 1
    ? "Strong positive correlation with completed tasks"
    : "Gathering data...";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Energy Tracker</h2>
          <p className="text-gray-600">3-click check-in for daily energy levels</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Average Energy</p>
          <p className="text-3xl font-bold text-green-600">{avgEnergy}/5</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">How's your energy?</h3>
        <div className="flex gap-3 justify-center">
          {[1, 2, 3, 4, 5].map((level) => (
            <button
              key={level}
              onClick={() => handleQuickCheckIn(level)}
              className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-white transition-all transform hover:scale-110 ${
                selectedLevel === level ? "ring-4 ring-offset-2 ring-gray-400" : ""
              } ${getEnergyColor(level)}`}
            >
              {level}
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-gray-600 mt-3">
          1 = Exhausted → 5 = Excellent
        </p>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-50 border-b p-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">Weekly Chart</h3>
        </div>

        <div className="p-6">
          <div className="flex items-end justify-center gap-4 h-48">
            {checkInData.slice(-7).map((data, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2">
                <div
                  className={`w-12 ${getEnergyColor(data.level)} rounded-t`}
                  style={{ height: `${data.level * 40}px` }}
                  title={`${data.level}/5 - ${data.taskCount} tasks`}
                />
                <span className="text-xs font-medium text-gray-700">
                  {data.day}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-5 h-5 text-red-500" />
            <p className="text-sm font-medium text-gray-700">Check-ins</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {checkInData.length}
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <p className="text-sm font-medium text-gray-700">Task Correlation</p>
          </div>
          <p className="text-sm text-gray-700 font-medium">{correlation}</p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-50 border-b p-4">
          <h3 className="font-semibold text-gray-900">Recent Check-ins</h3>
        </div>
        <div className="divide-y">
          {checkInData.slice().reverse().slice(0, 5).map((data, idx) => (
            <div
              key={idx}
              className="p-4 flex items-center justify-between hover:bg-gray-50"
            >
              <div>
                <p className="font-medium text-gray-900">{data.day}</p>
                <p className="text-xs text-gray-600">{data.timestamp}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {getEnergyLabel(data.level)}
                  </p>
                  <p className="text-xs text-gray-600">{data.taskCount} tasks</p>
                </div>
                <div
                  className={`w-8 h-8 rounded-full ${getEnergyColor(
                    data.level
                  )} flex items-center justify-center text-white font-bold text-sm`}
                >
                  {data.level}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
