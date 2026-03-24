"use client";

import { useState } from "react";

interface Notification {
  id: string;
  title: string;
  body: string;
  priority: "high" | "medium" | "low";
  read: boolean;
  created_at: string;
  source: string;
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread" | "high">("all");
  const [notifications] = useState<Notification[]>([]);

  const filtered = notifications.filter(n => {
    if (filter === "unread") return !n.read;
    if (filter === "high") return n.priority === "high";
    return true;
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <div className="flex gap-2">
          {(["all", "unread", "high"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {f === "all" ? "Toutes" : f === "unread" ? "Non lues" : "Prioritaires"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">Aucune notification</p>
          <p className="text-sm mt-1">Vous etes a jour !</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <div
              key={n.id}
              className={`p-4 rounded-lg border transition-colors ${
                n.read ? "bg-background" : "bg-accent/50 border-primary/20"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">{n.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{n.body}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  n.priority === "high" ? "bg-red-500/10 text-red-500" :
                  n.priority === "medium" ? "bg-yellow-500/10 text-yellow-500" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {n.priority}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <span>{n.source}</span>
                <span>&bull;</span>
                <span>{new Date(n.created_at).toLocaleString("fr-FR")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
