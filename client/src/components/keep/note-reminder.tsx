"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Clock, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NoteReminder {
  id: string;
  noteId: string;
  noteTitle: string;
  triggerAt: string; // ISO
  message: string;
  triggered: boolean;
}

interface NoteReminderProps {
  noteId: string;
  noteTitle: string;
  reminders: NoteReminder[];
  onAdd: (r: NoteReminder) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

// ── Quick presets ─────────────────────────────────────────────────────────────

const PRESETS = [
  { label: "Dans 1h", minutes: 60 },
  { label: "Ce soir", minutes: 0, isToday: true, hour: 20 },
  { label: "Demain matin", minutes: 0, isDayOffset: 1, hour: 9 },
  { label: "Dans 1 semaine", minutes: 7 * 24 * 60 },
];

function computePreset(p: (typeof PRESETS)[0]): Date {
  const d = new Date();
  if (p.minutes) {
    d.setMinutes(d.getMinutes() + p.minutes);
  } else if (p.isToday && p.hour !== undefined) {
    d.setHours(p.hour, 0, 0, 0);
  } else if (p.isDayOffset && p.hour !== undefined) {
    d.setDate(d.getDate() + p.isDayOffset);
    d.setHours(p.hour, 0, 0, 0);
  }
  return d;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function NoteReminder({
  noteId,
  noteTitle,
  reminders,
  onAdd,
  onDelete,
  onClose,
}: NoteReminderProps) {
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("09:00");
  const [message, setMessage] = useState("");

  const noteReminders = reminders.filter((r) => r.noteId === noteId);

  const handleAdd = (date: Date) => {
    if (date <= new Date()) {
      toast.error("La date doit être dans le futur.");
      return;
    }
    const r: NoteReminder = {
      id: crypto.randomUUID(),
      noteId,
      noteTitle,
      triggerAt: date.toISOString(),
      message: message.trim() || `Rappel: ${noteTitle}`,
      triggered: false,
    };
    onAdd(r);
    setMessage("");
    setCustomDate("");
    toast.success(
      `Rappel défini pour ${date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}`,
    );
  };

  const handleCustomAdd = () => {
    if (!customDate) return;
    const [h, m] = customTime.split(":").map(Number);
    const d = new Date(customDate);
    d.setHours(h, m, 0, 0);
    handleAdd(d);
  };

  const formatTrigger = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    if (diff < 0) return "Passé";
    if (diff < 60_000) return "Maintenant";
    if (diff < 3_600_000) return `Dans ${Math.round(diff / 60_000)}min`;
    if (diff < 86_400_000) return `Dans ${Math.round(diff / 3_600_000)}h`;
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Bell className="size-4 text-primary" />
        <h3 className="font-semibold text-sm">
          Rappel — « {noteTitle || "Note"} »
        </h3>
      </div>

      {/* Quick presets */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Rappels rapides
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => handleAdd(computePreset(p))}
            >
              <Clock className="size-3" /> {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Custom date/time */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Date et heure personnalisées
        </p>
        <div className="flex gap-2">
          <Input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="h-8 text-sm flex-1"
          />
          <Input
            type="time"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            className="h-8 text-sm w-24"
          />
        </div>
        <Input
          placeholder="Message du rappel (optionnel)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="h-8 text-sm"
        />
        <Button
          size="sm"
          className="w-full"
          onClick={handleCustomAdd}
          disabled={!customDate}
        >
          Définir le rappel
        </Button>
      </div>

      {/* Active reminders */}
      {noteReminders.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            Rappels actifs ({noteReminders.length})
          </p>
          {noteReminders.map((r) => (
            <div
              key={r.id}
              className={cn(
                "flex items-center gap-2 border rounded-lg p-2 text-xs",
                r.triggered ? "opacity-50 bg-muted/30" : "bg-background",
              )}
            >
              {r.triggered ? (
                <Check className="size-3.5 text-green-500 shrink-0" />
              ) : (
                <Bell className="size-3.5 text-primary shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{r.message}</p>
                <p className="text-muted-foreground">
                  {formatTrigger(r.triggerAt)}
                </p>
              </div>
              <Badge
                variant={r.triggered ? "secondary" : "outline"}
                className="text-xs shrink-0"
              >
                {r.triggered ? "Déclenché" : "Actif"}
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                className="size-6 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => onDelete(r.id)}
                aria-label="Supprimer"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" className="w-full" onClick={onClose}>
        Fermer
      </Button>
    </div>
  );
}
