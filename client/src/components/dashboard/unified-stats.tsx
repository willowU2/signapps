"use client";

import { Card, CardContent } from "@/components/ui/card";
import { FileText, Mail, CalendarDays } from "lucide-react";

interface Props {
  data?: any;
}

export function UnifiedStats({ data }: Props) {
  const stats = data?.stats;
  const cards = [
    { label: "Documents", value: stats?.total_docs ?? 0, icon: FileText, color: "text-blue-500" },
    { label: "Emails non lus", value: stats?.unread_emails ?? 0, icon: Mail, color: "text-amber-500" },
    { label: "Événements aujourd'hui", value: stats?.today_events ?? 0, icon: CalendarDays, color: "text-green-500" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`rounded-lg bg-muted p-2 ${c.color}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
