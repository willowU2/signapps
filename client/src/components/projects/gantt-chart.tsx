"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, ChevronDown } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ZoomLevel = "day" | "week" | "month";

interface GanttTask {
  id: string;
  title: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  progress: number;  // 0-100
  dependsOn?: string; // task ID
  color?: string;    // tailwind color
}

interface GanttChartProps {
  tasks: GanttTask[];
  onTaskClick?: (taskId: string) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SAMPLE_TASKS: GanttTask[] = [
  {
    id: "1",
    title: "Design & Requirements",
    startDate: "2026-03-22",
    endDate: "2026-03-28",
    progress: 100,
    color: "bg-blue-500",
  },
  {
    id: "2",
    title: "Backend Setup",
    startDate: "2026-03-25",
    endDate: "2026-04-08",
    progress: 60,
    dependsOn: "1",
    color: "bg-green-500",
  },
  {
    id: "3",
    title: "Frontend Components",
    startDate: "2026-03-29",
    endDate: "2026-04-15",
    progress: 40,
    dependsOn: "1",
    color: "bg-purple-500",
  },
  {
    id: "4",
    title: "Testing & QA",
    startDate: "2026-04-09",
    endDate: "2026-04-20",
    progress: 0,
    dependsOn: "2",
    color: "bg-orange-500",
  },
];

const ZOOM_CONFIG = {
  day: { pixelsPerDay: 60, dateFormat: "d MMM" },
  week: { pixelsPerDay: 12, dateFormat: "w 'W'" },
  month: { pixelsPerDay: 2.5, dateFormat: "MMM yyyy" },
};

// ── Utilities ──────────────────────────────────────────────────────────────

function getDateRange(tasks: GanttTask[]) {
  const dates = tasks.flatMap((t) => [new Date(t.startDate), new Date(t.endDate)]);
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
  minDate.setDate(minDate.getDate() - 2);
  maxDate.setDate(maxDate.getDate() + 2);
  return { minDate, maxDate };
}

function daysBetween(start: Date, end: Date): number {
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function daysFromStart(date: Date, startDate: Date): number {
  return Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Timeline Header ─────────────────────────────────────────────────────────

function TimelineHeader({
  minDate,
  maxDate,
  zoom,
}: {
  minDate: Date;
  maxDate: Date;
  zoom: ZoomLevel;
}) {
  const pixelsPerDay = ZOOM_CONFIG[zoom].pixelsPerDay;
  const totalDays = daysBetween(minDate, maxDate) + 1;
  const totalWidth = totalDays * pixelsPerDay;

  const dateLabels: { date: Date; label: string }[] = [];
  const current = new Date(minDate);

  while (current <= maxDate) {
    dateLabels.push({
      date: new Date(current),
      label: current.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
      }),
    });
    current.setDate(current.getDate() + (zoom === "month" ? 7 : zoom === "week" ? 1 : 1));
  }

  return (
    <div className="border-b bg-muted/30 sticky top-0 z-10">
      <div className="flex">
        <div className="w-48 border-r p-3 font-semibold text-sm">Task</div>
        <div className="flex-1 overflow-x-auto">
          <div style={{ width: totalWidth }} className="flex border-l text-xs text-muted-foreground">
            {dateLabels.map((item, idx) => (
              <div
                key={idx}
                style={{ width: pixelsPerDay }}
                className="border-r px-1 py-2 truncate text-center"
              >
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Task Bar Row ──────────────────────────────────────────────────────────

interface TaskRowProps {
  task: GanttTask;
  minDate: Date;
  zoom: ZoomLevel;
  hasDependency: boolean;
  onTaskClick?: (taskId: string) => void;
}

function TaskRow({ task, minDate, zoom, hasDependency, onTaskClick }: TaskRowProps) {
  const pixelsPerDay = ZOOM_CONFIG[zoom].pixelsPerDay;
  const taskStart = daysFromStart(new Date(task.startDate), minDate);
  const taskDuration = daysBetween(new Date(task.startDate), new Date(task.endDate)) + 1;
  const barWidth = taskDuration * pixelsPerDay;
  const barLeft = taskStart * pixelsPerDay;

  return (
    <div className="flex border-b hover:bg-muted/30 transition-colors">
      {/* Task label */}
      <div className="w-48 border-r p-3 text-sm font-medium truncate flex items-center gap-2">
        {hasDependency && <ChevronDown className="size-3 text-muted-foreground shrink-0" />}
        <span className="truncate">{task.title}</span>
      </div>

      {/* Timeline area */}
      <div className="flex-1 relative overflow-x-auto h-16 flex items-center">
        {/* Dependency arrow indicator */}
        {task.dependsOn && (
          <div className="absolute left-0 top-1 text-xs text-amber-600 ml-2">→</div>
        )}

        {/* Progress bar */}
        <div
          style={{
            left: barLeft,
            width: barWidth,
            minWidth: "2px",
          }}
          className={cn(
            "absolute h-8 rounded cursor-pointer transition-all hover:shadow-lg",
            task.color || "bg-blue-500",
            "opacity-80 hover:opacity-100"
          )}
          onClick={() => onTaskClick?.(task.id)}
          role="button"
          tabIndex={0}
        >
          {/* Progress fill */}
          <div
            className="h-full rounded bg-black/20 transition-all"
            style={{ width: `${task.progress}%` }}
          />

          {/* Label if bar is wide enough */}
          {barWidth > 80 && (
            <div className="absolute inset-0 flex items-center px-2 text-[10px] font-bold text-white truncate">
              {task.progress}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function GanttChart({ tasks = SAMPLE_TASKS, onTaskClick }: GanttChartProps) {
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const { minDate, maxDate } = useMemo(() => getDateRange(tasks), [tasks]);

  const dependencyMap = useMemo(() => {
    return tasks.reduce((acc, task) => {
      if (task.dependsOn) {
        acc[task.dependsOn] = (acc[task.dependsOn] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }, [tasks]);

  return (
    <div className="w-full h-full flex flex-col bg-background border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <h3 className="font-semibold">Project Timeline</h3>
        <div className="flex items-center gap-2">
          {(["day", "week", "month"] as const).map((z) => (
            <Button
              key={z}
              variant={zoom === z ? "default" : "outline"}
              size="sm"
              onClick={() => setZoom(z)}
              className="capitalize"
            >
              {z}
            </Button>
          ))}
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setZoom((z) => (z === "day" ? "week" : z === "week" ? "month" : "day"))}
            title="Zoom in"
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setZoom((z) => (z === "month" ? "week" : z === "week" ? "day" : "month"))}
            title="Zoom out"
          >
            <ZoomOut className="size-4" />
          </Button>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TimelineHeader minDate={minDate} maxDate={maxDate} zoom={zoom} />
        <div className="flex-1 overflow-y-auto">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              minDate={minDate}
              zoom={zoom}
              hasDependency={dependencyMap[task.id] > 0}
              onTaskClick={onTaskClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
