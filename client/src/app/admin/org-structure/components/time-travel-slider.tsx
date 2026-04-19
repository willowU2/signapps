"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Clock, ArrowRightToLine } from "lucide-react";

export interface TimeTravelSliderProps {
  /** Valeur courante en ISO (`YYYY-MM-DD`) ou `null` = aujourd'hui. */
  value: string | null;
  onChange: (nextIsoDate: string | null) => void;
}

/**
 * Toolbar slider date pour activer la vue "historique" (`?at=`).
 *
 * Comportement :
 * - Date = today → pas d'affichage spécifique, état courant.
 * - Date ≠ today → badge "Vue du YYYY-MM-DD" + bouton "Aujourd'hui".
 *
 * Le composant ne pousse pas directement l'état au store — la page qui
 * l'embarque passe `onChange` pour router vers son `atDate` local + la
 * UI passe en read-only (boutons Add/Edit/Delete grisés).
 */
export function TimeTravelSlider({ value, onChange }: TimeTravelSliderProps) {
  const today = new Date().toISOString().slice(0, 10);
  const isPast = value !== null && value !== today;

  return (
    <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-2 py-1">
      <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <input
        type="date"
        value={value ?? today}
        max={today}
        onChange={(e) => {
          const next = e.target.value;
          onChange(next === today ? null : next);
        }}
        className="bg-transparent outline-none text-xs font-medium text-foreground min-w-[112px]"
        aria-label="Time-travel date"
      />
      {isPast && (
        <>
          <span
            className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300"
            aria-live="polite"
          >
            Vue {value}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => onChange(null)}
            title="Revenir à aujourd'hui"
          >
            <ArrowRightToLine className="h-3 w-3 mr-1" />
            Aujourd'hui
          </Button>
        </>
      )}
    </div>
  );
}
