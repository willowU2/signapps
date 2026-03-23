"use client";

import { useState } from "react";
import { BarChart3, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PeopleCountData {
  liveCount: number;
  dailyInOut: Array<{ hour: number; in: number; out: number }>;
  peakHour: number;
  peakCount: number;
  totalToday: number;
}

export default function PeopleCounter() {
  const [data] = useState<PeopleCountData>({
    liveCount: 145,
    dailyInOut: [
      { hour: 8, in: 25, out: 2 },
      { hour: 9, in: 35, out: 5 },
      { hour: 10, in: 18, out: 3 },
      { hour: 11, in: 15, out: 8 },
      { hour: 12, in: 20, out: 45 },
      { hour: 13, in: 40, out: 12 },
      { hour: 14, in: 22, out: 8 },
      { hour: 15, in: 12, out: 10 },
      { hour: 16, in: 8, out: 35 },
    ],
    peakHour: 9,
    peakCount: 35,
    totalToday: 195,
  });

  const getHourLabel = (hour: number) => {
    if (hour === 12) return "12PM";
    if (hour < 12) return `${hour}AM`;
    return `${hour - 12}PM`;
  };

  const maxFlow = Math.max(...data.dailyInOut.map((d) => Math.max(d.in, d.out)));

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <BarChart3 className="w-6 h-6" />
        People Counter
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100">
          <p className="text-sm text-gray-600 mb-1">Live Occupancy</p>
          <p className="text-4xl font-bold text-blue-600">{data.liveCount}</p>
          <p className="text-xs text-gray-600 mt-2">people in building</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100">
          <p className="text-sm text-gray-600 mb-1">Peak Hour</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-green-600">{getHourLabel(data.peakHour)}</p>
            <Badge className="bg-green-600 text-white">{data.peakCount} entries</Badge>
          </div>
          <p className="text-xs text-gray-600 mt-2">highest traffic</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100">
          <p className="text-sm text-gray-600 mb-1">Total Today</p>
          <p className="text-4xl font-bold text-purple-600">{data.totalToday}</p>
          <p className="text-xs text-gray-600 mt-2">entries & exits</p>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          In/Out Flow by Hour
        </h3>

        <div className="space-y-4">
          {data.dailyInOut.map((item, idx) => (
            <div key={idx}>
              <div className="flex justify-between items-center mb-1 text-sm">
                <span className="font-medium">{getHourLabel(item.hour)}</span>
                <span className="text-gray-600">
                  <span className="text-green-600 font-semibold">↓{item.in}</span> •{" "}
                  <span className="text-red-600 font-semibold">↑{item.out}</span>
                </span>
              </div>
              <div className="flex gap-1 h-6">
                <div
                  className="bg-green-500 rounded-l"
                  style={{ width: `${(item.in / maxFlow) * 50}%` }}
                  title={`In: ${item.in}`}
                />
                <div
                  className="bg-red-500 rounded-r"
                  style={{ width: `${(item.out / maxFlow) * 50}%` }}
                  title={`Out: ${item.out}`}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t text-xs text-gray-600 flex justify-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded" />
            Entries
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded" />
            Exits
          </div>
        </div>
      </Card>
    </div>
  );
}
