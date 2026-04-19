/**
 * SO4 IN3 — Org Webhooks Admin Panel.
 *
 * Drop-in panel rendered inside `/admin/webhooks` that exposes:
 * - the list of org webhooks
 * - inline create form (URL + comma-separated events)
 * - per-row test button + delete + toggle active
 * - last-50 deliveries timeline below each webhook
 *
 * Backed by `orgWebhooksApi` (talks to signapps-org @ port 3026).
 */
"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Loader2,
  Plus,
  Send,
  Trash2,
  Webhook as WebhookIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orgWebhooksApi, type WebhookView } from "@/lib/api/org-integrations";

function statusBadge(code: number | null) {
  if (code === null) return <Badge variant="outline">pending</Badge>;
  if (code >= 200 && code < 300)
    return <Badge className="bg-emerald-600">{code}</Badge>;
  if (code >= 400 && code < 500)
    return <Badge variant="destructive">{code}</Badge>;
  if (code >= 500) return <Badge variant="destructive">{code}</Badge>;
  return <Badge variant="outline">{code}</Badge>;
}

interface DeliveriesProps {
  webhookId: string;
}

function DeliveriesTimeline({ webhookId }: DeliveriesProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["org-webhooks", "deliveries", webhookId],
    queryFn: () => orgWebhooksApi.deliveries(webhookId, 50),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Loading deliveries…</p>;
  }
  const rows = data ?? [];
  if (rows.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground">
        No delivery yet — try the test button.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Event</TableHead>
          <TableHead>Attempt</TableHead>
          <TableHead>When</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.slice(0, 50).map((r) => (
          <TableRow key={r.id} data-testid={`org-delivery-${r.id}`}>
            <TableCell>{statusBadge(r.status_code)}</TableCell>
            <TableCell className="font-mono text-xs">{r.event_type}</TableCell>
            <TableCell className="text-xs">{r.attempt}</TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {new Date(r.delivered_at).toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function OrgWebhooksPanel() {
  const queryClient = useQueryClient();
  const { data: webhooks = [], isLoading } = useQuery<WebhookView[]>({
    queryKey: ["org-webhooks", "list"],
    queryFn: () => orgWebhooksApi.list(),
  });

  const [url, setUrl] = useState("");
  const [eventsRaw, setEventsRaw] = useState("org.person.*");
  const [creating, setCreating] = useState(false);

  const createMut = useMutation({
    mutationFn: () => {
      const events = eventsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (events.length === 0)
        return Promise.reject(new Error("at least one event"));
      return orgWebhooksApi.create({ url, events });
    },
    onSuccess: (created) => {
      toast.success(
        `Webhook created — secret revealed once: ${created.secret.slice(0, 8)}…`,
      );
      setUrl("");
      setEventsRaw("org.person.*");
      queryClient.invalidateQueries({ queryKey: ["org-webhooks", "list"] });
    },
    onError: (e: Error) => toast.error(`Create failed: ${e.message}`),
    onSettled: () => setCreating(false),
  });

  const testMut = useMutation({
    mutationFn: (id: string) => orgWebhooksApi.test(id),
    onSuccess: (_data, id) => {
      toast.success("Test event queued");
      queryClient.invalidateQueries({
        queryKey: ["org-webhooks", "deliveries", id],
      });
    },
    onError: (e: Error) => toast.error(`Test failed: ${e.message}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => orgWebhooksApi.remove(id),
    onSuccess: () => {
      toast.success("Webhook deleted");
      queryClient.invalidateQueries({ queryKey: ["org-webhooks", "list"] });
    },
    onError: (e: Error) => toast.error(`Delete failed: ${e.message}`),
  });

  const toggleActive = useMutation({
    mutationFn: (w: WebhookView) =>
      orgWebhooksApi.update(w.id, { active: !w.active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-webhooks", "list"] });
    },
    onError: (e: Error) => toast.error(`Toggle failed: ${e.message}`),
  });

  return (
    <Card data-testid="org-webhooks-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WebhookIcon className="h-4 w-4" />
          Org Webhooks
        </CardTitle>
        <CardDescription>
          HMAC-SHA256-signed fan-out triggered by <code>org.*</code> events on
          the platform event bus.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1">
            <Label htmlFor="org-webhook-url">URL</Label>
            <Input
              id="org-webhook-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.example.com/org"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="org-webhook-events">Events (comma separated)</Label>
            <Input
              id="org-webhook-events"
              value={eventsRaw}
              onChange={(e) => setEventsRaw(e.target.value)}
              placeholder="org.person.*, org.node.created"
            />
          </div>
          <div className="flex items-end">
            <Button
              data-testid="org-webhook-create"
              onClick={() => {
                setCreating(true);
                createMut.mutate();
              }}
              disabled={creating || !url}
            >
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading webhooks…</p>
        ) : webhooks.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            No org webhook yet — create one above.
          </p>
        ) : (
          <div className="space-y-4">
            {webhooks.map((w) => (
              <Card
                key={w.id}
                className="border-muted-foreground/20"
                data-testid={`org-webhook-${w.id}`}
              >
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="font-mono text-sm">
                        {w.url}
                      </CardTitle>
                      <CardDescription>
                        <div className="flex flex-wrap gap-1">
                          {w.events.map((e) => (
                            <Badge variant="outline" key={e}>
                              {e}
                            </Badge>
                          ))}
                        </div>
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={w.active ? "default" : "secondary"}>
                        {w.active ? "active" : "paused"}
                      </Badge>
                      {w.failure_count > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {w.failure_count} fails
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testMut.mutate(w.id)}
                      disabled={testMut.isPending}
                      data-testid={`org-webhook-test-${w.id}`}
                    >
                      <Send className="mr-1 h-3 w-3" />
                      Test
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleActive.mutate(w)}
                      disabled={toggleActive.isPending}
                    >
                      <Activity className="mr-1 h-3 w-3" />
                      {w.active ? "Pause" : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600"
                      onClick={() => deleteMut.mutate(w.id)}
                      disabled={deleteMut.isPending}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <DeliveriesTimeline webhookId={w.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default OrgWebhooksPanel;
