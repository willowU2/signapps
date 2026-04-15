"use client";

/**
 * Feature 2: Right-click email → "Ajouter au calendrier" creates event
 */

import { useState, useEffect } from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { calendarApi } from "@/lib/api/calendar";
import { interopStore } from "@/lib/interop/store";
import type { Mail } from "@/lib/data/mail";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mail: Mail;
}

export function EmailToEventDialog({ open, onOpenChange, mail }: Props) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(mail.subject || "");
      setNotes(`[Email de ${mail.email}]\n\n${mail.text.slice(0, 300)}`);
      setStartDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, mail]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Le titre est requis");
      return;
    }
    setSaving(true);
    try {
      const startISO = new Date(`${startDate}T${startTime}`).toISOString();
      const endISO = new Date(`${startDate}T${endTime}`).toISOString();
      const { data: calendars } = await calendarApi.listCalendars();
      let eventId = `local_${Date.now()}`;
      if (Array.isArray(calendars) && calendars.length > 0) {
        const { data: ev } = await calendarApi.createEvent(calendars[0].id, {
          title,
          description: notes,
          start_time: startISO,
          end_time: endISO,
          is_all_day: false,
        });
        eventId = ev?.id ?? eventId;
      } else {
        const stored = JSON.parse(
          localStorage.getItem("interop:local_events") || "[]",
        );
        stored.push({
          id: eventId,
          title,
          notes,
          start_time: startISO,
          end_time: endISO,
        });
        localStorage.setItem("interop:local_events", JSON.stringify(stored));
      }
      interopStore.addLink({
        sourceType: "mail",
        sourceId: mail.id,
        sourceTitle: mail.subject,
        targetType: "event",
        targetId: eventId,
        targetTitle: title,
        relation: "created_from",
      });
      toast.success("Événement créé dans le calendrier");
      onOpenChange(false);
    } catch {
      toast.error("Impossible de créer l'événement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-blue-500" />
            Ajouter au calendrier
          </DialogTitle>
          <DialogDescription>
            Créer un événement depuis cet email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Titre</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Début</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fin</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "Enregistrement…" : "Créer l'événement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
