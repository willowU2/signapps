"use client";

// IDEA-038: Schedule send popup — calendar popup for picking send date/time

import { useState } from "react";
import {
  format,
  addHours,
  addDays,
  startOfDay,
  setHours,
  isBefore,
} from "date-fns";
import { Clock, CalendarIcon, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

interface ScheduleSendPopupProps {
  onSchedule: (sendAt: Date) => void;
  disabled?: boolean;
}

const SUGGESTIONS = [
  {
    label: "Later today",
    sub: "In 4 hours",
    getDate: () => addHours(new Date(), 4),
  },
  {
    label: "Tomorrow morning",
    sub: "9:00 AM",
    getDate: () => setHours(addDays(startOfDay(new Date()), 1), 9),
  },
  {
    label: "Tomorrow afternoon",
    sub: "2:00 PM",
    getDate: () => setHours(addDays(startOfDay(new Date()), 1), 14),
  },
  {
    label: "Monday morning",
    sub: "9:00 AM",
    getDate: () => {
      const d = new Date();
      const daysToMon = (1 - d.getDay() + 7) % 7 || 7;
      return setHours(addDays(startOfDay(d), daysToMon), 9);
    },
  },
];

export function ScheduleSendPopup({
  onSchedule,
  disabled,
}: ScheduleSendPopupProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");

  const handleSuggestion = (s: (typeof SUGGESTIONS)[0]) => {
    const d = s.getDate();
    onSchedule(d);
    setOpen(false);
    toast.success(`Scheduled for ${format(d, "MMM d 'at' HH:mm")}`);
  };

  const handleCustom = () => {
    if (!date) return;
    const [y, m, dd] = date.split("-").map(Number);
    const [h, min] = time.split(":").map(Number);
    const d = new Date(y, m - 1, dd, h, min, 0);
    if (isNaN(d.getTime())) {
      toast.error("Date/heure invalide");
      return;
    }
    if (isBefore(d, new Date())) {
      toast.error("L'heure planifiée doit être dans le futur");
      return;
    }
    onSchedule(d);
    setOpen(false);
    toast.success(`Scheduled for ${format(d, "MMM d 'at' HH:mm")}`);
  };

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-9 px-3 rounded-xl gap-1.5 text-sm"
          title="Schedule send"
        >
          <Clock className="w-4 h-4" />
          Schedule
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-0 rounded-xl shadow-xl border-border/50"
      >
        {/* Header */}
        <div className="p-3 border-b">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Schedule Send</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pick when to send this email
          </p>
        </div>

        {/* Suggestions */}
        <div className="p-2">
          {SUGGESTIONS.map((s) => {
            const d = s.getDate();
            return (
              <button
                key={s.label}
                className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg hover:bg-muted/70 transition-colors text-left"
                onClick={() => handleSuggestion(s)}
              >
                <div>
                  <p className="font-medium">{s.label}</p>
                  <p className="text-[11px] text-muted-foreground">{s.sub}</p>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {format(d, "EEE, MMM d 'at' HH:mm")}
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom picker */}
        <div className="p-3 border-t space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Custom date & time
          </Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="date"
                min={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="w-28">
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <Button
            size="sm"
            className="w-full h-8 bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!date}
            onClick={handleCustom}
          >
            <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
            Schedule for this time
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
