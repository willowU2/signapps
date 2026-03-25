"use client";

import { useState } from "react";
import {
  Workflow,
  Plus,
  Trash2,
  ChevronRight,
  Zap,
  Filter,
  Play,
  Save,
  ToggleLeft,
  ToggleRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type TriggerType = "rss" | "blog_post" | "schedule" | "manual";
type ConditionType = "keyword" | "category" | "time_window" | "none";
type ActionType = "post_platforms" | "add_queue" | "send_notification";

interface WorkflowDef {
  id: string;
  name: string;
  trigger: TriggerType;
  triggerConfig: Record<string, string>;
  condition: ConditionType;
  conditionConfig: Record<string, string>;
  action: ActionType;
  actionConfig: Record<string, string>;
  enabled: boolean;
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  rss: "New RSS Item",
  blog_post: "New Blog Post",
  schedule: "Schedule",
  manual: "Manual",
};

const CONDITION_LABELS: Record<ConditionType, string> = {
  keyword: "Contains Keyword",
  category: "Specific Category",
  time_window: "Time Window",
  none: "No Condition",
};

const ACTION_LABELS: Record<ActionType, string> = {
  post_platforms: "Post to Platforms",
  add_queue: "Add to Queue",
  send_notification: "Send Notification",
};

const EMPTY_WORKFLOW: Omit<WorkflowDef, "id"> = {
  name: "",
  trigger: "manual",
  triggerConfig: {},
  condition: "none",
  conditionConfig: {},
  action: "post_platforms",
  actionConfig: {},
  enabled: true,
};

const DEFAULT_WORKFLOWS: WorkflowDef[] = [
  {
    id: "wf1",
    name: "Auto-post RSS to Twitter",
    trigger: "rss",
    triggerConfig: { url: "https://blog.signalaboutapps.com/feed" },
    condition: "keyword",
    conditionConfig: { keyword: "product" },
    action: "post_platforms",
    actionConfig: { platforms: "twitter,linkedin" },
    enabled: true,
  },
];

function WorkflowCard({
  wf,
  onToggle,
  onDelete,
}: {
  wf: WorkflowDef;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-md border bg-background hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{wf.name}</p>
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground flex-wrap">
          <Badge variant="outline" className="text-xs py-0">
            {TRIGGER_LABELS[wf.trigger]}
          </Badge>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <Badge variant="outline" className="text-xs py-0">
            {CONDITION_LABELS[wf.condition]}
          </Badge>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <Badge variant="outline" className="text-xs py-0">
            {ACTION_LABELS[wf.action]}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onToggle(wf.id)}
          title={wf.enabled ? "Disable" : "Enable"}
        >
          {wf.enabled ? (
            <ToggleRight className="w-4 h-4 text-green-500" />
          ) : (
            <ToggleLeft className="w-4 h-4 text-muted-foreground" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(wf.id)}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

export function WorkflowBuilder() {
  const [workflows, setWorkflows] = useState<WorkflowDef[]>(DEFAULT_WORKFLOWS);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Omit<WorkflowDef, "id">>(EMPTY_WORKFLOW);
  const [saving, setSaving] = useState(false);

  const handleToggle = (id: string) => {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    );
  };

  const handleDelete = (id: string) => {
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
    toast.success("Workflow deleted");
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      toast.error("Please name the workflow");
      return;
    }
    setSaving(true);
    try {
      await fetch("http://localhost:3019/api/v1/social/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
    } catch {
      // Save locally even if API fails
    } finally {
      const id = `wf_${Date.now()}`;
      setWorkflows((prev) => [...prev, { ...draft, id }]);
      setDraft(EMPTY_WORKFLOW);
      setCreating(false);
      setSaving(false);
      toast.success("Workflow saved");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Workflow className="w-4 h-4 text-purple-500" />
            Workflow Builder
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => setCreating(!creating)}
          >
            <Plus className="w-3 h-3" />
            New
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Builder form */}
        {creating && (
          <div className="border rounded-md p-3 space-y-3 bg-muted/20">
            <Input
              placeholder="Workflow name..."
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="h-8 text-xs"
            />

            {/* TRIGGER → CONDITION → ACTION cards */}
            <div className="flex items-start gap-2 flex-wrap">
              {/* Trigger */}
              <div className="flex-1 min-w-[140px] space-y-1">
                <Label className="text-xs flex items-center gap-1 text-orange-600">
                  <Zap className="w-3 h-3" /> Trigger
                </Label>
                <Select
                  value={draft.trigger}
                  onValueChange={(v) => setDraft({ ...draft, trigger: v as TriggerType })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(TRIGGER_LABELS) as [TriggerType, string][]).map(
                      ([val, label]) => (
                        <SelectItem key={val} value={val} className="text-xs">
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                {draft.trigger === "rss" && (
                  <Input
                    placeholder="Feed URL..."
                    value={draft.triggerConfig.url ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, triggerConfig: { url: e.target.value } })
                    }
                    className="h-7 text-xs"
                  />
                )}
                {draft.trigger === "schedule" && (
                  <Input
                    placeholder="Cron (e.g. 0 9 * * 1)..."
                    value={draft.triggerConfig.cron ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, triggerConfig: { cron: e.target.value } })
                    }
                    className="h-7 text-xs"
                  />
                )}
              </div>

              <ChevronRight className="w-4 h-4 mt-7 text-muted-foreground shrink-0" />

              {/* Condition */}
              <div className="flex-1 min-w-[140px] space-y-1">
                <Label className="text-xs flex items-center gap-1 text-blue-600">
                  <Filter className="w-3 h-3" /> Condition
                </Label>
                <Select
                  value={draft.condition}
                  onValueChange={(v) =>
                    setDraft({ ...draft, condition: v as ConditionType })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(CONDITION_LABELS) as [ConditionType, string][]).map(
                      ([val, label]) => (
                        <SelectItem key={val} value={val} className="text-xs">
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                {draft.condition === "keyword" && (
                  <Input
                    placeholder="Keyword..."
                    value={draft.conditionConfig.keyword ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, conditionConfig: { keyword: e.target.value } })
                    }
                    className="h-7 text-xs"
                  />
                )}
                {draft.condition === "category" && (
                  <Input
                    placeholder="Category name..."
                    value={draft.conditionConfig.category ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, conditionConfig: { category: e.target.value } })
                    }
                    className="h-7 text-xs"
                  />
                )}
                {draft.condition === "time_window" && (
                  <div className="flex gap-1">
                    <Input
                      placeholder="From (HH:mm)"
                      value={draft.conditionConfig.from ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          conditionConfig: { ...draft.conditionConfig, from: e.target.value },
                        })
                      }
                      className="h-7 text-xs"
                    />
                    <Input
                      placeholder="To"
                      value={draft.conditionConfig.to ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          conditionConfig: { ...draft.conditionConfig, to: e.target.value },
                        })
                      }
                      className="h-7 text-xs"
                    />
                  </div>
                )}
              </div>

              <ChevronRight className="w-4 h-4 mt-7 text-muted-foreground shrink-0" />

              {/* Action */}
              <div className="flex-1 min-w-[140px] space-y-1">
                <Label className="text-xs flex items-center gap-1 text-green-600">
                  <Play className="w-3 h-3" /> Action
                </Label>
                <Select
                  value={draft.action}
                  onValueChange={(v) => setDraft({ ...draft, action: v as ActionType })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(ACTION_LABELS) as [ActionType, string][]).map(
                      ([val, label]) => (
                        <SelectItem key={val} value={val} className="text-xs">
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                {draft.action === "post_platforms" && (
                  <Input
                    placeholder="Platforms (comma-sep)..."
                    value={draft.actionConfig.platforms ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, actionConfig: { platforms: e.target.value } })
                    }
                    className="h-7 text-xs"
                  />
                )}
                {draft.action === "send_notification" && (
                  <Input
                    placeholder="Recipient email..."
                    value={draft.actionConfig.email ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, actionConfig: { email: e.target.value } })
                    }
                    className="h-7 text-xs"
                  />
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setCreating(false)}
              >
                Cancel
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                Save
              </Button>
            </div>
          </div>
        )}

        {/* Workflow list */}
        {workflows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No workflows yet. Create one to automate your social posting.
          </p>
        ) : (
          <div className="space-y-2">
            {workflows.map((wf) => (
              <WorkflowCard
                key={wf.id}
                wf={wf}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
