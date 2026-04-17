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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, ArrowRight, Zap, Play } from "lucide-react";

interface Automation {
  id: string;
  name: string;
  trigger: string;
  condition: string;
  action: string;
  action_target: string;
  enabled: boolean;
}

const TRIGGERS = [
  "user.login",
  "user.created",
  "user.deleted",
  "file.uploaded",
  "file.deleted",
  "doc.created",
  "doc.shared",
  "task.completed",
  "task.created",
  "event.created",
  "form.submitted",
  "chat.message",
];

const CONDITIONS = [
  "always",
  "if user is admin",
  "if file > 10MB",
  "if in workspace X",
];

const ACTIONS = [
  "send_webhook",
  "send_email",
  "send_slack",
  "send_teams",
  "create_task",
  "log_audit",
];

const ACTION_LABELS: Record<string, string> = {
  send_webhook: "Send Webhook",
  send_email: "Send Email",
  send_slack: "Post to Slack",
  send_teams: "Post to Teams",
  create_task: "Create Task",
  log_audit: "Log to Audit",
};

const SAMPLES: Automation[] = [
  {
    id: "1",
    name: "Notify on new user",
    trigger: "user.created",
    condition: "always",
    action: "send_slack",
    action_target: "#general",
    enabled: true,
  },
  {
    id: "2",
    name: "Log large uploads",
    trigger: "file.uploaded",
    condition: "if file > 10MB",
    action: "log_audit",
    action_target: "audit-trail",
    enabled: true,
  },
];

export function TriggerBuilder() {
  const [automations, setAutomations] = useState<Automation[]>(SAMPLES);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    trigger: "",
    condition: "always",
    action: "",
    action_target: "",
  });

  const add = () => {
    if (!form.name || !form.trigger || !form.action) {
      toast.error("Fill all required fields");
      return;
    }
    setAutomations((as) => [
      ...as,
      { ...form, id: Date.now().toString(), enabled: true },
    ]);
    setOpen(false);
    setForm({
      name: "",
      trigger: "",
      condition: "always",
      action: "",
      action_target: "",
    });
    toast.success("Automation created");
  };

  const toggle = (id: string) =>
    setAutomations((as) =>
      as.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    );
  const remove = (id: string) => {
    setAutomations((as) => as.filter((a) => a.id !== id));
    toast.success("Retiré");
  };

  const testRun = (a: Automation) =>
    toast.success(`Test triggered: ${a.trigger} → ${ACTION_LABELS[a.action]}`);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" /> Automation Trigger Builder
              </CardTitle>
              <CardDescription>
                When X happens, do Y — create event-driven automations
              </CardDescription>
            </div>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Automation
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {automations.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 border rounded-lg p-3"
            >
              <Switch
                checked={a.enabled}
                onCheckedChange={() => toggle(a.id)}
              />
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{a.name}</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Badge variant="outline">{a.trigger}</Badge>
                  {a.condition !== "always" && (
                    <>
                      <ArrowRight className="h-3 w-3" />
                      <Badge variant="secondary">{a.condition}</Badge>
                    </>
                  )}
                  <ArrowRight className="h-3 w-3" />
                  <Badge>{ACTION_LABELS[a.action] || a.action}</Badge>
                  {a.action_target && (
                    <span className="text-muted-foreground">
                      → {a.action_target}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  title="Test run"
                  onClick={() => testRun(a)}
                  aria-label="Test run"
                >
                  <Play className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => remove(a.id)}
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {automations.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">
              No automations yet
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Automation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                placeholder="My automation"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Trigger (When)</Label>
              <Select
                value={form.trigger}
                onValueChange={(v) => setForm((f) => ({ ...f, trigger: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select trigger..." />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Condition (If)</Label>
              <Select
                value={form.condition}
                onValueChange={(v) => setForm((f) => ({ ...f, condition: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Action (Then)</Label>
              <Select
                value={form.action}
                onValueChange={(v) => setForm((f) => ({ ...f, action: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select action..." />
                </SelectTrigger>
                <SelectContent>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {ACTION_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Target (channel, URL, etc.)</Label>
              <Input
                placeholder="#channel or https://..."
                value={form.action_target}
                onChange={(e) =>
                  setForm((f) => ({ ...f, action_target: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={add}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
