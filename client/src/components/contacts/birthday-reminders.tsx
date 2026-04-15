"use client";

import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Gift, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContactWithBirthday {
  id: string;
  name: string;
  birthday?: string; // MM-DD or YYYY-MM-DD
}

interface BirthdayRemindersProps {
  contacts: ContactWithBirthday[];
}

function getDaysUntil(birthday: string): number {
  const today = new Date();
  const parts = birthday.replace(/^\d{4}-/, "").split("-");
  const month = parseInt(parts[0], 10) - 1;
  const day = parseInt(parts[1], 10);

  const next = new Date(today.getFullYear(), month, day);
  if (next < today) next.setFullYear(today.getFullYear() + 1);

  return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatBirthday(birthday: string): string {
  const parts = birthday.replace(/^\d{4}-/, "").split("-");
  const months = [
    "janv.",
    "févr.",
    "mars",
    "avr.",
    "mai",
    "juin",
    "juil.",
    "août",
    "sept.",
    "oct.",
    "nov.",
    "déc.",
  ];
  return `${parseInt(parts[1], 10)} ${months[parseInt(parts[0], 10) - 1]}`;
}

export function BirthdayReminders({ contacts }: BirthdayRemindersProps) {
  const sorted = useMemo(() => {
    return contacts
      .filter((c) => !!c.birthday)
      .map((c) => ({ ...c, daysUntil: getDaysUntil(c.birthday!) }))
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [contacts]);

  const upcoming = sorted.filter((c) => c.daysUntil <= 30);
  const later = sorted.filter((c) => c.daysUntil > 30);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Gift className="size-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Aucun anniversaire enregistré.</p>
        <p className="text-xs mt-1">
          Ajoutez un champ "birthday" à vos contacts.
        </p>
      </div>
    );
  }

  const urgencyClass = (days: number) => {
    if (days === 0) return "text-red-600 font-bold";
    if (days <= 7) return "text-orange-600 font-semibold";
    if (days <= 30) return "text-amber-600";
    return "text-muted-foreground";
  };

  const urgencyBadge = (days: number) => {
    if (days === 0)
      return (
        <Badge className="bg-red-100 text-red-800 text-xs">Aujourd'hui !</Badge>
      );
    if (days === 1)
      return (
        <Badge className="bg-orange-100 text-orange-800 text-xs">Demain</Badge>
      );
    if (days <= 7)
      return (
        <Badge className="bg-amber-100 text-amber-800 text-xs">
          Cette semaine
        </Badge>
      );
    return null;
  };

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Gift className="size-3" /> Dans les 30 prochains jours (
            {upcoming.length})
          </p>
          {upcoming.map((c) => (
            <div
              key={c.id}
              className={cn(
                "flex items-center gap-3 border rounded-lg p-2.5",
                c.daysUntil === 0 && "border-red-200 bg-red-50/50",
                c.daysUntil <= 7 &&
                  c.daysUntil > 0 &&
                  "border-amber-200 bg-amber-50/50",
              )}
            >
              <div className="size-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {c.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="size-3" />{" "}
                  {formatBirthday(c.birthday!)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {urgencyBadge(c.daysUntil)}
                <span className={cn("text-xs", urgencyClass(c.daysUntil))}>
                  {c.daysUntil === 0 ? "🎂" : `J-${c.daysUntil}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {later.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Plus tard
          </p>
          {later.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 text-sm py-1.5 border-b last:border-0"
            >
              <span className="flex-1 text-muted-foreground truncate">
                {c.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatBirthday(c.birthday!)}
              </span>
              <span className="text-xs text-muted-foreground w-10 text-right">
                J-{c.daysUntil}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
