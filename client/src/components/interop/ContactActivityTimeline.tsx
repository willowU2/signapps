"use client";

/**
 * Feature 5: Email sent → auto-log in contact activity timeline
 * Feature 28: Task status change → log in activity feed
 */

import { useEffect, useState } from "react";
import { Mail, CheckSquare, CalendarDays, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { activitiesApi } from "@/lib/api/crosslinks";
import { useInteropActivity } from "@/hooks/use-interop";
import type { Activity } from "@/types/crosslinks";
import type { ActivityEntry } from "@/lib/interop/store";

// Icon map for API activity actions
function getActionIcon(action: string): React.ReactNode {
  if (action.includes("mail") || action.includes("email")) {
    return action.includes("receiv") || action.includes("inbound") ? (
      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
    ) : (
      <Mail className="h-3.5 w-3.5 text-blue-500" />
    );
  }
  if (action.includes("task")) {
    if (action.includes("complet"))
      return <CheckSquare className="h-3.5 w-3.5 text-emerald-600" />;
    if (action.includes("status"))
      return <CheckSquare className="h-3.5 w-3.5 text-amber-500" />;
    return <CheckSquare className="h-3.5 w-3.5 text-emerald-500" />;
  }
  if (action.includes("event") || action.includes("calendar")) {
    return <CalendarDays className="h-3.5 w-3.5 text-purple-500" />;
  }
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
}

// Icon map for localStorage-backed activity types (fallback)
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
  contactId?: string;
  className?: string;
  maxItems?: number;
}

interface DisplayEntry {
  id: string;
  icon: React.ReactNode;
  title: string;
  description?: string;
  createdAt: string;
}

export function ContactActivityTimeline({
  contactEmail,
  contactId,
  className,
  maxItems = 20,
}: Props) {
  const [entries, setEntries] = useState<DisplayEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { activity: localActivity } = useInteropActivity(contactEmail);

  useEffect(() => {
    if (!contactId && !contactEmail) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    (async () => {
      try {
        const entityId = contactId ?? contactEmail;
        const { data } = await activitiesApi.entityHistory("contact", entityId);
        const apiEntries: DisplayEntry[] = (
          Array.isArray(data) ? data : []
        ).map((a: Activity) => ({
          id: a.id,
          icon: getActionIcon(a.action),
          title: a.entity_title ?? a.action,
          description: a.entity_type
            ? `${a.entity_type} · ${a.entity_id}`
            : undefined,
          createdAt: a.created_at,
        }));
        if (apiEntries.length > 0) {
          setEntries(apiEntries);
        } else {
          // Fallback to localStorage-backed store
          setEntries(
            localActivity.map((a) => ({
              id: a.id,
              icon: ICONS[a.type],
              title: a.title,
              description: a.description,
              createdAt: a.createdAt,
            })),
          );
        }
      } catch {
        // Fallback to localStorage-backed store
        setEntries(
          localActivity.map((a) => ({
            id: a.id,
            icon: ICONS[a.type],
            title: a.title,
            description: a.description,
            createdAt: a.createdAt,
          })),
        );
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, contactEmail]);

  const items = entries.slice(0, maxItems);

  if (isLoading) {
    return (
      <div
        className={cn("h-16 animate-pulse bg-muted/40 rounded", className)}
      />
    );
  }

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "text-xs text-muted-foreground text-center py-4",
          className,
        )}
      >
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
              {entry.icon}
            </div>
            {i < items.length - 1 && (
              <div className="w-px flex-1 bg-border/60 my-0.5" />
            )}
          </div>
          {/* Content */}
          <div className="pb-3 pt-0.5 min-w-0">
            <p className="text-sm font-medium truncate">{entry.title}</p>
            {entry.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {entry.description}
              </p>
            )}
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground/70 mt-1">
              <Clock className="h-3 w-3" />
              {new Date(entry.createdAt).toLocaleString("fr-FR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
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
