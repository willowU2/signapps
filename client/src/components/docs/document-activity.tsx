"use client";

import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Eye, Edit, Share2, Trash2, Plus, Clock } from "lucide-react";

interface ActivityEntry {
  id: string;
  action: "created" | "viewed" | "edited" | "shared" | "deleted" | "restored";
  user: string;
  timestamp: string;
  details?: string;
}

const STORAGE_KEY = "signapps-doc-activity";

export function logDocActivity(
  docId: string,
  action: ActivityEntry["action"],
  user: string = "admin",
  details?: string,
) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const entries: ActivityEntry[] = all[docId] || [];
    entries.unshift({
      id: Date.now().toString(),
      action,
      user,
      timestamp: new Date().toISOString(),
      details,
    });
    all[docId] = entries.slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export function getDocActivity(docId: string): ActivityEntry[] {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return all[docId] || [];
  } catch {
    return [];
  }
}

const ACTION_CONFIG = {
  created: { icon: Plus, label: "a créé", color: "text-green-500" },
  viewed: { icon: Eye, label: "a consulté", color: "text-blue-500" },
  edited: { icon: Edit, label: "a modifié", color: "text-orange-500" },
  shared: { icon: Share2, label: "a partagé", color: "text-purple-500" },
  deleted: { icon: Trash2, label: "a supprimé", color: "text-red-500" },
  restored: { icon: Clock, label: "a restauré", color: "text-cyan-500" },
};

export function DocumentActivityList({ docId }: { docId: string }) {
  const entries = getDocActivity(docId);

  if (entries.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Aucune activité enregistrée</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.slice(0, 20).map((entry) => {
        const config = ACTION_CONFIG[entry.action];
        const Icon = config.icon;
        return (
          <div key={entry.id} className="flex items-start gap-3 py-2">
            <div className={`mt-0.5 ${config.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">{entry.user}</span>{" "}
                <span className="text-muted-foreground">{config.label}</span>
                {entry.details && (
                  <span className="text-muted-foreground">
                    {" "}
                    — {entry.details}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(entry.timestamp), {
                  addSuffix: true,
                  locale: fr,
                })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
