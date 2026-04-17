"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BookOpen,
  Play,
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { itAssetsApi } from "@/lib/api/it-assets";
import { usePageTitle } from "@/hooks/use-page-title";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlaybookStep {
  action_type: string;
  config: Record<string, unknown>;
  on_failure: "continue" | "stop" | "escalate";
}

interface Playbook {
  id: string;
  name: string;
  description?: string;
  steps: PlaybookStep[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface PlaybookRun {
  id: string;
  playbook_id: string;
  hardware_id?: string;
  status: string;
  step_results: Array<{
    step_index: number;
    action_type: string;
    status: string;
    output?: string;
    error?: string;
    started_at?: string;
    completed_at?: string;
  }>;
  started_at: string;
  completed_at?: string;
}

// ─── Step editor ─────────────────────────────────────────────────────────────

const ACTION_TYPES = [
  { value: "check_service", label: "Check service status" },
  { value: "restart_service", label: "Restart service" },
  { value: "wait", label: "Wait (seconds)" },
  { value: "run_script", label: "Run script" },
  { value: "create_ticket", label: "Create ticket" },
  { value: "send_alert", label: "Send alert" },
  { value: "reboot", label: "Reboot machine" },
];

function StepRow({
  step,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  step: PlaybookStep;
  index: number;
  total: number;
  onChange: (s: PlaybookStep) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50">
      <span className="text-xs font-mono text-gray-500 w-6">{index + 1}</span>

      <Select
        value={step.action_type}
        onValueChange={(v) => onChange({ ...step, action_type: v })}
      >
        <SelectTrigger className="w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ACTION_TYPES.map((a) => (
            <SelectItem key={a.value} value={a.value}>
              {a.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        className="flex-1 h-8 text-sm"
        placeholder="Config JSON (optional)"
        value={
          Object.keys(step.config).length ? JSON.stringify(step.config) : ""
        }
        onChange={(e) => {
          try {
            const cfg = e.target.value ? JSON.parse(e.target.value) : {};
            onChange({ ...step, config: cfg });
          } catch {
            // keep as-is while user types
          }
        }}
      />

      <Select
        value={step.on_failure}
        onValueChange={(v) =>
          onChange({ ...step, on_failure: v as PlaybookStep["on_failure"] })
        }
      >
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="stop">Stop on fail</SelectItem>
          <SelectItem value="continue">Continue</SelectItem>
          <SelectItem value="escalate">Escalate</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={index === 0}
          onClick={onMoveUp}
          aria-label="Monter l'étape"
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={index === total - 1}
          onClick={onMoveDown}
          aria-label="Descendre l'étape"
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-red-500 hover:text-red-700"
          onClick={onRemove}
          aria-label="Supprimer l'étape"
        >
          <Trash2 className="h-3 w-3" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

// ─── Playbook dialog ──────────────────────────────────────────────────────────

function PlaybookDialog({
  open,
  onClose,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  existing?: Playbook;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [steps, setSteps] = useState<PlaybookStep[]>(existing?.steps ?? []);

  const createMut = useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      steps: PlaybookStep[];
    }) => itAssetsApi.createPlaybook(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playbooks"] });
      onClose();
    },
  });
  const updateMut = useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      steps: PlaybookStep[];
    }) => itAssetsApi.updatePlaybook(existing!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playbooks"] });
      onClose();
    },
  });

  const isLoading = createMut.isPending || updateMut.isPending;

  function addStep() {
    setSteps((prev) => [
      ...prev,
      { action_type: "check_service", config: {}, on_failure: "stop" },
    ]);
  }

  function updateStep(i: number, s: PlaybookStep) {
    setSteps((prev) => prev.map((x, idx) => (idx === i ? s : x)));
  }

  function removeStep(i: number) {
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

  function save() {
    const payload = { name, description: description || undefined, steps };
    if (existing) updateMut.mutate(payload);
    else createMut.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit Playbook" : "New Remediation Playbook"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Service Restart Playbook"
            />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this playbook do?"
              rows={2}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Steps ({steps.length})</Label>
              <Button variant="outline" size="sm" onClick={addStep}>
                <Plus className="h-3 w-3 mr-1" /> Add Step
              </Button>
            </div>

            {steps.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-6 border rounded-lg border-dashed">
                No steps yet. Add one to get started.
              </p>
            )}

            <div className="space-y-2">
              {steps.map((step, i) => (
                <StepRow
                  key={i}
                  step={step}
                  index={i}
                  total={steps.length}
                  onChange={(s) => updateStep(i, s)}
                  onRemove={() => removeStep(i)}
                  onMoveUp={() => moveStep(i, -1)}
                  onMoveDown={() => moveStep(i, 1)}
                />
              ))}
            </div>
          </div>

          {/* Example pre-filled */}
          <div className="text-xs text-gray-400 bg-gray-50 rounded p-3">
            <strong>Example — Service Restart Playbook:</strong>
            <ol className="list-decimal list-inside mt-1 space-y-0.5">
              <li>Check service status → on_failure: stop</li>
              <li>Restart service → on_failure: escalate</li>
              <li>Wait 30s → on_failure: continue</li>
              <li>Check service status again → on_failure: escalate</li>
              <li>Create ticket if still down → on_failure: continue</li>
            </ol>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!name.trim() || isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {existing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Run status badge ─────────────────────────────────────────────────────────

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    { label: string; color: string; icon: React.ReactNode }
  > = {
    running: {
      label: "Running",
      color: "bg-blue-100 text-blue-800",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    completed: {
      label: "Completed",
      color: "bg-green-100 text-green-800",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    failed: {
      label: "Failed",
      color: "bg-red-100 text-red-800",
      icon: <XCircle className="h-3 w-3" />,
    },
    escalated: {
      label: "Escalated",
      color: "bg-orange-100 text-orange-800",
      icon: <Clock className="h-3 w-3" />,
    },
  };
  const cfg = map[status] ?? map.running;
  return (
    <Badge
      variant="outline"
      className={`flex items-center gap-1 text-xs ${cfg.color}`}
    >
      {cfg.icon} {cfg.label}
    </Badge>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlaybooksPage() {
  usePageTitle("Remediation Playbooks");

  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Playbook | undefined>();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: playbooks = [], isLoading } = useQuery({
    queryKey: ["playbooks"],
    queryFn: () => itAssetsApi.listPlaybooks().then((r) => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => itAssetsApi.deletePlaybook(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playbooks"] }),
  });

  const runMut = useMutation({
    mutationFn: (id: string) => itAssetsApi.runPlaybook(id, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playbooks"] }),
  });

  function openCreate() {
    setEditTarget(undefined);
    setDialogOpen(true);
  }

  function openEdit(pb: Playbook) {
    setEditTarget(pb);
    setDialogOpen(true);
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <BookOpen className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Remediation Playbooks</h1>
              <p className="text-sm text-gray-500">
                Define automated sequences of actions triggered on alerts or
                manually.
              </p>
            </div>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> New Playbook
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Playbooks ({playbooks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : playbooks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold">Aucun playbook</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Creez un playbook pour automatiser la remediation d'incidents.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Steps</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {playbooks.map((pb: Playbook) => (
                    <>
                      <TableRow
                        key={pb.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() =>
                          setExpandedId(expandedId === pb.id ? null : pb.id)
                        }
                      >
                        <TableCell>
                          <div className="font-medium">{pb.name}</div>
                          {pb.description && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {pb.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {pb.steps.length} step
                            {pb.steps.length !== 1 ? "s" : ""}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              pb.enabled
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-600"
                            }
                          >
                            {pb.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {new Date(pb.updated_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div
                            className="flex justify-end gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => runMut.mutate(pb.id)}
                              disabled={runMut.isPending}
                            >
                              <Play className="h-3 w-3 mr-1" /> Run
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(pb)}
                              aria-label={`Modifier ${pb.name}`}
                            >
                              <Pencil
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700"
                              onClick={() => deleteMut.mutate(pb.id)}
                              aria-label={`Supprimer ${pb.name}`}
                            >
                              <Trash2
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded step list */}
                      {expandedId === pb.id && pb.steps.length > 0 && (
                        <TableRow key={`${pb.id}-steps`}>
                          <TableCell colSpan={5} className="bg-gray-50 py-3">
                            <div className="space-y-1.5 px-2">
                              {pb.steps.map((step, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-3 text-sm"
                                >
                                  <span className="text-xs font-mono text-gray-400 w-5">
                                    {i + 1}
                                  </span>
                                  <span className="font-medium text-gray-700">
                                    {ACTION_TYPES.find(
                                      (a) => a.value === step.action_type,
                                    )?.label ?? step.action_type}
                                  </span>
                                  {Object.keys(step.config).length > 0 && (
                                    <span className="text-xs text-gray-500 font-mono">
                                      {JSON.stringify(step.config)}
                                    </span>
                                  )}
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ml-auto ${
                                      step.on_failure === "escalate"
                                        ? "bg-orange-50 text-orange-700"
                                        : step.on_failure === "continue"
                                          ? "bg-blue-50 text-blue-700"
                                          : "bg-red-50 text-red-700"
                                    }`}
                                  >
                                    on failure: {step.on_failure}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {dialogOpen && (
        <PlaybookDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          existing={editTarget}
        />
      )}
    </AppLayout>
  );
}
