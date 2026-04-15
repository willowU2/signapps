"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Clock, Calendar as CalendarIcon, X, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ScheduledMsg {
  id: string;
  content: string;
  scheduledTime: Date;
}
interface ScheduledMessageProps {
  onSchedule?: (content: string, scheduledTime: Date) => void;
  onCancel?: (id: string) => void;
  scheduledMessages?: ScheduledMsg[];
}

export function ScheduledMessage({
  onSchedule,
  onCancel,
  scheduledMessages = [],
}: ScheduledMessageProps) {
  const [content, setContent] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});

  useEffect(() => {
    const interval = setInterval(() => {
      const newCountdowns: Record<string, string> = {};
      scheduledMessages.forEach((msg) => {
        const diff = msg.scheduledTime.getTime() - new Date().getTime();
        if (diff <= 0) newCountdowns[msg.id] = "Sending...";
        else {
          const h = Math.floor(diff / 3600000),
            m = Math.floor((diff % 3600000) / 60000),
            s = Math.floor((diff % 60000) / 1000);
          newCountdowns[msg.id] = `${h}h ${m}m ${s}s`;
        }
      });
      setCountdowns(newCountdowns);
    }, 1000);
    return () => clearInterval(interval);
  }, [scheduledMessages]);

  const handleSchedule = () => {
    if (!content.trim() || !selectedDate) return;
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const scheduledTime = new Date(selectedDate);
    scheduledTime.setHours(hours, minutes, 0, 0);
    if (scheduledTime <= new Date()) return;
    onSchedule?.(content, scheduledTime);
    setContent("");
    setSelectedDate(new Date());
    setSelectedTime("09:00");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Schedule Message</span>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter message..."
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
        />
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {selectedDate ? format(selectedDate, "MMM dd") : "Date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) =>
                  date < new Date(new Date().setHours(0, 0, 0, 0))
                }
              />
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="h-9 w-24"
            />
          </div>
          <Button
            onClick={handleSchedule}
            disabled={!content.trim()}
            size="sm"
            className="gap-2"
          >
            <Send className="h-4 w-4" /> Schedule
          </Button>
        </div>
      </div>
      {scheduledMessages.length > 0 && (
        <div className="rounded-lg border bg-background p-4 space-y-2">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />{" "}
            {scheduledMessages.length} Scheduled
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {scheduledMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-md border p-3 bg-muted/40 hover:bg-muted/60",
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-2">{msg.content}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span>{format(msg.scheduledTime, "MMM dd, HH:mm")}</span>
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                      {countdowns[msg.id] || "..."}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onCancel?.(msg.id)}
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
