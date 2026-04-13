"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Terminal,
  Plus,
  Trash2,
  Edit,
  Play,
  Clock,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatDistanceToNow } from "date-fns";

const client = getClient(ServiceName.IT_ASSETS);

// ─── Types ───────────────────────────────────────────────────────────────────

interface Script {
  id: string;
  name: string;
  description?: string;
  category?: string;
  script_type: string;
  content: string;
  parameters: unknown[];
  version: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface ScheduledScript {
  id: string;
  script_id?: string;
  hardware_id?: string;
  group_id?: string;
  cron_expression: string;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
  created_at: string;
}

const SCRIPT_TYPES = [
  { value: "bash", label: "Bash" },
  { value: "powershell", label: "PowerShell" },
  { value: "python", label: "Python" },
  { value: "batch", label: "Batch (.bat)" },
];

const CATEGORIES = [
  "maintenance",
  "security",
  "monitoring",
  "deployment",
  "diagnostics",
  "cleanup",
  "custom",
];

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useScripts() {
  return useQuery({
    queryKey: ["it-scripts"],
    queryFn: () =>
      client.get<Script[]>("/it-assets/script-library").then((r) => r.data),
  });
}

function useSchedules() {
  return useQuery({
    queryKey: ["it-schedules"],
    queryFn: () =>
      client
        .get<ScheduledScript[]>("/it-assets/script-library/schedules")
        .then((r) => r.data),
  });
}

// ─── Script type badge ────────────────────────────────────────────────────────

function ScriptTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    bash: "bg-green-100 text-green-800",
    powershell: "bg-blue-100 text-blue-800",
    python: "bg-yellow-100 text-yellow-800",
    batch: "bg-gray-100 text-gray-800",
  };
  return (
    <Badge
      variant="outline"
      className={`text-xs ${colors[type] ?? "bg-gray-100"}`}
    >
      {type}
    </Badge>
  );
}

// ─── Run dialog ───────────────────────────────────────────────────────────────

