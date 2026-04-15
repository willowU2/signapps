"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bell, Clock, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface DNDSchedule {
  startTime: string;
  endTime: string;
}

interface DNDException {
  id: string;
  name: string;
}

export function DNDMode() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [schedule, setSchedule] = useState<DNDSchedule>({
    startTime: "22:00",
    endTime: "08:00",
  });
  const [exceptions, setExceptions] = useState<DNDException[]>([]);
  const [newException, setNewException] = useState("");

  const handleAddException = () => {
    if (!newException.trim()) return;
    setExceptions([
      ...exceptions,
      { id: Date.now().toString(), name: newException },
    ]);
    setNewException("");
  };

  const handleRemoveException = (id: string) => {
    setExceptions(exceptions.filter((e) => e.id !== id));
  };

  return (
    <div className="w-full max-w-md p-4 space-y-4 border border-border/50 rounded-lg bg-card">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell
            className={cn("h-5 w-5", isEnabled ? "text-destructive" : "")}
          />
          <span className="font-medium">Ne Pas Déranger</span>
        </div>
        <Button
          variant={isEnabled ? "destructive" : "outline"}
          size="sm"
          onClick={() => setIsEnabled(!isEnabled)}
        >
          {isEnabled ? "Actif" : "Inactif"}
        </Button>
      </div>

      {isEnabled && (
        <>
          {/* Time Schedule */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horaires automatiques
            </label>
            <div className="flex gap-2 items-center">
              <Input
                type="time"
                value={schedule.startTime}
                onChange={(e) =>
                  setSchedule({ ...schedule, startTime: e.target.value })
                }
                className="h-9"
              />
              <span className="text-xs text-muted-foreground">à</span>
              <Input
                type="time"
                value={schedule.endTime}
                onChange={(e) =>
                  setSchedule({ ...schedule, endTime: e.target.value })
                }
                className="h-9"
              />
            </div>
          </div>

          {/* Exception List */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Exceptions (contacts)</label>
            <div className="flex gap-2">
              <Input
                value={newException}
                onChange={(e) => setNewException(e.target.value)}
                placeholder="Ajouter un contact..."
                className="h-9 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddException();
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddException}
                className="px-2"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Exception Badges */}
            {exceptions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {exceptions.map((exc) => (
                  <Badge
                    key={exc.id}
                    variant="secondary"
                    className="pl-2 pr-1 flex items-center gap-1"
                  >
                    {exc.name}
                    <button
                      onClick={() => handleRemoveException(exc.id)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
