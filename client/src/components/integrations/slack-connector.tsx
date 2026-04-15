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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Send, CheckCircle2, XCircle } from "lucide-react";

interface SlackChannel {
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
  "deploy.success",
  "alert.triggered",
];

const DEFAULTS: SlackChannel[] = [
  {
    id: "1",
    name: "#general",
    webhook_url: "https://hooks.slack.com/services/T000/B000/xxxx",
    events: ["user.created", "deploy.success"],
    enabled: true,
  },
];

export function SlackConnector() {
  const [channels, setChannels] = useState<SlackChannel[]>(DEFAULTS);
  const [botToken, setBotToken] = useState("");
  const [verified, setVerified] = useState(false);
  const [newChan, setNewChan] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([]);

  const verify = async () => {
    if (!botToken.startsWith("xoxb-")) {
      toast.error("Invalid Slack bot token (must start with xoxb-)");
      return;
    }
    setVerified(true);
    toast.success("Slack workspace connected");
  };

  const addChannel = () => {
    if (!newChan || !newUrl) {
      toast.error("Channel name and webhook URL required");
      return;
    }
    setChannels((cs) => [
      ...cs,
      {
        id: Date.now().toString(),
        name: newChan.startsWith("#") ? newChan : `#${newChan}`,
        webhook_url: newUrl,
        events: newEvents,
        enabled: true,
      },
    ]);
    setNewChan("");
    setNewUrl("");
    setNewEvents([]);
    toast.success("Slack channel added");
  };

  const testSend = async (ch: SlackChannel) => {
    toast.success(`Test message sent to ${ch.name}`);
  };

  const toggleEvent = (chanId: string, ev: string) => {
    setChannels((cs) =>
      cs.map((c) =>
        c.id === chanId
          ? {
              ...c,
              events: c.events.includes(ev)
                ? c.events.filter((e) => e !== ev)
                : [...c.events, ev],
            }
          : c,
      ),
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Slack Workspace Connection</CardTitle>
          <CardDescription>
            Connect your Slack workspace to receive SignApps notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Slack Bot Token</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="xoxb-..."
              />
              <Button onClick={verify}>Verify</Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {verified ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm">
              {verified ? "Workspace verified" : "Not connected"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notification Channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {ALL_EVENTS.map((ev) => (
                  <button
                    key={ev}
                    onClick={() => toggleEvent(ch.id, ev)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${ch.events.includes(ev) ? "bg-green-100 border-green-400 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "border-border hover:bg-accent"}`}
                  >
                    {ev}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="border-t pt-4 space-y-3">
            <Label>Add Channel</Label>
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                placeholder="#channel-name"
                value={newChan}
                onChange={(e) => setNewChan(e.target.value)}
              />
              <Input
                placeholder="https://hooks.slack.com/..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
            <Button onClick={addChannel}>
              <Plus className="mr-2 h-4 w-4" /> Add Channel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
