"use client";

// Feature 4: HR leave → block calendar events

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CalendarX, Info } from "lucide-react";

export interface LeaveBlock {
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  type: "vacation" | "sick" | "remote" | "other";
  approved: boolean;
}

const TYPE_LABEL: Record<LeaveBlock["type"], string> = {
  vacation: "Congés",
  sick: "Maladie",
  remote: "Télétravail",
  other: "Autre",
};

const DEMO_BLOCKS: LeaveBlock[] = [
  { employeeId: "1", employeeName: "Alice Martin", startDate: "2026-04-07", endDate: "2026-04-11", type: "vacation", approved: true },
  { employeeId: "2", employeeName: "Bob Dupont", startDate: "2026-04-03", endDate: "2026-04-04", type: "sick", approved: true },
  { employeeId: "5", employeeName: "Emma Leroy", startDate: "2026-04-14", endDate: "2026-04-14", type: "remote", approved: false },
];

interface LeaveCalendarBlockerProps {
  onBlocksChange?: (blocks: LeaveBlock[]) => void;
}

export function LeaveCalendarBlocker({ onBlocksChange }: LeaveCalendarBlockerProps) {
  const [showOnCalendar, setShowOnCalendar] = useState(true);
  const [blocks] = useState<LeaveBlock[]>(DEMO_BLOCKS);

  const approvedBlocks = blocks.filter((b) => b.approved);

  function handleToggle(checked: boolean) {
    setShowOnCalendar(checked);
    onBlocksChange?.(checked ? approvedBlocks : []);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarX className="size-4" />
            Absences sur le calendrier
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="leave-toggle" className="text-xs text-muted-foreground">Afficher</Label>
            <Switch id="leave-toggle" checked={showOnCalendar} onCheckedChange={handleToggle} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {showOnCalendar && (
          <div className="flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1.5 text-xs text-blue-700">
            <Info className="size-3.5 shrink-0" />
            {approvedBlocks.length} absence(s) bloquent des créneaux de réunion.
          </div>
        )}
        <div className="space-y-1.5">
          {blocks.map((b, i) => (
            <div key={i} className="flex items-center justify-between rounded border px-2 py-1.5 text-xs">
              <div className="min-w-0">
                <span className="font-medium">{b.employeeName}</span>
                <span className="mx-1 text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {new Date(b.startDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  {b.startDate !== b.endDate && ` → ${new Date(b.endDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="outline" className="text-[10px] py-0 h-4">{TYPE_LABEL[b.type]}</Badge>
                <span className={`text-[10px] ${b.approved ? "text-green-600" : "text-yellow-600"}`}>
                  {b.approved ? "Approuvé" : "En attente"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
