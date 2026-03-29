"use client";

// Feature 15: HR → show team calendar in org chart

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  department: string;
  reports?: string[];
}

interface CalendarEvent {
  memberId: string;
  date: string;
  type: "leave" | "meeting" | "ooo" | "project";
  label: string;
}

const TYPE_COLOR: Record<CalendarEvent["type"], string> = {
  leave: "bg-red-200 text-red-900",
  meeting: "bg-blue-200 text-blue-900",
  ooo: "bg-orange-200 text-orange-900",
  project: "bg-green-200 text-green-900",
};

const DEMO_MEMBERS: TeamMember[] = [
  { id: "1", name: "Alice Martin", role: "Lead Dev", department: "Tech", reports: ["2", "8"] },
  { id: "2", name: "Bob Dupont", role: "DevOps", department: "Tech" },
  { id: "8", name: "Marc Dubois", role: "Backend Dev", department: "Tech" },
];

function getCurrentWeekDays(offset = 0): string[] {
  const now = new Date();
  now.setDate(now.getDate() + offset * 7);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

const TODAY = new Date().toISOString().split("T")[0];

const DEMO_EVENTS: CalendarEvent[] = [
  { memberId: "1", date: TODAY, type: "meeting", label: "Standup" },
  { memberId: "2", date: TODAY, type: "leave", label: "Congé" },
  { memberId: "8", date: TODAY, type: "project", label: "Sprint" },
];

export function OrgChartTeamCalendar() {
  const [weekOffset, setWeekOffset] = useState(0);
  const days = getCurrentWeekDays(weekOffset);

  const dayLabels = days.map((d) => {
    const date = new Date(d);
    return { key: d, label: date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }) };
  });

  function getEvents(memberId: string, date: string) {
    return DEMO_EVENTS.filter((e) => e.memberId === memberId && e.date === date);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="size-4" />
            Calendrier équipe
          </CardTitle>
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekOffset((w) => w - 1)} className="rounded p-1 hover:bg-muted">
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-xs text-muted-foreground">
              {new Date(days[0]).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} — {new Date(days[4]).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </span>
            <button onClick={() => setWeekOffset((w) => w + 1)} className="rounded p-1 hover:bg-muted">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="w-28 text-left pb-2 font-medium text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="size-3" /> Membre</span>
                </th>
                {dayLabels.map((d) => (
                  <th key={d.key} className={cn("text-center pb-2 font-medium text-muted-foreground px-1", d.key === TODAY && "text-primary")}>
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {DEMO_MEMBERS.map((member) => (
                <tr key={member.id}>
                  <td className="py-1.5 pr-2">
                    <div className="font-medium truncate">{member.name.split(" ")[0]}</div>
                    <div className="text-muted-foreground truncate">{member.role}</div>
                  </td>
                  {days.map((day) => {
                    const events = getEvents(member.id, day);
                    return (
                      <td key={day} className={cn("py-1.5 px-1 text-center align-top", day === TODAY && "bg-primary/5 rounded")}>
                        {events.map((ev, i) => (
                          <span key={i} className={cn("block rounded px-1 py-0.5 text-[10px] leading-tight mb-0.5", TYPE_COLOR[ev.type])}>
                            {ev.label}
                          </span>
                        ))}
                        {events.length === 0 && <span className="text-muted-foreground/40">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.entries(TYPE_COLOR) as [CalendarEvent["type"], string][]).map(([type, cls]) => (
            <span key={type} className={cn("rounded px-1.5 py-0.5 text-[10px]", cls)}>
              {type === "leave" ? "Congé" : type === "meeting" ? "Réunion" : type === "ooo" ? "Absent" : "Projet"}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
