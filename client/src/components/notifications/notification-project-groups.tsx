"use client";

// Feature 6: Notification → group by project context

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight, Briefcase, Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProjectNotification {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  message: string;
  type: "milestone" | "task" | "risk" | "member" | "general";
  read: boolean;
  createdAt: string;
}

const TYPE_ICON_CLASS: Record<ProjectNotification["type"], string> = {
  milestone: "text-blue-600",
  task: "text-green-600",
  risk: "text-red-600",
  member: "text-purple-600",
  general: "text-muted-foreground",
};

const DEMO_NOTIFS: ProjectNotification[] = [
  { id: "n1", projectId: "p1", projectName: "Refonte Backend Auth", title: "Jalon atteint", message: "API JWT est terminée.", type: "milestone", read: false, createdAt: "2026-03-29T09:00:00Z" },
  { id: "n2", projectId: "p1", projectName: "Refonte Backend Auth", title: "Nouvelle tâche", message: "Tests de charge assignés à Alice.", type: "task", read: false, createdAt: "2026-03-29T10:30:00Z" },
  { id: "n3", projectId: "p2", projectName: "Dashboard Analytics", title: "Risque détecté", message: "Retard prévu sur le composant graphique.", type: "risk", read: true, createdAt: "2026-03-28T14:00:00Z" },
  { id: "n4", projectId: "p2", projectName: "Dashboard Analytics", title: "Membre ajouté", message: "Emma Leroy rejoint le projet.", type: "member", read: false, createdAt: "2026-03-29T08:00:00Z" },
];

interface NotificationProjectGroupsProps {
  notifications?: ProjectNotification[];
}

export function NotificationProjectGroups({ notifications = DEMO_NOTIFS }: NotificationProjectGroupsProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [read, setRead] = useState<Set<string>>(new Set(notifications.filter((n) => n.read).map((n) => n.id)));

  const groups = useMemo(() => {
    const map = new Map<string, { projectName: string; items: ProjectNotification[] }>();
    for (const n of notifications) {
      const g = map.get(n.projectId) ?? { projectName: n.projectName, items: [] };
      g.items.push(n);
      map.set(n.projectId, g);
    }
    return Array.from(map.entries()).map(([id, g]) => ({ projectId: id, ...g }));
  }, [notifications]);

  function toggleGroup(id: string) {
    setCollapsed((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  function markRead(id: string) {
    setRead((prev) => new Set([...prev, id]));
  }

  function markAllRead(projectId: string) {
    const group = groups.find((g) => g.projectId === projectId);
    if (group) setRead((prev) => new Set([...prev, ...group.items.map((n) => n.id)]));
  }

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => {
        const unread = group.items.filter((n) => !read.has(n.id)).length;
        const isOpen = !collapsed.has(group.projectId);
        return (
          <div key={group.projectId} className="rounded-lg border">
            <button
              onClick={() => toggleGroup(group.projectId)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50"
            >
              {isOpen ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
              <Briefcase className="size-3.5 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium">{group.projectName}</span>
              {unread > 0 && <Badge className="size-5 justify-center p-0 text-[10px]">{unread}</Badge>}
              {unread > 0 && (
                <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px]" onClick={(e) => { e.stopPropagation(); markAllRead(group.projectId); }}>
                  <Check className="size-3 mr-0.5" /> Tout lire
                </Button>
              )}
            </button>
            {isOpen && (
              <ScrollArea className="max-h-48">
                <div className="divide-y">
                  {group.items.map((n) => (
                    <div key={n.id} className={cn("flex items-start gap-2 px-3 py-2 text-xs transition-colors", read.has(n.id) ? "opacity-60" : "bg-blue-50/30")}>
                      <Bell className={cn("size-3.5 mt-0.5 shrink-0", TYPE_ICON_CLASS[n.type])} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{n.title}</p>
                        <p className="text-muted-foreground">{n.message}</p>
                      </div>
                      {!read.has(n.id) && (
                        <button onClick={() => markRead(n.id)} className="shrink-0 text-blue-600 hover:underline">Lu</button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        );
      })}
    </div>
  );
}
