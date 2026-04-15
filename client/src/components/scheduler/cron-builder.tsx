"use client";

import { useState, useEffect, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, Calendar, CalendarDays, Timer, Repeat } from "lucide-react";

type Frequency = "every_minute" | "hourly" | "daily" | "weekly" | "monthly";

const FREQUENCY_OPTIONS: {
  value: Frequency;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "every_minute",
    label: "Toutes les minutes",
    icon: <Timer className="h-4 w-4" />,
  },
  {
    value: "hourly",
    label: "Toutes les heures",
    icon: <Repeat className="h-4 w-4" />,
  },
  {
    value: "daily",
    label: "Tous les jours",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    value: "weekly",
    label: "Toutes les semaines",
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    value: "monthly",
    label: "Tous les mois",
    icon: <CalendarDays className="h-4 w-4" />,
  },
];

const DAYS_OF_WEEK = [
  { value: 1, label: "Lun", full: "Lundi" },
  { value: 2, label: "Mar", full: "Mardi" },
  { value: 3, label: "Mer", full: "Mercredi" },
  { value: 4, label: "Jeu", full: "Jeudi" },
  { value: 5, label: "Ven", full: "Vendredi" },
  { value: 6, label: "Sam", full: "Samedi" },
  { value: 0, label: "Dim", full: "Dimanche" },
];

interface CronBuilderProps {
  value: string;
  onChange: (cron: string) => void;
}

function parseCronToState(cron: string): {
  frequency: Frequency;
  hour: string;
  minute: string;
  selectedDays: number[];
  dayOfMonth: string;
  minuteInterval: string;
} {
  const defaults = {
    frequency: "daily" as Frequency,
    hour: "09",
    minute: "00",
    selectedDays: [1, 2, 3, 4, 5],
    dayOfMonth: "1",
    minuteInterval: "5",
  };

  if (!cron || !cron.trim()) return defaults;

  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return defaults;

  const [min, hr, dom, , dow] = parts;

  // Every minute: * * * * *
  if (min === "*" && hr === "*" && dom === "*" && dow === "*") {
    return { ...defaults, frequency: "every_minute" };
  }

  // Every N minutes: */N * * * *
  if (min.startsWith("*/") && hr === "*") {
    return {
      ...defaults,
      frequency: "every_minute",
      minuteInterval: min.slice(2),
    };
  }

  // Hourly: N * * * *
  if (
    hr === "*" &&
    dom === "*" &&
    dow === "*" &&
    !min.includes("/") &&
    !min.includes("*")
  ) {
    return { ...defaults, frequency: "hourly", minute: min.padStart(2, "0") };
  }

  // Weekly: N H * * D
  if (dom === "*" && dow !== "*" && hr !== "*") {
    const days = dow.split(",").flatMap((d) => {
      if (d.includes("-")) {
        const [start, end] = d.split("-").map(Number);
        const result: number[] = [];
        for (let i = start; i <= end; i++) result.push(i);
        return result;
      }
      return [parseInt(d)];
    });
    return {
      ...defaults,
      frequency: "weekly",
      hour: hr.padStart(2, "0"),
      minute: min.padStart(2, "0"),
      selectedDays: days,
    };
  }

  // Monthly: N H D * *
  if (dom !== "*" && dow === "*" && hr !== "*") {
    return {
      ...defaults,
      frequency: "monthly",
      hour: hr.padStart(2, "0"),
      minute: min.padStart(2, "0"),
      dayOfMonth: dom,
    };
  }

  // Daily: N H * * *
  if (dom === "*" && dow === "*" && hr !== "*") {
    return {
      ...defaults,
      frequency: "daily",
      hour: hr.padStart(2, "0"),
      minute: min.padStart(2, "0"),
    };
  }

  return defaults;
}

function buildCron(
  frequency: Frequency,
  hour: string,
  minute: string,
  selectedDays: number[],
  dayOfMonth: string,
  minuteInterval: string,
): string {
  const h = parseInt(hour) || 0;
  const m = parseInt(minute) || 0;

  switch (frequency) {
    case "every_minute": {
      const interval = parseInt(minuteInterval) || 1;
      return interval <= 1 ? "* * * * *" : `*/${interval} * * * *`;
    }
    case "hourly":
      return `${m} * * * *`;
    case "daily":
      return `${m} ${h} * * *`;
    case "weekly": {
      if (selectedDays.length === 0) return `${m} ${h} * * *`;
      const sorted = [...selectedDays].sort((a, b) => a - b);
      // Compress consecutive days into ranges
      const dayStr = compressDays(sorted);
      return `${m} ${h} * * ${dayStr}`;
    }
    case "monthly":
      return `${m} ${h} ${parseInt(dayOfMonth) || 1} * *`;
  }
}

