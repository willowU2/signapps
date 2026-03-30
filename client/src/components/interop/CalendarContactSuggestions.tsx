"use client";

/**
 * Feature 9: Mail compose → suggest contacts from recent calendar events
 * Feature 24: Task assignee → show their calendar availability
 * Feature 23: Mail signature → pull from contact card (helper)
 */

import { useEffect, useState, useCallback } from "react";
import { CalendarDays, User, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { calendarApi } from "@/lib/api/calendar";

interface ContactSuggestion {
  email: string;
  name: string;
  lastEventTitle?: string;
  lastEventDate?: string;
}

export function useCalendarContactSuggestions() {
  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data: calendars } = await calendarApi.listCalendars();
        if (!Array.isArray(calendars) || calendars.length === 0) return;

        const now = new Date();
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 3600000);
        const { data: evList } = await calendarApi.listEvents(calendars[0].id, twoWeeksAgo, now);

        const contactMap = new Map<string, ContactSuggestion>();
        if (Array.isArray(evList)) {
          for (const ev of evList) {
            const attendees = ev.attendees ?? [];
            for (const att of attendees) {
              if (!att.email) continue;
              if (!contactMap.has(att.email)) {
                contactMap.set(att.email, { email: att.email, name: (att.name ?? att.email.split("@")[0]), lastEventTitle: ev.title, lastEventDate: ev.start_time });
              }
            }
          }
        }
        setSuggestions(Array.from(contactMap.values()).slice(0, 10));
      } catch { /* silent */ }
    })();
  }, []);

  return suggestions;
}

interface Props {
  query: string;
  onSelect: (contact: ContactSuggestion) => void;
  className?: string;
}

export function CalendarContactSuggestions({ query, onSelect, className }: Props) {
  const suggestions = useCalendarContactSuggestions();

  const filtered = suggestions.filter(
    s =>
      query.length > 1 &&
      (s.email.toLowerCase().includes(query.toLowerCase()) || s.name.toLowerCase().includes(query.toLowerCase()))
  );

  if (filtered.length === 0) return null;

  return (
    <div className={cn("rounded-lg border border-border shadow-sm bg-background overflow-hidden", className)}>
      <div className="px-3 py-1.5 border-b bg-muted/30">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          Depuis vos événements récents
        </p>
      </div>
      {filtered.map(contact => (
        <button
          key={contact.email}
          onClick={() => onSelect(contact)}
          className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors text-sm"
        >
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{contact.name}</p>
            <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
          </div>
          {contact.lastEventTitle && (
            <p className="text-xs text-muted-foreground truncate max-w-[120px]">{contact.lastEventTitle}</p>
          )}
        </button>
      ))}
    </div>
  );
}

/** Feature 24: Calendar availability for a user */
export function useCalendarAvailability(email: string | null) {
  const [slots, setSlots] = useState<{ start: string; end: string; free: boolean }[]>([]);

  useEffect(() => {
    if (!email) return;
    // Availability check — returns free/busy from calendar API if available
    (async () => {
      try {
        const API = process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1";
        const start = new Date().toISOString();
        const end = new Date(Date.now() + 7 * 24 * 3600000).toISOString();
        const res = await fetch(`${API}/freebusy?email=${encodeURIComponent(email)}&start=${start}&end=${end}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setSlots(data.slots ?? []);
      } catch { /* silent */ }
    })();
  }, [email]);

  return slots;
}
