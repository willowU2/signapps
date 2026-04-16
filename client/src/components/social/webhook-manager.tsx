"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Webhook as WebhookIcon,
  Plus,
  Trash2,
  Edit,
  Send,
  Check,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { socialApi } from "@/lib/api/social";
import type { Webhook } from "@/lib/api/social";

// --- Constants ---

const WEBHOOK_EVENTS = [
  { value: "post.published", label: "Post Published" },
  { value: "post.scheduled", label: "Post Scheduled" },
  { value: "post.failed", label: "Post Failed" },
  { value: "inbox.new", label: "New Inbox Message" },
];

// --- Types ---

interface TestResult {
  webhookId: string;
  status: number;
  success: boolean;
}

// --- Add/Edit Dialog ---

function WebhookDialog({
  open,
  onClose,
  onSave,
  initial,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    url: string;
    events: string[];
    active: boolean;
    secret?: string;
  }) => void;
  initial?: Webhook;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [events, setEvents] = useState<string[]>(initial?.events ?? []);
  const [secret, setSecret] = useState(initial?.secret ?? "");
  const [active, setActive] = useState(initial?.active ?? true);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setUrl(initial?.url ?? "");
      setEvents(initial?.events ?? []);
      setSecret(initial?.secret ?? "");
      setActive(initial?.active ?? true);
    }
  }, [open, initial]);

  const toggleEvent = (ev: string) => {
    setEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev],
    );
  };

  const handleSave = () => {
    if (!name.trim() || !url.trim() || events.length === 0) return;
    onSave({
      name: name.trim(),
      url: url.trim(),
      events,
      active,
      secret: secret.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Webhook" : "Add Webhook"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              placeholder="My Webhook"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>URL</Label>
            <Input
              placeholder="https://example.com/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Events</Label>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((ev) => (
                <button
                  key={ev.value}
                  type="button"
                  onClick={() => toggleEvent(ev.value)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                    events.includes(ev.value)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {ev.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Secret (optional)</Label>
            <Input
              placeholder="Webhook signing secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Used to sign payloads with HMAC-SHA256
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label>Active</Label>
          </div>
          <Separator />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={
                !name.trim() || !url.trim() || events.length === 0 || saving
              }
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {initial ? "Save Changes" : "Create Webhook"}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Component ---

export function WebhookManager() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>(
    {},
  );
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchWebhooks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await socialApi.webhooks.list();
      setWebhooks(res.data);
    } catch {
      toast.error("Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleCreate = async (data: {
    name: string;
    url: string;
    events: string[];
    active: boolean;
    secret?: string;
  }) => {
    try {
      setSaving(true);
      await socialApi.webhooks.create(data);
      toast.success("Webhook created");
      setIsDialogOpen(false);
      setEditingWebhook(undefined);
      await fetchWebhooks();
    } catch {
      toast.error("Impossible de créer webhook");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: {
    name: string;
    url: string;
    events: string[];
    active: boolean;
    secret?: string;
  }) => {
    if (!editingWebhook) return;
    try {
      setSaving(true);
      await socialApi.webhooks.update(editingWebhook.id, data);
      toast.success("Webhook updated");
      setIsDialogOpen(false);
      setEditingWebhook(undefined);
      await fetchWebhooks();
    } catch {
      toast.error("Impossible de mettre à jour webhook");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await socialApi.webhooks.update(id, { active });
      setWebhooks((prev) =>
        prev.map((w) => (w.id === id ? { ...w, active } : w)),
      );
    } catch {
      toast.error("Failed to toggle webhook");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await socialApi.webhooks.delete(deleteId);
      toast.success("Webhook deleted");
      setDeleteId(null);
      await fetchWebhooks();
    } catch {
      toast.error("Impossible de supprimer webhook");
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await socialApi.webhooks.test(id);
      const data = res.data as { success: boolean; status_code: number };
      const result: TestResult = {
        webhookId: id,
        status: data.status_code,
        success: data.success,
      };
      setTestResults((prev) => ({ ...prev, [id]: result }));
      if (data.success) {
        toast.success(`Test passed (HTTP ${data.status_code})`);
      } else {
        toast.error(`Test failed (HTTP ${data.status_code})`);
      }
      await fetchWebhooks();
    } catch {
      toast.error("Failed to send test payload");
    } finally {
      setTestingId(null);
    }
  };

  const openEdit = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setIsDialogOpen(true);
  };

  const openCreate = () => {
    setEditingWebhook(undefined);
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Webhooks</h2>
            <p className="text-sm text-muted-foreground">
              Receive real-time notifications when events occur
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Webhook
          </Button>
        </div>

        {webhooks.length === 0 ? (
          <div className="border-2 border-dashed rounded-xl p-12 text-center">
            <WebhookIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="font-medium">No webhooks configured</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add a webhook to receive event notifications via HTTP
            </p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add your first webhook
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((webhook) => {
              const testResult = testResults[webhook.id];
              return (
                <Card key={webhook.id}>
                  <CardContent className="py-4 px-4">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg shrink-0">
                        <WebhookIcon className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{webhook.name}</span>
                          <Badge
                            variant={webhook.active ? "default" : "secondary"}
                          >
                            {webhook.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">
                          {webhook.url}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {webhook.events.map((ev) => (
                            <Badge
                              key={ev}
                              variant="outline"
                              className="text-xs"
                            >
                              {ev}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {webhook.lastTriggeredAt && (
                            <span>
                              Last triggered{" "}
                              {formatDistanceToNow(
                                new Date(webhook.lastTriggeredAt),
                                { addSuffix: true },
                              )}
                            </span>
                          )}
                        </div>
                        {testResult && (
                          <div
                            className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${
                              testResult.success
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {testResult.success ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5" />
                            )}
                            Test: HTTP {testResult.status}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch
                          checked={webhook.active}
                          onCheckedChange={(v) => handleToggle(webhook.id, v)}
                        />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleTest(webhook.id)}
                              disabled={testingId === webhook.id}
                            >
                              {testingId === webhook.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Send test payload</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(webhook)}
                              aria-label="Modifier"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Modifier</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(webhook.id)}
                              aria-label="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Supprimer</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <WebhookDialog
          open={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setEditingWebhook(undefined);
          }}
          onSave={editingWebhook ? handleUpdate : handleCreate}
          initial={editingWebhook}
          saving={saving}
        />

        <AlertDialog
          open={!!deleteId}
          onOpenChange={(o) => !o && setDeleteId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer le webhook</AlertDialogTitle>
              <AlertDialogDescription>
                Ce webhook sera supprimé définitivement. Vous ne recevrez plus
                de notifications pour ses événements.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
