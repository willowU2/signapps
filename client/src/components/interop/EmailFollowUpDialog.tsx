"use client";

/**
 * Feature 19: Email follow-up reminder → create calendar event
 */

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { calendarApi } from "@/lib/api/calendar";
import { interopStore } from "@/lib/interop/store";
import type { Mail } from "@/lib/data/mail";

const PRESETS = [
  { label: "Dans 1 heure", hours: 1 },
  { label: "Demain matin", hours: 24 },
  { label: "Dans 3 jours", hours: 72 },
  { label: "Dans 1 semaine", hours: 168 },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mail: Mail;
}

export function EmailFollowUpDialog({ open, onOpenChange, mail }: Props) {
  const [preset, setPreset] = useState("24");
  const [customDate, setCustomDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      setCustomDate(tomorrow.toISOString().slice(0, 16));
    }
  }, [open]);

  const getFollowUpDate = (): Date => {
    if (preset === "custom") return new Date(customDate);
    const h = parseInt(preset);
    const d = new Date();
    d.setHours(d.getHours() + h);
    return d;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const date = getFollowUpDate();
      const end = new Date(date.getTime() + 30 * 60000);
      const title = `Suivi : ${mail.subject}`;
      const cals = await calendarApi.listCalendars();
      const calendars = (cals as any).data ?? cals;
      let eventId = `local_${Date.now()}`;
      if (Array.isArray(calendars) && calendars.length > 0) {
        const ev = await calendarApi.createEvent(calendars[0].id, {
          title, start_time: date.toISOString(), end_time: end.toISOString(), all_day: false,
          notes: `Rappel de suivi pour l'email de ${mail.email}`,
        } as any);
        eventId = (ev as any).data?.id ?? (ev as any).id ?? eventId;
      } else {
        const stored = JSON.parse(localStorage.getItem("interop:local_events") || "[]");
        stored.push({ id: eventId, title, start_time: date.toISOString(), end_time: end.toISOString() });
        localStorage.setItem("interop:local_events", JSON.stringify(stored));
      }
      interopStore.addLink({ sourceType: "mail", sourceId: mail.id, sourceTitle: mail.subject, targetType: "event", targetId: eventId, targetTitle: title, relation: "follow_up" });
      interopStore.addNotification({ sourceModule: "calendar", type: "follow_up_created", title: "Rappel planifié", body: `Suivi de "${mail.subject}" le ${date.toLocaleDateString("fr-FR")}` });
      toast.success(`Rappel de suivi créé pour le ${date.toLocaleDateString("fr-FR")}`);
      onOpenChange(false);
    } catch {
      toast.error("Impossible de créer le rappel");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-500" />
            Rappel de suivi
          </DialogTitle>
          <DialogDescription>Créer un rappel calendrier pour suivre cet email.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Quand ?</Label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map(p => (
                  <SelectItem key={p.hours} value={String(p.hours)}>{p.label}</SelectItem>
                ))}
                <SelectItem value="custom">Date personnalisée</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {preset === "custom" && (
            <div className="space-y-1.5">
              <Label>Date et heure</Label>
              <Input type="datetime-local" value={customDate} onChange={e => setCustomDate(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Planification…" : "Planifier le rappel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
