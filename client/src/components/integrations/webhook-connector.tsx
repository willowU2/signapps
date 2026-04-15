"use client";

// WH2: Webhook connector — connected to real API (identity service)

import { useState, useEffect } from "react";
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
import {
  Plus,
  Trash2,
  Send,
  Webhook,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  webhooksApi,
  Webhook as WebhookType,
  CreateWebhookRequest,
} from "@/lib/api/identity";

const ALL_EVENT_TYPES = [
  "mail.received",
  "mail.sent",
  "deal.won",
  "deal.lost",
  "deal.created",
  "form.submitted",
  "task.completed",
  "task.overdue",
  "contact.created",
  "user.created",
  "user.deleted",
  "document.signed",
  "signature.completed",
];

export function WebhookConnector() {
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateWebhookRequest>({
    name: "",
    url: "",
    events: ["*"],
    enabled: true,
    secret: "",
    headers: {},
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadWebhooks();
  }, []);

  async function loadWebhooks() {
    setLoading(true);
    try {
      const res = await webhooksApi.list();
      setWebhooks(res.data || []);
    } catch {
      toast.error("Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.url.trim()) {
      toast.error("URL is required");
      return;
    }
    if (!form.url.startsWith("http://") && !form.url.startsWith("https://")) {
      toast.error("URL must start with http:// or https://");
      return;
    }
    if (form.events.length === 0) {
      toast.error("At least one event is required");
      return;
    }

    setCreating(true);
    try {
      const payload: CreateWebhookRequest = {
        name: form.name,
        url: form.url,
        events: form.events,
        enabled: form.enabled,
        secret: form.secret || undefined,
      };
      const res = await webhooksApi.create(payload);
      setWebhooks((ws) => [res.data, ...ws]);
      setForm({ name: "", url: "", events: ["*"], enabled: true, secret: "" });
      setShowCreate(false);
      toast.success("Webhook created");
    } catch {
      toast.error("Failed to create webhook");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await webhooksApi.delete(id);
      setWebhooks((ws) => ws.filter((w) => w.id !== id));
      toast.success("Webhook deleted");
    } catch {
      toast.error("Failed to delete webhook");
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const res = await webhooksApi.test(id);
      const result = res.data;
      if (result.success) {
        toast.success(`Test succeeded · HTTP ${result.status_code}`);
      } else {
        toast.error(`Test failed · HTTP ${result.status_code ?? "N/A"}`);
      }
      // Reload to get updated last_triggered / last_status
      await loadWebhooks();
    } catch {
      toast.error("Test request failed");
    } finally {
      setTestingId(null);
    }
  }

  function toggleEvent(event: string) {
    setForm((f) => {
      // Toggling "*" clears other selections (and vice versa)
      if (event === "*") {
        return { ...f, events: ["*"] };
      }
      const without = f.events.filter((e) => e !== event && e !== "*");
      return {
        ...f,
        events: without.includes(event)
          ? without.filter((e) => e !== event)
          : [...without, event],
      };
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" /> Outbound Webhooks
              </CardTitle>
              <CardDescription>
                Receive platform events in your external services via HTTP POST
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={loadWebhooks}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setShowCreate((s) => !s)}>
                <Plus className="mr-1 h-4 w-4" /> New Webhook
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create form */}
          {showCreate && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <h3 className="text-sm font-medium">New Webhook</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Name</Label>
                  <Input
                    placeholder="e.g. Slack Notifications"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">URL</Label>
                  <Input
                    placeholder="https://hooks.slack.com/..."
                    value={form.url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, url: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Signing Secret (optional)</Label>
                  <Input
                    type="password"
                    placeholder="Leave empty to skip signing"
                    value={form.secret ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, secret: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Events</Label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleEvent("*")}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      form.events.includes("*")
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary"
                    }`}
                  >
                    * (all events)
                  </button>
                  {ALL_EVENT_TYPES.map((evt) => (
                    <button
                      key={evt}
                      type="button"
                      onClick={() => toggleEvent(evt)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        form.events.includes(evt)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:border-primary"
                      }`}
                    >
                      {evt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Enabled</Label>
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, enabled: v }))
                  }
                />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleCreate} disabled={creating}>
                  {creating ? "Creating…" : "Create Webhook"}
                </Button>
              </div>
            </div>
          )}

          {/* Webhook list */}
          {loading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Loading…
            </p>
          )}
          {!loading && webhooks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No webhooks yet
            </p>
          )}

          <div className="space-y-3">
            {webhooks.map((wh) => (
              <div key={wh.id} className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30"
                  onClick={() =>
                    setExpandedId(expandedId === wh.id ? null : wh.id)
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-2 w-2 rounded-full flex-shrink-0 ${wh.enabled ? "bg-green-500" : "bg-muted-foreground"}`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{wh.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-xs">
                        {wh.url}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <Badge
                      variant={wh.enabled ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {wh.enabled ? "Active" : "Disabled"}
                    </Badge>
                    {wh.last_status && (
                      <Badge
                        variant={
                          wh.last_status >= 200 && wh.last_status < 300
                            ? "default"
                            : "destructive"
                        }
                        className="text-xs"
                      >
                        {wh.last_status}
                      </Badge>
                    )}
                    {expandedId === wh.id ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {expandedId === wh.id && (
                  <div className="border-t px-3 py-3 space-y-3 bg-muted/10">
                    <div className="flex flex-wrap gap-1.5">
                      {wh.events.map((evt) => (
                        <Badge
                          key={evt}
                          variant="outline"
                          className="text-xs font-mono"
                        >
                          {evt}
                        </Badge>
                      ))}
                    </div>

                    {wh.last_triggered && (
                      <p className="text-xs text-muted-foreground">
                        Last triggered:{" "}
                        {new Date(wh.last_triggered).toLocaleString()}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTest(wh.id)}
                        disabled={testingId === wh.id}
                      >
                        <Send
                          className={`h-3.5 w-3.5 mr-1 ${testingId === wh.id ? "animate-pulse" : ""}`}
                        />
                        {testingId === wh.id ? "Testing…" : "Test"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(wh.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
