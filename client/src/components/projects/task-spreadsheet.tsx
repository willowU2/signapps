"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Priority = "low" | "medium" | "high" | "urgent";
type Status = "todo" | "in-progress" | "review" | "done";

interface SpreadsheetTask {
  id: string;
  title: string;
  assignee: string;
  priority: Priority;
  status: Status;
  dueDate: string;
  progress: number;
  estimatedHours: number;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

const STATUS_COLORS: Record<Status, string> = {
  todo: "bg-muted text-muted-foreground",
  "in-progress": "bg-blue-100 text-blue-700",
  review: "bg-yellow-100 text-yellow-700",
  done: "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<Status, string> = {
  todo: "À faire",
  "in-progress": "En cours",
  review: "En review",
  done: "Terminé",
};

const INITIAL: SpreadsheetTask[] = [
  {
    id: "1",
    title: "Configurer l'authentification",
    assignee: "AL",
    priority: "high",
    status: "todo",
    dueDate: "2026-04-01",
    progress: 0,
    estimatedHours: 8,
  },
  {
    id: "2",
    title: "API REST utilisateurs",
    assignee: "JD",
    priority: "urgent",
    status: "in-progress",
    dueDate: "2026-03-28",
    progress: 60,
    estimatedHours: 16,
  },
  {
    id: "3",
    title: "Composants UI dashboard",
    assignee: "AL",
    priority: "medium",
    status: "in-progress",
    dueDate: "2026-04-05",
    progress: 40,
    estimatedHours: 12,
  },
  {
    id: "4",
    title: "Tests d'intégration",
    assignee: "MR",
    priority: "high",
    status: "review",
    dueDate: "2026-04-10",
    progress: 90,
    estimatedHours: 6,
  },
  {
    id: "5",
    title: "Documentation OpenAPI",
    assignee: "JD",
    priority: "low",
    status: "done",
    dueDate: "2026-03-20",
    progress: 100,
    estimatedHours: 4,
  },
];

// ── Editable Cell ─────────────────────────────────────────────────────────────

function EditableCell({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  if (editing) {
    return (
      <Input
        autoFocus
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          onChange(local);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") {
            onChange(local);
            setEditing(false);
          }
        }}
        className={cn("h-7 text-xs px-1 py-0", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "block w-full cursor-text hover:bg-muted/50 rounded px-1 py-0.5 text-sm truncate",
        className,
      )}
      onClick={() => {
        setLocal(value);
        setEditing(true);
      }}
    >
      {value || <span className="text-muted-foreground italic">—</span>}
    </span>
  );
}

function SelectCell<T extends string>({
  value,
  options,
  labels,
  colorMap,
  onChange,
}: {
  value: T;
  options: T[];
  labels?: Record<T, string>;
  colorMap?: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(
        "w-full h-7 text-xs rounded px-1 border-0 bg-transparent cursor-pointer",
        colorMap?.[value],
      )}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {labels?.[o] ?? o}
        </option>
      ))}
    </select>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function TaskSpreadsheet() {
  const [tasks, setTasks] = useState<SpreadsheetTask[]>(INITIAL);

  const update = useCallback(
    <K extends keyof SpreadsheetTask>(
      id: string,
      key: K,
      value: SpreadsheetTask[K],
    ) => {
      setTasks((p) => p.map((t) => (t.id === id ? { ...t, [key]: value } : t)));
    },
    [],
  );

  const addRow = () => {
    const task: SpreadsheetTask = {
      id: crypto.randomUUID(),
      title: "Nouvelle tâche",
      assignee: "",
      priority: "medium",
      status: "todo",
      dueDate: "",
      progress: 0,
      estimatedHours: 0,
    };
    setTasks((p) => [...p, task]);
  };

  const removeRow = (id: string) =>
    setTasks((p) => p.filter((t) => t.id !== id));

  const totals = {
    estimated: tasks.reduce((s, t) => s + t.estimatedHours, 0),
    done: tasks.filter((t) => t.status === "done").length,
  };

  return (
    <div className="w-full border rounded-lg overflow-hidden bg-background">
      <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Tableau des tâches</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {tasks.length} tâches • {totals.done} terminées • {totals.estimated}
            h estimées
          </p>
        </div>
        <Button size="sm" onClick={addRow} className="gap-1">
          <Plus className="size-4" /> Ajouter
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground sticky top-0 z-10">
            <tr>
              <th className="w-8 px-2 py-2" />
              <th className="text-left px-3 py-2 font-medium min-w-[180px]">
                Titre
              </th>
              <th className="text-left px-3 py-2 font-medium w-20">Assigné</th>
              <th className="text-left px-3 py-2 font-medium w-24">Priorité</th>
              <th className="text-left px-3 py-2 font-medium w-28">Statut</th>
              <th className="text-left px-3 py-2 font-medium w-28">Échéance</th>
              <th className="text-left px-3 py-2 font-medium w-24">Progrès</th>
              <th className="text-left px-3 py-2 font-medium w-16">Heures</th>
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {tasks.map((t) => (
              <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-2 py-1.5 text-muted-foreground">
                  <GripVertical className="size-4 cursor-grab" />
                </td>
                <td className="px-3 py-1.5">
                  <EditableCell
                    value={t.title}
                    onChange={(v) => update(t.id, "title", v)}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <EditableCell
                    value={t.assignee}
                    onChange={(v) => update(t.id, "assignee", v)}
                    className="w-16"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <Badge
                    className={cn(
                      "text-xs px-1.5",
                      PRIORITY_COLORS[t.priority],
                    )}
                  >
                    <SelectCell
                      value={t.priority}
                      options={
                        ["low", "medium", "high", "urgent"] as Priority[]
                      }
                      labels={{
                        low: "Faible",
                        medium: "Moyen",
                        high: "Élevé",
                        urgent: "Urgent",
                      }}
                      onChange={(v) => update(t.id, "priority", v)}
                    />
                  </Badge>
                </td>
                <td className="px-3 py-1.5">
                  <Badge
                    className={cn("text-xs px-1.5", STATUS_COLORS[t.status])}
                  >
                    <SelectCell
                      value={t.status}
                      options={
                        ["todo", "in-progress", "review", "done"] as Status[]
                      }
                      labels={STATUS_LABELS}
                      onChange={(v) => update(t.id, "status", v)}
                    />
                  </Badge>
                </td>
                <td className="px-3 py-1.5">
                  <Input
                    type="date"
                    value={t.dueDate}
                    onChange={(e) => update(t.id, "dueDate", e.target.value)}
                    className="h-7 text-xs px-1 w-full"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${t.progress}%` }}
                      />
                    </div>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={t.progress}
                      onChange={(e) =>
                        update(
                          t.id,
                          "progress",
                          Math.min(
                            100,
                            Math.max(0, parseInt(e.target.value, 10) || 0),
                          ),
                        )
                      }
                      className="h-7 w-12 text-xs text-center px-0"
                    />
                  </div>
                </td>
                <td className="px-3 py-1.5">
                  <Input
                    type="number"
                    min="0"
                    value={t.estimatedHours}
                    onChange={(e) =>
                      update(
                        t.id,
                        "estimatedHours",
                        parseInt(e.target.value, 10) || 0,
                      )
                    }
                    className="h-7 text-xs text-center px-1 w-full"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeRow(t.id)}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tasks.length === 0 && (
        <div className="p-8 text-center text-muted-foreground text-sm">
          Aucune tâche. Cliquez sur Ajouter pour commencer.
        </div>
      )}
    </div>
  );
}
