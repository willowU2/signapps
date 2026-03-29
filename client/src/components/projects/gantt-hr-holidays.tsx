"use client";

// Feature 23: Project Gantt → overlay with HR holidays

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BarChart2, CalendarX } from "lucide-react";
import { cn } from "@/lib/utils";

interface GanttTask {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  progress: number;
  assignee: string;
  color: string;
}

interface HRHoliday {
  date: string;
  name: string;
  type: "public" | "company" | "leave";
  employeeId?: string;
  employeeName?: string;
}

const DEMO_TASKS: GanttTask[] = [
  { id: "t1", title: "API JWT", startDate: "2026-03-30", endDate: "2026-04-10", progress: 60, assignee: "Alice", color: "bg-blue-500" },
  { id: "t2", title: "Tests unitaires", startDate: "2026-04-08", endDate: "2026-04-16", progress: 20, assignee: "Marc", color: "bg-green-500" },
  { id: "t3", title: "Déploiement staging", startDate: "2026-04-14", endDate: "2026-04-18", progress: 0, assignee: "Bob", color: "bg-purple-500" },
];

const DEMO_HOLIDAYS: HRHoliday[] = [
  { date: "2026-04-06", name: "Lundi de Pâques", type: "public" },
  { date: "2026-04-07", name: "Congé Alice", type: "leave", employeeId: "1", employeeName: "Alice Martin" },
  { date: "2026-04-08", name: "Congé Alice", type: "leave", employeeId: "1", employeeName: "Alice Martin" },
  { date: "2026-04-13", name: "Team Day", type: "company" },
];

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  const s = new Date(start);
  const e = new Date(end);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

const RANGE_START = "2026-03-30";
const RANGE_END = "2026-04-18";
const HOLIDAY_TYPE_CLASS: Record<HRHoliday["type"], string> = {
  public: "bg-red-200/70",
  company: "bg-purple-200/70",
  leave: "bg-orange-200/70",
};

export function GanttHRHolidays() {
  const [showHolidays, setShowHolidays] = useState(true);
  const days = useMemo(() => getDaysInRange(RANGE_START, RANGE_END), []);
  const holidayDates = useMemo(() => new Map(DEMO_HOLIDAYS.map((h) => [h.date, h])), []);

  function taskPositionStyle(task: GanttTask) {
    const allDays = days;
    const startIdx = allDays.indexOf(task.startDate);
    const endIdx = allDays.indexOf(task.endDate);
    if (startIdx === -1) return { display: "none" };
    const width = ((endIdx - startIdx + 1) / allDays.length) * 100;
    const left = (startIdx / allDays.length) * 100;
    return { left: `${left}%`, width: `${width}%` };
  }

  const today = new Date().toISOString().split("T")[0];
  const todayIdx = days.indexOf(today);
  const todayLeft = todayIdx !== -1 ? (todayIdx / days.length) * 100 : -1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart2 className="size-4" />
            Gantt + Absences RH
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="holiday-toggle" className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarX className="size-3.5" /> Absences
            </Label>
            <Switch id="holiday-toggle" checked={showHolidays} onCheckedChange={setShowHolidays} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 500 }}>
            {/* Day headers */}
            <div className="flex mb-1">
              <div className="w-28 shrink-0" />
              <div className="flex flex-1">
                {days.map((day) => {
                  const holiday = showHolidays ? holidayDates.get(day) : undefined;
                  const d = new Date(day);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div
                      key={day}
                      className={cn("flex-1 text-center text-[9px] py-0.5 leading-tight border-r last:border-r-0", isWeekend && "bg-gray-100", holiday && HOLIDAY_TYPE_CLASS[holiday.type])}
                      title={holiday?.name}
                    >
                      {d.getDate()}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tasks */}
            <div className="space-y-1.5">
              {DEMO_TASKS.map((task) => (
                <div key={task.id} className="flex items-center gap-2">
                  <div className="w-28 shrink-0 text-xs truncate text-right pr-2 text-muted-foreground">{task.title}</div>
                  <div className="flex-1 relative h-5">
                    {/* Holiday overlay */}
                    {showHolidays && days.map((day, i) => {
                      const holiday = holidayDates.get(day);
                      if (!holiday) return null;
                      const left = (i / days.length) * 100;
                      const width = (1 / days.length) * 100;
                      return (
                        <div key={day} className={cn("absolute inset-y-0 opacity-60", HOLIDAY_TYPE_CLASS[holiday.type])}
                          style={{ left: `${left}%`, width: `${width}%` }} title={holiday.name} />
                      );
                    })}
                    {/* Task bar */}
                    <div
                      className={cn("absolute inset-y-0.5 rounded", task.color, "opacity-80 flex items-center px-1.5 overflow-hidden")}
                      style={taskPositionStyle(task)}
                    >
                      <div className="absolute inset-y-0 left-0 bg-white/30 rounded-l" style={{ width: `${task.progress}%` }} />
                      <span className="text-[10px] text-white font-medium relative z-10 truncate">{task.assignee}</span>
                    </div>
                    {/* Today line */}
                    {todayLeft >= 0 && (
                      <div className="absolute inset-y-0 w-0.5 bg-red-500 z-20" style={{ left: `${todayLeft}%` }} />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            {showHolidays && (
              <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="size-2.5 rounded bg-red-200" />Férié</span>
                <span className="flex items-center gap-1"><span className="size-2.5 rounded bg-purple-200" />Entreprise</span>
                <span className="flex items-center gap-1"><span className="size-2.5 rounded bg-orange-200" />Congé</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