function RunDialog({
  script,
  onClose,
}: {
  script: Script;
  onClose: () => void;
}) {
  const [targetIds, setTargetIds] = useState("");
  const [running, setRunning] = useState(false);

  const run = async () => {
    const ids = targetIds
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      toast.error("Enter at least one hardware ID");
      return;
    }
    setRunning(true);
    try {
      const result = await client.post<{ queued: number }>(
        `/it-assets/script-library/${script.id}/run`,
        {
          hardware_ids: ids,
        },
      );
      toast.success(`Queued on ${result.data.queued} device(s)`);
      onClose();
    } catch {
      toast.error("Failed to queue script");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run: {script.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Target Hardware IDs (one per line or comma-separated)</Label>
            <Textarea
              value={targetIds}
              onChange={(e) => setTargetIds(e.target.value)}
              rows={4}
              placeholder="uuid-1&#10;uuid-2"
              className="font-mono text-sm"
            />
          </div>
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">
              {script.content.slice(0, 200)}
              {script.content.length > 200 ? "…" : ""}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={run} disabled={running}>
            <Play className="h-4 w-4 mr-1" />
            {running ? "Queuing…" : "Run Now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Schedule dialog ──────────────────────────────────────────────────────────

function ScheduleDialog({
  scripts,
  onClose,
}: {
  scripts: Script[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [scriptId, setScriptId] = useState("");
  const [cron, setCron] = useState("0 2 * * *");
  const [hardwareId, setHardwareId] = useState("");

  const create = useMutation({
    mutationFn: (data: {
      script_id: string;
      cron_expression: string;
      hardware_id?: string;
    }) => client.post("/it-assets/script-library/schedules", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it-schedules"] });
      toast.success("Schedule created");
      onClose();
    },
    onError: () => toast.error("Failed to create schedule"),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Schedule</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Script *</Label>
            <Select value={scriptId} onValueChange={setScriptId}>
              <SelectTrigger>
                <SelectValue placeholder="Select script…" />
              </SelectTrigger>
              <SelectContent>
                {scripts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Cron Expression *</Label>
            <Input
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              className="font-mono"
              placeholder="0 2 * * *"
            />
            <p className="text-xs text-muted-foreground">
              Format: minute hour day month weekday — e.g.{" "}
              <code>0 2 * * *</code> = daily at 2am
            </p>
          </div>
          <div className="space-y-1">
            <Label>Target Hardware ID (optional)</Label>
            <Input
              value={hardwareId}
              onChange={(e) => setHardwareId(e.target.value)}
              placeholder="Leave blank for all"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              create.mutate({
                script_id: scriptId,
                cron_expression: cron,
                hardware_id: hardwareId || undefined,
              })
            }
            disabled={!scriptId || !cron || create.isPending}
          >
            Create Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ScriptsPage() {
  usePageTitle("Script Library");
  const qc = useQueryClient();
  const { data: scripts = [], isLoading } = useScripts();
  const { data: schedules = [] } = useSchedules();

  const [scriptDialog, setScriptDialog] = useState(false);
  const [runDialog, setRunDialog] = useState<Script | null>(null);
  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [editScript, setEditScript] = useState<Script | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("maintenance");
  const [scriptType, setScriptType] = useState("bash");
  const [content, setContent] = useState("");

  const [search, setSearch] = useState("");

  const createScript = useMutation({
    mutationFn: (data: Partial<Script>) =>
      client.post("/it-assets/script-library", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it-scripts"] });
      setScriptDialog(false);
      toast.success("Script created");
    },
    onError: () => toast.error("Failed to create script"),
  });

  const updateScript = useMutation({
    mutationFn: ({ id, ...data }: Partial<Script> & { id: string }) =>
      client.put(`/it-assets/script-library/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it-scripts"] });
      setScriptDialog(false);
      toast.success("Script updated");
    },
    onError: () => toast.error("Failed to update script"),
  });

  const deleteScript = useMutation({
    mutationFn: (id: string) =>
      client.delete(`/it-assets/script-library/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it-scripts"] });
      toast.success("Script deleted");
    },
    onError: () => toast.error("Failed to delete script"),
  });

  const deleteSchedule = useMutation({
    mutationFn: (id: string) =>
      client.delete(`/it-assets/script-library/schedules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it-schedules"] });
      toast.success("Schedule deleted");
    },
  });

  const openCreate = () => {
    setEditScript(null);
    setName("");
    setDescription("");
    setCategory("maintenance");
    setScriptType("bash");
    setContent("");
    setScriptDialog(true);
  };

  const openEdit = (s: Script) => {
    setEditScript(s);
    setName(s.name);
    setDescription(s.description ?? "");
    setCategory(s.category ?? "maintenance");
    setScriptType(s.script_type);
    setContent(s.content);
    setScriptDialog(true);
  };

  const submitScript = () => {
    const payload = {
      name,
      description: description || undefined,
      category,
      script_type: scriptType,
      content,
    };
    if (editScript) {
      updateScript.mutate({ id: editScript.id, ...payload });
    } else {
      createScript.mutate(payload);
    }
  };

  const filtered = scripts.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.category ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const grouped = CATEGORIES.reduce<Record<string, Script[]>>((acc, cat) => {
    acc[cat] = filtered.filter((s) => s.category === cat);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Terminal className="h-6 w-6 text-green-600" />
              Script Library
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage, run, and schedule scripts across your device fleet
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setScheduleDialog(true)}>
              <Calendar className="h-4 w-4 mr-1" />
              Schedules
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              New Script
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Input
            className="max-w-xs"
            placeholder="Search scripts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-sm text-muted-foreground">
            {filtered.length} scripts
          </span>
        </div>

        <Tabs defaultValue="library">
          <TabsList>
            <TabsTrigger value="library">
              <Terminal className="h-4 w-4 mr-1" />
              Library
            </TabsTrigger>
            <TabsTrigger value="schedules">
              <Clock className="h-4 w-4 mr-1" />
              Schedules ({schedules.length})
            </TabsTrigger>
          </TabsList>

          {/* ── Library tab ── */}
          <TabsContent value="library" className="space-y-4">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Chargement...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Terminal className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold">Aucun script</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Creez un script pour automatiser les taches de maintenance.
                </p>
              </div>
            ) : (
              Object.entries(grouped).map(([cat, catScripts]) =>
                catScripts.length > 0 ? (
                  <Card key={cat}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm capitalize text-muted-foreground">
                        {cat}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Version</TableHead>
                            <TableHead>Updated</TableHead>
                            <TableHead className="w-28">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {catScripts.map((script) => (
                            <TableRow key={script.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{script.name}</p>
                                  {script.description && (
                                    <p className="text-xs text-muted-foreground">
                                      {script.description}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <ScriptTypeBadge type={script.script_type} />
                              </TableCell>
                              <TableCell className="text-sm">
                                v{script.version}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDistanceToNow(
                                  new Date(script.updated_at),
                                  { addSuffix: true },
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    title="Run"
                                    onClick={() => setRunDialog(script)}
                                  >
                                    <Play className="h-3.5 w-3.5 text-green-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openEdit(script)}
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-500"
                                    onClick={() =>
                                      deleteScript.mutate(script.id)
                                    }
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ) : null,
              )
            )}
          </TabsContent>

          {/* ── Schedules tab ── */}
          <TabsContent value="schedules">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-base">Scheduled Scripts</CardTitle>
                <Button size="sm" onClick={() => setScheduleDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Schedule
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {schedules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Calendar className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-semibold">
                      Aucune planification
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                      Planifiez l'execution automatique de vos scripts.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Script</TableHead>
                        <TableHead>Cron</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Last Run</TableHead>
                        <TableHead>Next Run</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-16">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedules.map((sched) => {
                        const script = scripts.find(
                          (s) => s.id === sched.script_id,
                        );
                        return (
                          <TableRow key={sched.id}>
                            <TableCell className="font-medium">
                              {script?.name ?? "—"}
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {sched.cron_expression}
                              </code>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {sched.hardware_id ?? sched.group_id ?? "All"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {sched.last_run
                                ? formatDistanceToNow(
                                    new Date(sched.last_run),
                                    { addSuffix: true },
                                  )
                                : "Never"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {sched.next_run
                                ? new Date(sched.next_run).toLocaleString()
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  sched.enabled
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-600"
                                }
                              >
                                {sched.enabled ? "Active" : "Paused"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500"
                                onClick={() => deleteSchedule.mutate(sched.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ── Script create/edit dialog ── */}
        <Dialog open={scriptDialog} onOpenChange={setScriptDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editScript ? "Edit Script" : "New Script"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Name *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Clear temp files"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c} className="capitalize">
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this script do?"
                />
              </div>
              <div className="space-y-1">
                <Label>Script Type</Label>
                <Select value={scriptType} onValueChange={setScriptType}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCRIPT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Content *</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                  placeholder={
                    scriptType === "bash"
                      ? "#!/bin/bash\n# Your script here"
                      : "# Your script here"
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setScriptDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={submitScript}
                disabled={
                  !name.trim() ||
                  !content.trim() ||
                  createScript.isPending ||
                  updateScript.isPending
                }
              >
                {editScript ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Run dialog ── */}
        {runDialog && (
          <RunDialog script={runDialog} onClose={() => setRunDialog(null)} />
        )}

        {/* ── Schedule dialog ── */}
        {scheduleDialog && (
          <ScheduleDialog
            scripts={scripts}
            onClose={() => setScheduleDialog(false)}
          />
        )}
      </div>
    </AppLayout>
  );
}
