"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Flame } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from(
  { length: 24 },
  (_, i) => `${i.toString().padStart(2, "0")}h`,
);

function genHeatmapData(): number[][] {
  return DAYS.map((_, dayIdx) =>
    HOURS.map((_, hour) => {
      // Realistic workday pattern
      const isWeekend = dayIdx >= 5;
      if (isWeekend) return Math.floor(Math.random() * 15);
      if (hour >= 9 && hour <= 11) return 60 + Math.floor(Math.random() * 40); // morning peak
      if (hour >= 14 && hour <= 17) return 55 + Math.floor(Math.random() * 35); // afternoon peak
      if (hour >= 12 && hour <= 13) return 30 + Math.floor(Math.random() * 20); // lunch dip
      if (hour >= 8 && hour <= 18) return 25 + Math.floor(Math.random() * 30);
      return Math.floor(Math.random() * 10);
    }),
  );
}

function getColor(value: number): string {
  if (value === 0) return "bg-muted/30";
  if (value < 15) return "bg-blue-200 dark:bg-blue-900/30";
  if (value < 30) return "bg-blue-400 dark:bg-blue-700/50";
  if (value < 50) return "bg-orange-400 dark:bg-orange-700/60";
  if (value < 75) return "bg-orange-500 dark:bg-orange-600";
  return "bg-red-500 dark:bg-red-600";
}

export function RequestHeatmap() {
  const data = useMemo(() => genHeatmapData(), []);
  const maxVal = useMemo(() => Math.max(...data.flat()), [data]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          Request Heatmap
        </CardTitle>
        <CardDescription className="text-xs">
          Activity by hour of day × day of week (req/min)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Hour labels */}
            <div className="flex mb-1">
              <div className="w-10 shrink-0" />
              {HOURS.filter((_, i) => i % 3 === 0).map((h) => (
                <div
                  key={h}
                  className="flex-1 text-center text-xs text-muted-foreground"
                  style={{ flexBasis: `${(3 / 24) * 100}%` }}
                >
                  {h}
                </div>
              ))}
            </div>
            {/* Grid */}
            {DAYS.map((day, dIdx) => (
              <div key={day} className="flex items-center mb-0.5">
                <div className="w-10 shrink-0 text-xs text-muted-foreground text-right pr-2">
                  {day}
                </div>
                {data[dIdx].map((val, hIdx) => (
                  <div
                    key={hIdx}
                    title={`${day} ${HOURS[hIdx]}: ${val} req/min`}
                    className={`flex-1 h-5 rounded-sm mr-0.5 ${getColor(val)} transition-all hover:opacity-80 cursor-default`}
                  />
                ))}
              </div>
            ))}
            {/* Legend */}
            <div className="flex items-center gap-2 mt-3 justify-end">
              <span className="text-xs text-muted-foreground">Low</span>
              {[
                "bg-blue-200 dark:bg-blue-900/30",
                "bg-blue-400 dark:bg-blue-700/50",
                "bg-orange-400 dark:bg-orange-700/60",
                "bg-orange-500",
                "bg-red-500",
              ].map((c, i) => (
                <div key={i} className={`h-3 w-6 rounded-sm ${c}`} />
              ))}
              <span className="text-xs text-muted-foreground">
                High ({maxVal})
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
