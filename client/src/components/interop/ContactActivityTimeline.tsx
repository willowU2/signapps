"use client";

/**
 * Feature 5: Email sent → auto-log in contact activity timeline
 * Feature 28: Task status change → log in activity feed
 */

import { useEffect } from "react";
import { Mail, CheckSquare, CalendarDays, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInteropActivity } from "@/hooks/use-interop";
import type { ActivityEntry } from "@/lib/interop/store";

const ICONS: Record<ActivityEntry["type"], React.ReactNode> = {
  mail_sent: <Mail className="h-3.5 w-3.5 text-blue-500" />,
  mail_received: <Mail className="h-3.5 w-3.5 text-muted-foreground" />,
  task_created: <CheckSquare className="h-3.5 w-3.5 text-emerald-500" />,
  task_completed: <CheckSquare className="h-3.5 w-3.5 text-emerald-600" />,
  task_status_changed: <CheckSquare className="h-3.5 w-3.5 text-amber-500" />,
  event_created: <CalendarDays className="h-3.5 w-3.5 text-purple-500" />,
};

interface Props {
  contactEmail: string;
  className?: string;
  maxItems?: number;
}

export function ContactActivityTimeline({ contactEmail, className, maxItems = 20 }: Props) {
  const { activity } = useInteropActivity(contactEmail);

  const items = activity.slice(0, maxItems);

  if (items.length === 0) {
    return (
      <div className={cn("text-xs text-muted-foreground text-center py-4", className)}>
        Aucune activité pour ce contact
      </div>
    );
  }

  return (
    <div className={cn("space-y-0", className)}>
      {items.map((entry, i) => (
        <div key={entry.id} className="flex gap-3 group">
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/60 mt-0.5">
              {ICONS[entry.type]}
            </div>
            {i < items.length - 1 && <div className="w-px flex-1 bg-border/60 my-0.5" />}
          </div>
          {/* Content */}
          <div className="pb-3 pt-0.5 min-w-0">
            <p className="text-sm font-medium truncate">{entry.title}</p>
            {entry.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.description}</p>
            )}
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground/70 mt-1">
              <Clock className="h-3 w-3" />
              {new Date(entry.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Auto-logs when emails are sent. Use inside mail compose/display. */
export function useMailSentLogger() {
  const { log } = useInteropActivity();

  const logMailSent = (to: string, subject: string, mailId: string) => {
    log({
      type: "mail_sent",
      contactEmail: to,
      title: `Email envoyé : ${subject}`,
      description: `À ${to}`,
      entityId: mailId,
      entityType: "mail",
    });
  };

  return { logMailSent };
}
