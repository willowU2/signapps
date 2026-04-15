"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame } from "lucide-react";

interface WidgetProps {
  widget: { config: Record<string, unknown> };
  isEditing: boolean;
}

// Generate 12 weeks of mock activity data
function generateHeatmapData(): number[][] {
  const weeks: number[][] = [];
  for (let w = 0; w < 12; w++) {
    const days: number[] = [];
    for (let d = 0; d < 7; d++) {
      // More activity on weekdays, less on weekends
      const isWeekend = d === 0 || d === 6;
      const base = isWeekend ? 1 : 4;
      const variance = isWeekend ? 3 : 8;
      days.push(Math.max(0, Math.floor(Math.random() * variance + base - 1)));
    }
    weeks.push(days);
  }
  return weeks;
}

function getColor(count: number): string {
  if (count === 0) return "bg-muted";
  if (count <= 2) return "bg-green-200 dark:bg-green-900";
  if (count <= 4) return "bg-green-400 dark:bg-green-700";
  if (count <= 7) return "bg-green-600 dark:bg-green-500";
  return "bg-green-800 dark:bg-green-400";
}

const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];

export function WidgetActivityHeatmap({ widget, isEditing }: WidgetProps) {
  const data = useMemo(() => generateHeatmapData(), []);
  const totalActivity = useMemo(
    () => data.flat().reduce((a, b) => a + b, 0),
    [data],
  );

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            Heatmap d&apos;activite
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {totalActivity} actions
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-0.5">
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 mr-1">
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                className="h-3 w-4 flex items-center justify-end text-[9px] text-muted-foreground"
              >
                {i % 2 === 1 ? label : ""}
              </div>
            ))}
          </div>
          {/* Grid */}
          {data.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((count, di) => (
                <div
                  key={di}
                  className={`h-3 w-3 rounded-[2px] ${getColor(count)} transition-colors`}
                  title={`${count} actions`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 mt-3 justify-end">
          <span className="text-[10px] text-muted-foreground mr-1">Moins</span>
          <div className="h-3 w-3 rounded-[2px] bg-muted" />
          <div className="h-3 w-3 rounded-[2px] bg-green-200 dark:bg-green-900" />
          <div className="h-3 w-3 rounded-[2px] bg-green-400 dark:bg-green-700" />
          <div className="h-3 w-3 rounded-[2px] bg-green-600 dark:bg-green-500" />
          <div className="h-3 w-3 rounded-[2px] bg-green-800 dark:bg-green-400" />
          <span className="text-[10px] text-muted-foreground ml-1">Plus</span>
        </div>
      </CardContent>
    </Card>
  );
}
