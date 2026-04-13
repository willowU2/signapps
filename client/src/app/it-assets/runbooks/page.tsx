"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen,
  Plus,
  Trash2,
  Play,
  ArrowDown,
  GitBranch,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Bell,
  Ticket,
  RefreshCw,
  Mail,
} from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { getClient, ServiceName } from "@/lib/api/factory";

// ─── Types ────────────────────────────────────────────────────────────────────

type StepType =
  | "run_script"
  | "check_condition"
  | "wait"
  | "send_notification"
  | "create_ticket"
  | "reboot";

interface RunbookStep {
  id: string;
  type: StepType;
  label: string;
  config: Record<string, string | number | boolean>;
  on_success_id?: string | null;
  on_failure_id?: string | null;
  condition_true_id?: string | null;
  condition_false_id?: string | null;
}

interface Runbook {
  id: string;
  name: string;
  description?: string;
  steps: RunbookStep[];
  tags: string[];
  last_run_at?: string;
  last_run_status?: "success" | "failure" | "running";
  run_count: number;
  created_at: string;
}

interface RunResult {
  run_id: string;
  status: "running" | "success" | "failure";
  execution_log: Array<{
    step_id: string;
    label: string;
    status: string;
    output?: string;
  }>;
}

// ─── API ──────────────────────────────────────────────────────────────────────

const client = getClient(ServiceName.IT_ASSETS);

const runbooksApi = {
  list: () => client.get<Runbook[]>("/it-assets/runbooks"),
  create: (data: {
    name: string;
    description?: string;
    steps: RunbookStep[];
  }) => client.post<Runbook>("/it-assets/runbooks", data),
  delete: (id: string) => client.delete(`/it-assets/runbooks/${id}`),
  run: (id: string) =>
    client.post<RunResult>(`/it-assets/runbooks/${id}/run`, {}),
};

// ─── Step type config ─────────────────────────────────────────────────────────

const STEP_ICONS: Record<StepType, React.ReactNode> = {
  run_script: <Terminal className="h-4 w-4 text-purple-500" />,
  check_condition: <GitBranch className="h-4 w-4 text-yellow-500" />,
  wait: <Clock className="h-4 w-4 text-blue-500" />,
  send_notification: <Bell className="h-4 w-4 text-orange-500" />,
  create_ticket: <Ticket className="h-4 w-4 text-cyan-500" />,
  reboot: <RefreshCw className="h-4 w-4 text-red-500" />,
};

const STEP_LABELS: Record<StepType, string> = {
  run_script: "Run Script",
  check_condition: "Check Condition",
  wait: "Wait",
  send_notification: "Send Notification",
  create_ticket: "Create Ticket",
  reboot: "Reboot",
};

// ─── Step editor ─────────────────────────────────────────────────────────────

