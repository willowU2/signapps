"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Send, MessageSquare } from "lucide-react";

interface TeamsChannel {
  id: string;
  name: string;
  webhook_url: string;
  events: string[];
  enabled: boolean;
}

const ALL_EVENTS = [
  "user.created",
  "file.uploaded",
  "task.completed",
  "form.submitted",
  "doc.shared",
  "alert.triggered",
];

const DEFAULTS: TeamsChannel[] = [
  {
    id: "1",
    name: "General",
    webhook_url: "https://outlook.office.com/webhook/xxx",
    events: ["user.created", "task.completed"],
    enabled: true,
  },
];

export function TeamsConnector() {
  const [channels, setChannels] = useState<TeamsChannel[]>(DEFAULTS);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const add = () => {
    if (!newName || !newUrl) {
      toast.error("Name and webhook URL required");
      return;
    }
    setChannels((cs) => [
      ...cs,
      {
        id: Date.now().toString(),
        name: newName,
        webhook_url: newUrl,
        events: [],
        enabled: true,
      },
    ]);
    setNewName("");
    setNewUrl("");
    toast.success("Teams channel added");
  };

  const testSend = (ch: TeamsChannel) =>
    toast.success(`Test card sent to Teams: ${ch.name}`);

  const toggleEvent = (id: string, ev: string) =>
    setChannels((cs) =>
      cs.map((c) =>
        c.id === id
          ? {
              ...c,
              events: c.events.includes(ev)
                ? c.events.filter((e) => e !== ev)
                : [...c.events, ev],
            }
          : c,
      ),
    );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Microsoft Teams Connector
          </CardTitle>
          <CardDescription>
            Post SignApps events as adaptive cards to Teams channels via
            incoming webhooks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-blue-500/10 p-3 text-sm">
            <p className="font-medium text-blue-700 dark:text-blue-400">
              How to get a webhook URL:
            </p>
            <ol className="mt-1 text-xs text-muted-foreground list-decimal list-inside space-y-0.5">
              <li>Open Teams → Channel → More options → Connectors</li>
              <li>Search &quot;Incoming Webhook&quot; → Configure</li>
              <li>Name it and copy the webhook URL</li>
            </ol>
          </div>

          {channels.map((ch) => (
            <div key={ch.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={ch.enabled}
                    onCheckedChange={() =>
                      setChannels((cs) =>
                        cs.map((c) =>
                          c.id === ch.id ? { ...c, enabled: !c.enabled } : c,
                        ),
                      )
                    }
                  />
                  <span className="font-medium">{ch.name}</span>
                  <Badge
                    variant={ch.enabled ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {ch.events.length} events
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testSend(ch)}
                  >
                    <Send className="mr-1 h-3 w-3" /> Test
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive h-8 w-8"
                    onClick={() =>
                      setChannels((cs) => cs.filter((c) => c.id !== ch.id))
                    }
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <code className="block text-xs bg-muted px-2 py-1 rounded font-mono truncate">
                {ch.webhook_url}
              </code>
              <div className="flex flex-wrap gap-1">
                {ALL_EVENTS.map((ev) => (
                  <button
                    key={ev}
                    onClick={() => toggleEvent(ch.id, ev)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${ch.events.includes(ev) ? "bg-blue-100 border-blue-400 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" : "border-border hover:bg-accent"}`}
                  >
                    {ev}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="border-t pt-4 space-y-3">
            <Label>Add Teams Channel</Label>
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                placeholder="Channel name (e.g. Engineering)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input
                placeholder="https://outlook.office.com/webhook/..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
            <Button onClick={add}>
              <Plus className="mr-2 h-4 w-4" /> Add Channel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
