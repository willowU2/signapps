"use client";

// Feature 5: "My Day" widget — emails + tasks + events

import { useQuery } from "@tanstack/react-query";
import { Mail, CheckSquare, Calendar, Clock, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { getClient, ServiceName } from "@/lib/api/factory";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import type { WidgetRenderProps } from "@/lib/dashboard/types";

interface DayItem {
  id: string;
  type: "email" | "task" | "event";
  title: string;
  subtitle?: string;
  time?: string;
  url: string;
  urgent?: boolean;
}

const TYPE_CONFIG = {
  email: {
    icon: Mail,
    color: "text-orange-500",
    label: "Email",
    bg: "bg-orange-50 dark:bg-orange-950/20",
  },
  task: {
    icon: CheckSquare,
    color: "text-blue-500",
    label: "Tâche",
    bg: "bg-blue-50 dark:bg-blue-950/20",
  },
  event: {
    icon: Calendar,
    color: "text-green-500",
    label: "Événement",
    bg: "bg-green-50 dark:bg-green-950/20",
  },
};

export function WidgetMyDay({ widget }: Partial<WidgetRenderProps> = {}) {
  const client = getClient(ServiceName.IDENTITY);
  const today = format(new Date(), "yyyy-MM-dd");

  const { data, isLoading } = useQuery<DayItem[]>({
    queryKey: ["my-day", today],
    queryFn: async () => {
      try {
        const { data } = await client.get<DayItem[]>("/dashboard/my-day", {
          params: { date: today },
        });
        return data;
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });

  const items = data ?? [];
  const emails = items.filter((i) => i.type === "email");
  const tasks = items.filter((i) => i.type === "task");
  const events = items.filter((i) => i.type === "event");

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-primary" />
            Ma journée
          </span>
          <span className="text-xs text-muted-foreground font-normal">
            {format(new Date(), "EEEE d MMMM", { locale: fr })}
          </span>
        </CardTitle>
        {!isLoading && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <Mail className="w-3 h-3" />
              {emails.length}
            </span>
            <span className="flex items-center gap-0.5">
              <CheckSquare className="w-3 h-3" />
              {tasks.length}
            </span>
            <span className="flex items-center gap-0.5">
              <Calendar className="w-3 h-3" />
              {events.length}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {isLoading ? (
            <div className="space-y-2 pt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <p className="text-sm">Journée calme aujourd'hui !</p>
            </div>
          ) : (
            <div className="space-y-1.5 pt-2">
              {items.map((item) => {
                const cfg = TYPE_CONFIG[item.type];
                const Icon = cfg.icon;
                return (
                  <Link key={item.id} href={item.url}>
                    <div
                      className={`flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors group ${item.urgent ? "ring-1 ring-destructive/30" : ""}`}
                    >
                      <div className={`p-1.5 rounded-md shrink-0 ${cfg.bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {item.title}
                        </p>
                        {item.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.time && (
                          <span className="text-xs text-muted-foreground">
                            {item.time}
                          </span>
                        )}
                        {item.urgent && (
                          <Badge
                            variant="destructive"
                            className="text-xs h-4 px-1"
                          >
                            Urgent
                          </Badge>
                        )}
                        <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