function StepEditor({
  step,
  index,
  total,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  step: RunbookStep;
  index: number;
  total: number;
  onChange: (s: RunbookStep) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const setConfig = (k: string, v: string | number | boolean) =>
    onChange({ ...step, config: { ...step.config, [k]: v } });

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
          {index + 1}
        </span>
        {STEP_ICONS[step.type]}
        <span className="font-medium text-sm flex-1">
          {step.label || STEP_LABELS[step.type]}
        </span>
        <div className="flex gap-1 ml-auto">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={onMoveUp}
            disabled={index === 0}
          >
            <ArrowDown className="h-3 w-3 rotate-180" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={onMoveDown}
            disabled={index === total - 1}
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Step label</Label>
          <Input
            className="mt-0.5 h-7 text-xs"
            value={step.label}
            onChange={(e) => onChange({ ...step, label: e.target.value })}
            placeholder={STEP_LABELS[step.type]}
          />
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <Select
            value={step.type}
            onValueChange={(v) =>
              onChange({ ...step, type: v as StepType, config: {} })
            }
          >
            <SelectTrigger className="mt-0.5 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STEP_LABELS) as StepType[]).map((t) => (
                <SelectItem key={t} value={t} className="text-xs">
                  <span className="flex items-center gap-1.5">
                    {STEP_ICONS[t]}
                    {STEP_LABELS[t]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Type-specific config */}
      {step.type === "run_script" && (
        <div>
          <Label className="text-xs">Script</Label>
          <Textarea
            className="mt-0.5 font-mono text-xs min-h-20"
            value={String(step.config.script ?? "")}
            onChange={(e) => setConfig("script", e.target.value)}
            placeholder="#!/bin/bash&#10;systemctl restart nginx"
          />
        </div>
      )}

      {step.type === "check_condition" && (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Condition expression</Label>
            <Input
              className="mt-0.5 h-7 text-xs font-mono"
              value={String(step.config.expression ?? "")}
              onChange={(e) => setConfig("expression", e.target.value)}
              placeholder="$EXIT_CODE == 0"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-emerald-600">
                On true → go to step
              </Label>
              <Input
                className="mt-0.5 h-7 text-xs"
                value={String(step.condition_true_id ?? "")}
                onChange={(e) =>
                  onChange({
                    ...step,
                    condition_true_id: e.target.value || null,
                  })
                }
                placeholder="next"
              />
            </div>
            <div>
              <Label className="text-xs text-destructive">
                On false → go to step
              </Label>
              <Input
                className="mt-0.5 h-7 text-xs"
                value={String(step.condition_false_id ?? "")}
                onChange={(e) =>
                  onChange({
                    ...step,
                    condition_false_id: e.target.value || null,
                  })
                }
                placeholder="end"
              />
            </div>
          </div>
        </div>
      )}

      {step.type === "wait" && (
        <div>
          <Label className="text-xs">Wait duration (seconds)</Label>
          <Input
            className="mt-0.5 h-7 text-xs w-32"
            type="number"
            value={String(step.config.seconds ?? 30)}
            onChange={(e) => setConfig("seconds", Number(e.target.value))}
          />
        </div>
      )}

      {step.type === "send_notification" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Channel</Label>
            <Select
              value={String(step.config.channel ?? "email")}
              onValueChange={(v) => setConfig("channel", v)}
            >
              <SelectTrigger className="mt-0.5 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Recipient</Label>
            <Input
              className="mt-0.5 h-7 text-xs"
              value={String(step.config.recipient ?? "")}
              onChange={(e) => setConfig("recipient", e.target.value)}
              placeholder="admin@example.com"
            />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Message</Label>
            <Input
              className="mt-0.5 h-7 text-xs"
              value={String(step.config.message ?? "")}
              onChange={(e) => setConfig("message", e.target.value)}
              placeholder="Alert: service restarted"
            />
          </div>
        </div>
      )}

      {step.type === "create_ticket" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Title</Label>
            <Input
              className="mt-0.5 h-7 text-xs"
              value={String(step.config.title ?? "")}
              onChange={(e) => setConfig("title", e.target.value)}
              placeholder="Auto-generated ticket"
            />
          </div>
          <div>
            <Label className="text-xs">Priority</Label>
            <Select
              value={String(step.config.priority ?? "medium")}
              onValueChange={(v) => setConfig("priority", v)}
            >
              <SelectTrigger className="mt-0.5 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {step.type === "reboot" && (
        <div>
          <Label className="text-xs">Delay (seconds before reboot)</Label>
          <Input
            className="mt-0.5 h-7 text-xs w-32"
            type="number"
            value={String(step.config.delay_seconds ?? 5)}
            onChange={(e) => setConfig("delay_seconds", Number(e.target.value))}
          />
        </div>
      )}
    </div>
  );
}

// ─── Runbook Form ─────────────────────────────────────────────────────────────

function mkStep(type: StepType): RunbookStep {
  return {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    label: "",
    config: {},
  };
}