function compressDays(days: number[]): string {
  if (days.length === 0) return "*";
  if (days.length === 7) return "*";

  const ranges: string[] = [];
  let start = days[0];
  let end = days[0];

  for (let i = 1; i < days.length; i++) {
    if (days[i] === end + 1) {
      end = days[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = days[i];
      end = days[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(",");
}

function getNextExecutions(cron: string, count: number = 3): Date[] {
  // Simple next-execution calculator for common patterns
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return [];

  const [minPart, hrPart, domPart, , dowPart] = parts;
  const now = new Date();
  const results: Date[] = [];

  const getMinute = () => {
    if (minPart === "*") return -1;
    if (minPart.startsWith("*/")) return -2;
    return parseInt(minPart);
  };
  const getHour = () => (hrPart === "*" ? -1 : parseInt(hrPart));
  const getDom = () => (domPart === "*" ? -1 : parseInt(domPart));

  const minute = getMinute();
  const hour = getHour();
  const dom = getDom();

  const parsedDays =
    dowPart === "*"
      ? null
      : dowPart.split(",").flatMap((d) => {
          if (d.includes("-")) {
            const [s, e] = d.split("-").map(Number);
            const r: number[] = [];
            for (let i = s; i <= e; i++) r.push(i);
            return r;
          }
          return [parseInt(d)];
        });

  // For every-minute patterns
  if (minute === -1 || minute === -2) {
    const interval = minute === -2 ? parseInt(minPart.slice(2)) : 1;
    const candidate = new Date(now);
    candidate.setSeconds(0, 0);
    candidate.setMinutes(
      candidate.getMinutes() + (interval - (candidate.getMinutes() % interval)),
    );
    for (let i = 0; i < count; i++) {
      results.push(new Date(candidate));
      candidate.setMinutes(candidate.getMinutes() + interval);
    }
    return results;
  }

  // Hourly
  if (hour === -1 && dom === -1 && !parsedDays) {
    const candidate = new Date(now);
    candidate.setSeconds(0, 0);
    candidate.setMinutes(minute);
    if (candidate <= now) candidate.setHours(candidate.getHours() + 1);
    for (let i = 0; i < count; i++) {
      results.push(new Date(candidate));
      candidate.setHours(candidate.getHours() + 1);
    }
    return results;
  }

  // Daily / Weekly / Monthly
  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(minute);
  candidate.setHours(hour);

  // If we're past today's time, start from tomorrow
  if (candidate <= now) {
    candidate.setDate(candidate.getDate() + 1);
  }

  let safety = 0;
  while (results.length < count && safety < 400) {
    safety++;
    const dayOfWeek = candidate.getDay();
    const dateOfMonth = candidate.getDate();

    let matches = true;
    if (parsedDays && !parsedDays.includes(dayOfWeek)) matches = false;
    if (dom !== -1 && dateOfMonth !== dom) matches = false;

    if (matches) {
      results.push(new Date(candidate));
    }
    candidate.setDate(candidate.getDate() + 1);
  }

  return results;
}

function describeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;

  const [min, hr, dom, , dow] = parts;

  if (min === "*" && hr === "*") return "Chaque minute";
  if (min.startsWith("*/") && hr === "*")
    return `Toutes les ${min.slice(2)} minutes`;
  if (hr === "*" && dom === "*" && dow === "*")
    return `A la minute ${min} de chaque heure`;

  const time = `${hr.padStart(2, "0")}:${min.padStart(2, "0")}`;

  if (dom === "*" && dow === "*") return `Chaque jour a ${time}`;

  if (dom === "*" && dow !== "*") {
    const dayNames: Record<string, string> = {
      "0": "Dim",
      "1": "Lun",
      "2": "Mar",
      "3": "Mer",
      "4": "Jeu",
      "5": "Ven",
      "6": "Sam",
    };
    const days = dow
      .split(",")
      .map((d) => {
        if (d.includes("-")) {
          const [s, e] = d.split("-");
          return `${dayNames[s] || s}-${dayNames[e] || e}`;
        }
        return dayNames[d] || d;
      })
      .join(", ");
    return `${days} a ${time}`;
  }

  if (dom !== "*" && dow === "*") return `Le ${dom} de chaque mois a ${time}`;

  return cron;
}

export function CronBuilder({ value, onChange }: CronBuilderProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(() => parseCronToState(value), []);
  const [frequency, setFrequency] = useState<Frequency>(initial.frequency);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [selectedDays, setSelectedDays] = useState<number[]>(
    initial.selectedDays,
  );
  const [dayOfMonth, setDayOfMonth] = useState(initial.dayOfMonth);
  const [minuteInterval, setMinuteInterval] = useState(initial.minuteInterval);

  const cronExpression = useMemo(
    () =>
      buildCron(
        frequency,
        hour,
        minute,
        selectedDays,
        dayOfMonth,
        minuteInterval,
      ),
    [frequency, hour, minute, selectedDays, dayOfMonth, minuteInterval],
  );

  const nextExecutions = useMemo(
    () => getNextExecutions(cronExpression, 3),
    [cronExpression],
  );
  const description = useMemo(
    () => describeCron(cronExpression),
    [cronExpression],
  );

  useEffect(() => {
    onChange(cronExpression);
  }, [cronExpression, onChange]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  return (
    <div className="space-y-4">
      {/* Frequency selector */}
      <div className="space-y-2">
        <Label>Frequence</Label>
        <Select
          value={frequency}
          onValueChange={(v) => setFrequency(v as Frequency)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQUENCY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <span className="flex items-center gap-2">
                  {opt.icon}
                  {opt.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Every minute: interval */}
      {frequency === "every_minute" && (
        <div className="space-y-2">
          <Label>Intervalle (minutes)</Label>
          <Select value={minuteInterval} onValueChange={setMinuteInterval}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Chaque minute</SelectItem>
              <SelectItem value="2">Toutes les 2 minutes</SelectItem>
              <SelectItem value="5">Toutes les 5 minutes</SelectItem>
              <SelectItem value="10">Toutes les 10 minutes</SelectItem>
              <SelectItem value="15">Toutes les 15 minutes</SelectItem>
              <SelectItem value="30">Toutes les 30 minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Hourly: minute of hour */}
      {frequency === "hourly" && (
        <div className="space-y-2">
          <Label>Minute de l&apos;heure</Label>
          <Select value={minute} onValueChange={setMinute}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "00",
                "05",
                "10",
                "15",
                "20",
                "25",
                "30",
                "35",
                "40",
                "45",
                "50",
                "55",
              ].map((m) => (
                <SelectItem key={m} value={m}>
                  :{m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Daily: time picker */}
      {frequency === "daily" && (
        <div className="space-y-2">
          <Label>Heure d&apos;execution</Label>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={`${hour}:${minute}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":");
                setHour(h || "00");
                setMinute(m || "00");
              }}
              className="w-32"
            />
          </div>
        </div>
      )}

      {/* Weekly: day checkboxes + time */}
      {frequency === "weekly" && (
        <>
          <div className="space-y-2">
            <Label>Jours de la semaine</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <label
                  key={day.value}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border cursor-pointer transition-colors text-sm ${
                    selectedDays.includes(day.value)
                      ? "bg-primary/10 border-primary text-primary font-medium"
                      : "bg-muted/30 border-border hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    checked={selectedDays.includes(day.value)}
                    onCheckedChange={() => toggleDay(day.value)}
                    className="h-3.5 w-3.5"
                  />
                  {day.label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Heure d&apos;execution</Label>
            <Input
              type="time"
              value={`${hour}:${minute}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":");
                setHour(h || "00");
                setMinute(m || "00");
              }}
              className="w-32"
            />
          </div>
        </>
      )}

      {/* Monthly: day of month + time */}
      {frequency === "monthly" && (
        <>
          <div className="space-y-2">
            <Label>Jour du mois</Label>
            <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Heure d&apos;execution</Label>
            <Input
              type="time"
              value={`${hour}:${minute}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":");
                setHour(h || "00");
                setMinute(m || "00");
              }}
              className="w-32"
            />
          </div>
        </>
      )}

      {/* Live preview */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Expression CRON
          </span>
          <code className="text-sm font-mono bg-background px-2 py-0.5 rounded border">
            {cronExpression}
          </code>
        </div>
        <p className="text-sm text-foreground">{description}</p>
        {nextExecutions.length > 0 && (
          <div className="pt-1 border-t space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Prochaines executions :
            </span>
            <div className="flex flex-wrap gap-1.5">
              {nextExecutions.map((date, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-xs font-normal"
                >
                  {date.toLocaleString("fr-FR", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
