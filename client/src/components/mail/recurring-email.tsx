"use client";

// IDEA-263: Recurring scheduled emails — repeat weekly/monthly sends

import { useState } from "react";
import { RepeatIcon, Calendar, Trash2, Plus, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { mailApi } from "@/lib/api-mail";
import { format } from "date-fns";

type Frequency = "daily" | "weekly" | "biweekly" | "monthly";

interface RecurringEmail {
  id: string;
  subject: string;
  to: string;
  body: string;
  frequency: Frequency;
  next_send_at: string;
  active: boolean;
  sent_count: number;
}

const FREQ_LABELS: Record<Frequency, string> = {
  daily: "Every day",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
};

export function RecurringEmailManager() {
  const [items, setItems] = useState<RecurringEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    to: "",
    body: "",
    frequency: "weekly" as Frequency,
    start_date: format(new Date(), "yyyy-MM-dd"),
    send_time: "09:00",
  });

  async function handleCreate() {
    if (!form.to || !form.subject) {
      toast.error("Le destinataire et l'objet sont requis");
      return;
    }
    setLoading(true);
    try {
      const startAt = new Date(`${form.start_date}T${form.send_time}`);
      const created = await mailApi.createRecurring({
        ...form,
        next_send_at: startAt.toISOString(),
      });
      setItems((prev) => [created as unknown as RecurringEmail, ...prev]);
      setDialogOpen(false);
      toast.success("Email récurrent planifié");
    } catch {
      toast.error("Impossible de créer recurring email");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    try {
      await mailApi.updateRecurring(id, { active });
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, active } : i)));
      toast.success(active ? "Resumed" : "Paused");
    } catch {
      toast.error("Impossible de mettre à jour");
    }
  }

  async function handleDelete(id: string) {
    try {
      await mailApi.deleteRecurring(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Supprimé");
    } catch {
      toast.error("Impossible de supprimer");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <RepeatIcon className="h-4 w-4" /> Recurring Emails
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New Schedule
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No recurring emails configured
          </p>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-md border px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{item.subject}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  To: {item.to}
                </span>
                <Badge variant="outline" className="text-xs">
                  {FREQ_LABELS[item.frequency]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Next:{" "}
                {format(new Date(item.next_send_at), "MMM d, yyyy 'at' HH:mm")}{" "}
                · {item.sent_count} sent
              </p>
            </div>
            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
              <Switch
                checked={item.active}
                onCheckedChange={(v) => toggleActive(item.id, v)}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={() => handleDelete(item.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Recurring Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input
                value={form.to}
                onChange={(e) => setForm((p) => ({ ...p, to: e.target.value }))}
                placeholder="recipient@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                value={form.subject}
                onChange={(e) =>
                  setForm((p) => ({ ...p, subject: e.target.value }))
                }
                placeholder="Weekly report"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                value={form.body}
                onChange={(e) =>
                  setForm((p) => ({ ...p, body: e.target.value }))
                }
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, frequency: v as Frequency }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FREQ_LABELS) as Frequency[]).map((f) => (
                      <SelectItem key={f} value={f}>
                        {FREQ_LABELS[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Send time</Label>
                <Input
                  type="time"
                  value={form.send_time}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, send_time: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, start_date: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={loading}>
              {loading ? "Scheduling…" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
