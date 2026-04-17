"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  Plus,
  Wrench,
  Clock,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import {
  format,
  addDays,
  addMonths,
  addYears,
  isPast,
  isWithinInterval,
} from "date-fns";

export interface MaintenanceSchedule {
  id: string;
  asset_id: string;
  title: string;
  description?: string;
  frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  last_done?: string;
  next_due: string;
}

interface Props {
  assetId: string;
  assetName: string;
}

const FREQ_OPTIONS = [
  { value: "weekly", label: "Weekly", days: 7 },
  { value: "monthly", label: "Monthly", days: 30 },
  { value: "quarterly", label: "Quarterly", days: 90 },
  { value: "yearly", label: "Yearly", days: 365 },
];

function nextDueFromFreq(freq: string): string {
  const now = new Date();
  switch (freq) {
    case "weekly":
      return addDays(now, 7).toISOString().slice(0, 10);
    case "monthly":
      return addMonths(now, 1).toISOString().slice(0, 10);
    case "quarterly":
      return addMonths(now, 3).toISOString().slice(0, 10);
    case "yearly":
      return addYears(now, 1).toISOString().slice(0, 10);
    default:
      return addMonths(now, 1).toISOString().slice(0, 10);
  }
}

function getDueStatus(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  if (isPast(d))
    return {
      label: "Overdue",
      color: "bg-red-500/10 text-red-600 border-red-500/20",
    };
  const soon = isWithinInterval(d, { start: now, end: addDays(now, 7) });
  if (soon)
    return {
      label: "Due Soon",
      color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    };
  return {
    label: "Scheduled",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  };
}

export function AssetMaintenance({ assetId, assetName }: Props) {
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    frequency: "monthly",
  });

  const handleAdd = () => {
    if (!form.title.trim()) return;
    const entry: MaintenanceSchedule = {
      id: Date.now().toString(),
      asset_id: assetId,
      title: form.title,
      description: form.description || undefined,
      frequency: form.frequency as MaintenanceSchedule["frequency"],
      next_due: nextDueFromFreq(form.frequency),
    };
    setSchedules((s) => [...s, entry]);
    setForm({ title: "", description: "", frequency: "monthly" });
    setDialogOpen(false);
  };

  const markDone = (id: string) => {
    setSchedules((s) =>
      s.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          last_done: new Date().toISOString().slice(0, 10),
          next_due: nextDueFromFreq(item.frequency),
        };
      }),
    );
  };

  const remove = (id: string) =>
    setSchedules((s) => s.filter((item) => item.id !== id));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wrench className="h-4 w-4 text-orange-500" />
          Preventive Maintenance
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Schedule
        </Button>
      </CardHeader>
      <CardContent>
        {schedules.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No maintenance scheduled</p>
          </div>
        ) : (
          <div className="space-y-2">
            {schedules.map((item) => {
              const status = getDueStatus(item.next_due);
              const freq = FREQ_OPTIONS.find((f) => f.value === item.frequency);
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{item.title}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs border ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {freq?.label}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Due: {format(new Date(item.next_due), "MMM d, yyyy")}
                      </span>
                      {item.last_done && (
                        <span>
                          Last:{" "}
                          {format(new Date(item.last_done), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Mark Done"
                      onClick={() => markDone(item.id)}
                      aria-label="Mark Done"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Remove"
                      onClick={() => remove(item.id)}
                      aria-label="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Schedule Maintenance — {assetName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                placeholder="e.g. BIOS update check"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => setForm((f) => ({ ...f, frequency: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQ_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={2}
                placeholder="Optional details…"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAdd} disabled={!form.title.trim()}>
              Add Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
