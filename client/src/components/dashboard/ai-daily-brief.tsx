"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface Props {
  data?: any;
}

export function AiDailyBrief({ data }: Props) {
  const stats = data?.stats;
  const tasks = stats?.pending_tasks ?? 0;
  const emails = stats?.unread_emails ?? 0;
  const events = stats?.today_events ?? 0;

  return (
    <Card className="border-blue-500/20 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-blue-500" />
          Résumé du jour
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Vous avez <strong>{tasks}</strong> tâche{tasks !== 1 ? "s" : ""} en attente,{" "}
          <strong>{emails}</strong> email{emails !== 1 ? "s" : ""} non lu{emails !== 1 ? "s" : ""}, et{" "}
          <strong>{events}</strong> événement{events !== 1 ? "s" : ""} aujourd&apos;hui.
        </p>
      </CardContent>
    </Card>
  );
}
