"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface TimeEntryFormValues {
  taskName: string;
  date: string;
  hours: number;
  minutes: number;
  billable: boolean;
}

interface TimeEntryFormProps {
  onSubmit: (values: TimeEntryFormValues) => void;
  onCancel?: () => void;
  className?: string;
}

export function TimeEntryForm({
  onSubmit,
  onCancel,
  className,
}: TimeEntryFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [taskName, setTaskName] = useState("");
  const [date, setDate] = useState(today);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [billable, setBillable] = useState(true);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!taskName.trim()) {
      setError("Le nom de la tache est requis.");
      return;
    }
    if (hours === 0 && minutes === 0) {
      setError("La duree doit etre superieure a 0.");
      return;
    }
    setError("");
    onSubmit({ taskName: taskName.trim(), date, hours, minutes, billable });
    setTaskName("");
    setHours(0);
    setMinutes(30);
  }

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", className)}>
      <div className="space-y-1">
        <Label htmlFor="task-name">Tache</Label>
        <Input
          id="task-name"
          placeholder="Nom de la tache..."
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="entry-date">Date</Label>
          <Input
            id="entry-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hours">Heures</Label>
          <Input
            id="hours"
            type="number"
            min={0}
            max={23}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="minutes">Minutes</Label>
          <Input
            id="minutes"
            type="number"
            min={0}
            max={59}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="billable"
          checked={billable}
          onCheckedChange={setBillable}
        />
        <Label htmlFor="billable" className="cursor-pointer">
          Facturable
        </Label>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button type="submit" size="sm">
          Ajouter
        </Button>
      </div>
    </form>
  );
}
