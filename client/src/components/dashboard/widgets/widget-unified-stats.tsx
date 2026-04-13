"use client";

/**
 * Unified Stats widget — self-contained.
 * Shows Unread Emails, Today's Events, Open Tasks, Contacts as clickable stat cards.
 * Fetches real data via useDashboardSummary.
 */

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, CalendarDays, CheckCircle2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardSummary } from "@/hooks/use-dashboard";
import type { WidgetRenderProps } from "@/lib/dashboard/types";

export function WidgetUnifiedStats({
  widget,
}: Partial<WidgetRenderProps> = {}) {
  const router = useRouter();
  const { data: summary, isLoading } = useDashboardSummary();

  const cards = [
    {
      label: "Emails non lus",
      value: summary?.unread_emails ?? 0,
      icon: Mail,
      color: "text-amber-500",
      href: "/mail",
    },
    {
      label: "Evenements aujourd'hui",
      value: summary?.upcoming_events ?? 0,
      icon: CalendarDays,
      color: "text-blue-500",
      href: "/cal",
    },
    {
      label: "Taches en cours",
      value: summary?.tasks_due_today ?? 0,
      icon: CheckCircle2,
      color: "text-green-500",
      href: "/scheduler",
    },
    {
      label: "Contacts",
      value: summary?.contacts_count ?? 0,
      icon: Users,
      color: "text-teal-500",
      href: "/contacts",
    },
  ];

  if (isLoading) {
    return (
      <div className="h-full grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="h-full grid gap-4 md:grid-cols-4">
      {cards.map((c) => (
        <Card
          key={c.href}
          onClick={() => router.push(c.href)}
          className="cursor-pointer transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className={cn("rounded-lg bg-muted p-2", c.color)}>
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
