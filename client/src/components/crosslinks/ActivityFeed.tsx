"use client";

import { useEffect, useState } from "react";
import { activitiesApi } from "@/lib/api/crosslinks";
import type { Activity } from "@/types/crosslinks";

const ACTION_LABELS: Record<string, string> = {
  created: "a créé",
  updated: "a modifié",
  deleted: "a supprimé",
  shared: "a partagé",
  signed: "a signé",
  sent: "a envoyé",
  uploaded: "a uploadé",
  declined: "a refusé",
  approved: "a approuvé",
};

interface Props {
  workspaceId?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
}

export function ActivityFeed({
  workspaceId,
  entityType,
  entityId,
  limit = 50,
}: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } =
          entityType && entityId
            ? await activitiesApi.entityHistory(entityType, entityId)
            : await activitiesApi.feed({
                workspace_id: workspaceId === "all" ? undefined : workspaceId,
                limit,
              });
        setActivities(data);
      } catch (e) {
        console.error("Failed to load activities", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [workspaceId, entityType, entityId, limit]);

  if (loading) return <div className="animate-pulse h-20" />;

  return (
    <div className="space-y-2">
      {activities.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-3 p-2 rounded hover:bg-muted/50"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm">
              <span className="font-medium">{a.actor_id.slice(0, 8)}</span>{" "}
              {ACTION_LABELS[a.action] || a.action}{" "}
              <span className="text-muted-foreground">{a.entity_type}</span>{" "}
              {a.entity_title && (
                <span className="font-medium">{a.entity_title}</span>
              )}
            </p>
            <time className="text-xs text-muted-foreground">
              {new Date(a.created_at).toLocaleString()}
            </time>
          </div>
        </div>
      ))}
      {activities.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune activité</p>
      )}
    </div>
  );
}
