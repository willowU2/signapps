"use client";

// Feature 13: Notification preferences → per-project settings

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, Briefcase } from "lucide-react";

type NotifChannel = "email" | "push" | "in_app" | "none";

interface ProjectNotifPrefs {
  projectId: string;
  projectName: string;
  enabled: boolean;
  channel: NotifChannel;
  events: {
    milestones: boolean;
    tasks: boolean;
    risks: boolean;
    members: boolean;
    budget: boolean;
  };
}

const DEMO_PREFS: ProjectNotifPrefs[] = [
  {
    projectId: "p1", projectName: "Refonte Backend Auth", enabled: true, channel: "push",
    events: { milestones: true, tasks: true, risks: true, members: false, budget: false },
  },
  {
    projectId: "p2", projectName: "Dashboard Analytics", enabled: true, channel: "email",
    events: { milestones: true, tasks: false, risks: true, members: false, budget: true },
  },
  {
    projectId: "p3", projectName: "Migration PostgreSQL", enabled: false, channel: "none",
    events: { milestones: false, tasks: false, risks: false, members: false, budget: false },
  },
];

const CHANNEL_LABELS: Record<NotifChannel, string> = {
  email: "Email", push: "Push", in_app: "In-app", none: "Désactivé",
};

const EVENT_LABELS: Record<keyof ProjectNotifPrefs["events"], string> = {
  milestones: "Jalons", tasks: "Tâches", risks: "Risques", members: "Membres", budget: "Budget",
};

export function NotificationProjectPrefs() {
  const [prefs, setPrefs] = useState<ProjectNotifPrefs[]>(DEMO_PREFS);

  function toggleProject(id: string, enabled: boolean) {
    setPrefs((prev) => prev.map((p) => p.projectId === id ? { ...p, enabled } : p));
  }

  function setChannel(id: string, channel: NotifChannel) {
    setPrefs((prev) => prev.map((p) => p.projectId === id ? { ...p, channel } : p));
  }

  function toggleEvent(id: string, event: keyof ProjectNotifPrefs["events"], value: boolean) {
    setPrefs((prev) => prev.map((p) => p.projectId === id ? { ...p, events: { ...p.events, [event]: value } } : p));
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="size-4" />
          Préférences par projet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {prefs.map((p) => (
          <div key={p.projectId} className="rounded-lg border overflow-hidden">
            <div className="flex items-center gap-2 p-2.5">
              <Briefcase className="size-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 text-sm font-medium truncate">{p.projectName}</span>
              <div className="flex items-center gap-2 shrink-0">
                <Select value={p.channel} onValueChange={(v) => setChannel(p.projectId, v as NotifChannel)} disabled={!p.enabled}>
                  <SelectTrigger className="h-6 w-24 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CHANNEL_LABELS) as NotifChannel[]).map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">{CHANNEL_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Switch checked={p.enabled} onCheckedChange={(v) => toggleProject(p.projectId, v)} />
              </div>
            </div>
            {p.enabled && (
              <div className="border-t bg-muted/20 px-3 py-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {(Object.keys(p.events) as Array<keyof ProjectNotifPrefs["events"]>).map((ev) => (
                    <div key={ev} className="flex items-center gap-1.5">
                      <Switch
                        id={`${p.projectId}-${ev}`}
                        checked={p.events[ev]}
                        onCheckedChange={(v) => toggleEvent(p.projectId, ev, v)}
                        className="scale-75"
                      />
                      <Label htmlFor={`${p.projectId}-${ev}`} className="text-[10px] cursor-pointer">
                        {EVENT_LABELS[ev]}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        <div className="text-xs text-muted-foreground">
          {prefs.filter((p) => p.enabled).length} projet(s) avec notifications actives
        </div>
      </CardContent>
    </Card>
  );
}