function RunbookFormDialog({
  onSave,
  onClose,
}: {
  onSave: (data: {
    name: string;
    description?: string;
    steps: RunbookStep[];
  }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<RunbookStep[]>([mkStep("run_script")]);

  function addStep() {
    setSteps((s) => [...s, mkStep("run_script")]);
  }
  function updateStep(i: number, s: RunbookStep) {
    setSteps((prev) => prev.map((p, idx) => (idx === i ? s : p)));
  }
  function deleteStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }
  function moveStep(i: number, dir: -1 | 1) {
    setSteps((prev) => {
      const arr = [...prev];
      const tmp = arr[i];
      arr[i] = arr[i + dir];
      arr[i + dir] = tmp;
      return arr;
    });
  }

  function submit() {
    if (!name) return;
    onSave({ name, description: description || undefined, steps });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Runbook</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input
                className="mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Restart web server"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                className="mt-1"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Steps ({steps.length})</Label>
              <Button size="sm" variant="outline" onClick={addStep}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Step
              </Button>
            </div>
            {steps.map((step, i) => (
              <div key={step.id}>
                <StepEditor
                  step={step}
                  index={i}
                  total={steps.length}
                  onChange={(s) => updateStep(i, s)}
                  onDelete={() => deleteStep(i)}
                  onMoveUp={() => moveStep(i, -1)}
                  onMoveDown={() => moveStep(i, 1)}
                />
                {i < steps.length - 1 && (
                  <div className="flex items-center justify-center py-1">
                    <ArrowDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Create Runbook</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Run Execution Panel ──────────────────────────────────────────────────────

function ExecutionPanel({
  result,
  onClose,
}: {
  result: RunResult;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Runbook Execution</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Badge
            variant={
              result.status === "success"
                ? "default"
                : result.status === "failure"
                  ? "destructive"
                  : "secondary"
            }
          >
            {result.status === "running" ? "Running…" : result.status}
          </Badge>
          <div className="space-y-1.5 mt-3">
            {result.execution_log.map((entry, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm rounded border p-2"
              >
                {entry.status === "ok" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                ) : entry.status === "fail" ? (
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className="font-medium">{entry.label}</p>
                  {entry.output && (
                    <p className="text-xs text-muted-foreground font-mono">
                      {entry.output}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RunbooksPage() {
  usePageTitle("Runbooks");
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  const { data: runbooks = [], isLoading } = useQuery<Runbook[]>({
    queryKey: ["runbooks"],
    queryFn: () => runbooksApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof runbooksApi.create>[0]) =>
      runbooksApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["runbooks"] });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => runbooksApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["runbooks"] }),
  });

  const runMutation = useMutation({
    mutationFn: (id: string) => runbooksApi.run(id),
    onSuccess: (r) => {
      setRunResult(r.data);
      qc.invalidateQueries({ queryKey: ["runbooks"] });
    },
  });

  function statusBadge(status?: string) {
    if (!status) return null;
    const map: Record<
      string,
      { label: string; variant: "default" | "destructive" | "secondary" }
    > = {
      success: { label: "Success", variant: "default" },
      failure: { label: "Failed", variant: "destructive" },
      running: { label: "Running", variant: "secondary" },
    };
    const m = map[status];
    if (!m) return null;
    return (
      <Badge variant={m.variant} className="text-xs">
        {m.label}
      </Badge>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              Runbook Automation
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Build and execute sequential automation playbooks
            </p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Runbook
          </Button>
        </div>

        <div className="grid gap-4">
          {isLoading && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Loading runbooks…
            </p>
          )}

          {!isLoading && runbooks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold">Aucun runbook</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Creez un runbook pour automatiser les procedures
                operationnelles.
              </p>
            </div>
          )}

          {runbooks.map((rb) => (
            <Card key={rb.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{rb.name}</CardTitle>
                    {rb.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {rb.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {statusBadge(rb.last_run_status)}
                    <Button
                      size="sm"
                      onClick={() => runMutation.mutate(rb.id)}
                      disabled={runMutation.isPending}
                    >
                      <Play className="h-3.5 w-3.5 mr-1.5" />
                      Run
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(rb.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <span>
                    {rb.steps.length} step{rb.steps.length !== 1 ? "s" : ""}
                  </span>
                  <span>·</span>
                  <span>
                    Run {rb.run_count} time{rb.run_count !== 1 ? "s" : ""}
                  </span>
                  {rb.last_run_at && (
                    <>
                      <span>·</span>
                      <span>
                        Last run: {new Date(rb.last_run_at).toLocaleString()}
                      </span>
                    </>
                  )}
                </div>

                {/* Step preview */}
                <div className="flex items-center gap-1 flex-wrap">
                  {rb.steps.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-1">
                      <div className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded">
                        {STEP_ICONS[step.type]}
                        <span>{step.label || STEP_LABELS[step.type]}</span>
                      </div>
                      {i < rb.steps.length - 1 && (
                        <ArrowDown className="h-3 w-3 text-muted-foreground rotate-[-90deg]" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {showForm && (
        <RunbookFormDialog
          onSave={(data) => createMutation.mutate(data)}
          onClose={() => setShowForm(false)}
        />
      )}
      {runResult && (
        <ExecutionPanel result={runResult} onClose={() => setRunResult(null)} />
      )}
    </AppLayout>
  );
}
