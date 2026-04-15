"use client";

// IDEA-036: Snooze date/time picker — custom date/time selector

import { useState } from "react";
import { format, addHours, addDays, startOfDay, setHours } from "date-fns";
import { Clock, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SnoozeDatePickerProps {
  onSnooze: (isoString: string, label: string) => void;
  children: React.ReactNode;
}

const QUICK_OPTIONS = [
  { label: "Later today", getDate: () => addHours(new Date(), 4) },
  {
    label: "Tomorrow 9 AM",
    getDate: () => setHours(addDays(startOfDay(new Date()), 1), 9),
  },
  {
    label: "This weekend",
    getDate: () => {
      const d = new Date();
      const daysToFri = (5 - d.getDay() + 7) % 7 || 7;
      return setHours(addDays(startOfDay(d), daysToFri), 17);
    },
  },
  {
    label: "Next Monday",
    getDate: () => {
      const d = new Date();
      const daysToMon = (1 - d.getDay() + 7) % 7 || 7;
      return setHours(addDays(startOfDay(d), daysToMon), 9);
    },
  },
  {
    label: "Next week",
    getDate: () => setHours(addDays(startOfDay(new Date()), 7), 9),
  },
  {
    label: "In 2 weeks",
    getDate: () => setHours(addDays(startOfDay(new Date()), 14), 9),
  },
];

export function SnoozeDatePicker({
  onSnooze,
  children,
}: SnoozeDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("09:00");

  const handleQuick = (opt: (typeof QUICK_OPTIONS)[0]) => {
    const d = opt.getDate();
    onSnooze(d.toISOString(), opt.label);
    setOpen(false);
  };

  const handleCustom = () => {
    if (!customDate) return;
    const [year, month, day] = customDate.split("-").map(Number);
    const [hour, min] = customTime.split(":").map(Number);
    const d = new Date(year, month - 1, day, hour, min, 0);
    if (isNaN(d.getTime())) return;
    onSnooze(d.toISOString(), `Custom: ${format(d, "MMM d 'at' HH:mm")}`);
    setOpen(false);
  };

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-0 rounded-xl shadow-xl border-border/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Snooze until</span>
          </div>
        </div>

        {/* Quick options */}
        <div className="p-2">
          {QUICK_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg hover:bg-muted/70 transition-colors cursor-pointer text-left"
              onClick={() => handleQuick(opt)}
            >
              <span className="font-medium">{opt.label}</span>
              <span className="text-[11px] text-muted-foreground">
                {format(opt.getDate(), "EEE, MMM d 'at' HH:mm")}
              </span>
            </button>
          ))}
        </div>

        {/* Custom date/time */}
        <div className="p-3 border-t space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Custom
          </Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs mb-1 block">Date</Label>
              <Input
                type="date"
                min={today}
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="w-28">
              <Label className="text-xs mb-1 block">Time</Label>
              <Input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <Button
            size="sm"
            className="w-full h-8"
            disabled={!customDate}
            onClick={handleCustom}
          >
            <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
            Set custom snooze
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
