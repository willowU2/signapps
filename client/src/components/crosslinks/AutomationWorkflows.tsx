"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Zap, Play, Pause, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";

const client = () => getClient(ServiceName.IDENTITY);

interface Workflow {
  id: string;
  name: string;
  enabled: boolean;
  trigger_module: string;
  trigger_event: string;
  action_module: string;
  action_type: string;
  action_config: Record<string, unknown>;
  runs: number;
  last_run?: string;
  created_at: string;
}

const MODULES = [
  { value: "docs", label: "Documents" },
  { value: "mail", label: "Mail" },
  { value: "calendar", label: "Calendrier" },
  { value: "tasks", label: "Tâches" },
  { value: "contacts", label: "Contacts" },
  { value: "drive", label: "Drive" },
  { value: "chat", label: "Chat" },
];

const TRIGGER_EVENTS: Record<string, string[]> = {
  docs: ["document.created", "document.updated", "document.shared"],
  mail: ["mail.received", "mail.sent", "mail.starred"],
  calendar: ["event.created", "event.starting", "event.cancelled"],
  tasks: ["task.created", "task.completed", "task.overdue"],
  contacts: ["contact.created", "contact.updated"],
  drive: ["file.uploaded", "file.shared"],
  chat: ["message.received", "mention.created"],
};

const ACTION_TYPES: Record<string, string[]> = {
  docs: ["create_document", "share_document"],
  mail: ["send_notification", "send_email"],
  calendar: ["create_event", "invite_participants"],
  tasks: ["create_task", "assign_task"],
  contacts: ["update_contact", "add_tag"],
  chat: ["send_message", "create_channel"],
  drive: ["create_folder", "move_file"],
};

export function AutomationWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    trigger_module: "docs",
    trigger_event: "",
    action_module: "mail",
    action_type: "",
  });

  const load = useCallback(async () => {
    try {
      const { data } = await client().get<Workflow[]>("/automation/workflows");
      setWorkflows(data);
    } catch {
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (w: Workflow) => {
    try {
      await client().patch(`/automation/workflows/${w.id}`, {
        enabled: !w.enabled,
      });
      setWorkflows((prev) =>
        prev.map((wf) =>
          wf.id === w.id ? { ...wf, enabled: !wf.enabled } : wf,
        ),
      );
    } catch {
      toast.error("Erreur");
    }
  };

  const remove = async (id: string) => {
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
    try {
      await client().delete(`/automation/workflows/${id}`);
    } catch {
      toast.error("Erreur");
    }
  };

  const save = async () => {
    try {
      const { data } = await client().post<Workflow>("/automation/workflows", {
        ...form,
        action_config: {},
        enabled: true,
      });
      setWorkflows((prev) => [...prev, data]);
      setOpen(false);
      toast.success("Automatisation créée");
    } catch {
      const local: Workflow = {
        id: `local-${Date.now()}`,
        ...form,
        action_config: {},
        enabled: true,
        runs: 0,
        created_at: new Date().toISOString(),
      };
      setWorkflows((prev) => [...prev, local]);
      setOpen(false);
      toast.success("Automatisation créée (locale)");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {workflows.length} automation(s) configurée(s)
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nouvelle automatisation
        </Button>
      </div>

      {loading && <div className="animate-pulse h-24 rounded-lg bg-muted" />}

      <div className="space-y-2">
        {workflows.map((w) => (
          <div
            key={w.id}
            className="flex items-center gap-3 p-3 rounded-lg border"
          >
            <Zap
              className={`w-4 h-4 shrink-0 ${w.enabled ? "text-yellow-500" : "text-muted-foreground"}`}
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {w.name || "Sans nom"}
              </p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{w.trigger_module}</span>
                <ChevronRight className="w-3 h-3" />
                <span>{w.trigger_event}</span>
                <ChevronRight className="w-3 h-3" />
                <span>{w.action_module}</span>
                {w.runs > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs h-4">
                    {w.runs} runs
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={w.enabled}
                onCheckedChange={() => toggle(w)}
                className="scale-75"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={() => remove(w.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {!loading && workflows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <Zap className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Aucune automatisation</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpen(true)}
              className="mt-2"
            >
              Créer
            </Button>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle automatisation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nom</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Mon automatisation"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Module déclencheur</Label>
                <Select
                  value={form.trigger_module}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      trigger_module: v,
                      trigger_event: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODULES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Événement</Label>
                <Select
                  value={form.trigger_event}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, trigger_event: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(TRIGGER_EVENTS[form.trigger_module] || []).map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Module cible</Label>
                <Select
                  value={form.action_module}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      action_module: v,
                      action_type: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODULES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Action</Label>
                <Select
                  value={form.action_type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, action_type: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(ACTION_TYPES[form.action_module] || []).map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={save}
              disabled={!form.name || !form.trigger_event || !form.action_type}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
