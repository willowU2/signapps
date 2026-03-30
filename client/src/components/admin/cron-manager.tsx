"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Save, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toggle } from "@/components/ui/toggle";
import { toast } from "sonner";

interface CronJob {
  id: string;
  name: string;
  cronExpression: string;
  command: string;
  nextRun: Date | null;
  lastRun: Date | null;
  isActive: boolean;
  logCount: number;
}

interface EditFormState {
  name: string;
  cronExpression: string;
  command: string;
}

const INITIAL_FORM_STATE: EditFormState = {
  name: "",
  cronExpression: "",
  command: "",
};

export function CronManager() {
  const [jobs, setJobs] = useState<CronJob[]>([
    {
      id: "1",
      name: "Cache Cleanup",
      cronExpression: "0 2 * * *",
      command: "cleanup_cache",
      nextRun: new Date(Date.now() + 86400000),
      lastRun: new Date(Date.now() - 3600000),
      isActive: true,
      logCount: 24,
    },
    {
      id: "2",
      name: "Database Backup",
      cronExpression: "0 3 * * 0",
      command: "backup_database",
      nextRun: new Date(Date.now() + 172800000),
      lastRun: new Date(Date.now() - 604800000),
      isActive: true,
      logCount: 12,
    },
    {
      id: "3",
      name: "Log Archive",
      cronExpression: "0 0 * * *",
      command: "archive_logs",
      nextRun: null,
      lastRun: null,
      isActive: false,
      logCount: 0,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(INITIAL_FORM_STATE);

  const handleCreateNew = () => {
    setEditingId("new");
    setEditForm(INITIAL_FORM_STATE);
  };

  const handleEdit = (job: CronJob) => {
    setEditingId(job.id);
    setEditForm({
      name: job.name,
      cronExpression: job.cronExpression,
      command: job.command,
    });
  };

  const handleSave = async () => {
    try {
      if (!editForm.name || !editForm.cronExpression || !editForm.command) {
        toast.error("Tous les champs sont obligatoires");
        return;
      }

      const newJob: CronJob = {
        id: editingId === "new" ? Date.now().toString() : editingId!,
        name: editForm.name,
        cronExpression: editForm.cronExpression,
        command: editForm.command,
        nextRun: editingId === "new" ? new Date() : jobs.find((j) => j.id === editingId)?.nextRun || null,
        lastRun: jobs.find((j) => j.id === editingId)?.lastRun || null,
        isActive: editingId === "new" ? true : jobs.find((j) => j.id === editingId)?.isActive || true,
        logCount: jobs.find((j) => j.id === editingId)?.logCount || 0,
      };

      if (editingId === "new") {
        setJobs([...jobs, newJob]);
        toast.success("Tâche cron créée");
      } else {
        setJobs(jobs.map((j) => (j.id === editingId ? newJob : j)));
        toast.success("Tâche cron mise à jour");
      }

      setEditingId(null);
    } catch (error) {
      toast.error("Impossible d'enregistrer la tâche cron");
      console.warn(error);
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this cron job?")) return;

    try {
      setJobs(jobs.filter((j) => j.id !== id));
      toast.success("Tâche cron supprimée");
    } catch (error) {
      toast.error("Impossible de supprimer la tâche cron");
      console.warn(error);
    }
  };

  const toggleActive = (id: string) => {
    try {
      setJobs(jobs.map((j) => (j.id === id ? { ...j, isActive: !j.isActive } : j)));
    } catch (error) {
      toast.error("Impossible de modifier l'état de la tâche");
      console.warn(error);
    }
  };

  const formatDateTime = (date: Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Scheduled Cron Jobs
        </h3>
        <Button onClick={handleCreateNew} disabled={editingId !== null} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Job
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job Name</TableHead>
              <TableHead>Cron Expression</TableHead>
              <TableHead>Next Run</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Logs</TableHead>
              <TableHead className="w-[80px]">Active</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : jobs.length === 0 && editingId !== "new" ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                  No cron jobs configured.
                </TableCell>
              </TableRow>
            ) : null}

            {editingId === "new" && (
              <TableRow className="bg-muted/30">
                <TableCell>
                  <Input
                    placeholder="Job name"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                    className="h-8 text-sm"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="0 2 * * *"
                    value={editForm.cronExpression}
                    onChange={(e) =>
                      setEditForm({ ...editForm, cronExpression: e.target.value })
                    }
                    className="h-8 font-mono text-sm"
                  />
                </TableCell>
                <TableCell colSpan={3}>
                  <Input
                    placeholder="command_name"
                    value={editForm.command}
                    onChange={(e) =>
                      setEditForm({ ...editForm, command: e.target.value })
                    }
                    className="h-8 font-mono text-sm"
                  />
                </TableCell>
                <TableCell></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={handleSave}>
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {jobs.map((job) =>
              editingId === job.id ? (
                <TableRow key={job.id} className="bg-muted/30">
                  <TableCell>
                    <Input
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={editForm.cronExpression}
                      onChange={(e) =>
                        setEditForm({ ...editForm, cronExpression: e.target.value })
                      }
                      className="h-8 font-mono text-sm"
                    />
                  </TableCell>
                  <TableCell colSpan={3}>
                    <Input
                      value={editForm.command}
                      onChange={(e) =>
                        setEditForm({ ...editForm, command: e.target.value })
                      }
                      className="h-8 font-mono text-sm"
                    />
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={handleSave}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={job.id} className={!job.isActive ? "opacity-60" : ""}>
                  <TableCell className="font-medium">{job.name}</TableCell>
                  <TableCell className="font-mono text-sm">{job.cronExpression}</TableCell>
                  <TableCell className="text-sm">{formatDateTime(job.nextRun)}</TableCell>
                  <TableCell className="text-sm">{formatDateTime(job.lastRun)}</TableCell>
                  <TableCell className="text-sm">{job.logCount}</TableCell>
                  <TableCell>
                    <Toggle
                      pressed={job.isActive}
                      onPressedChange={() => toggleActive(job.id)}
                      disabled={editingId !== null}
                      className="h-8 w-8"
                    >
                      <div className={`w-2 h-2 rounded-full ${job.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                    </Toggle>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleEdit(job)}
                        disabled={editingId !== null}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(job.id)}
                        disabled={editingId !== null}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
