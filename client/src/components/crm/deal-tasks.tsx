"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CheckSquare } from "lucide-react";
import { crmTasksApi, type CrmTask } from "@/lib/api/crm";

interface Props {
  dealId: string;
}

export function DealTasks({ dealId }: Props) {
  const [tasks, setTasks] = useState<CrmTask[]>(() =>
    crmTasksApi.byDeal(dealId),
  );
  const [newTitle, setNewTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  const reload = () => setTasks(crmTasksApi.byDeal(dealId));

  const add = () => {
    if (!newTitle.trim()) return;
    crmTasksApi.create({
      dealId,
      title: newTitle.trim(),
      dueDate: dueDate || undefined,
      done: false,
    });
    setNewTitle("");
    setDueDate("");
    reload();
  };

  const toggle = (id: string) => {
    crmTasksApi.toggle(id);
    reload();
  };

  const remove = (id: string) => {
    crmTasksApi.delete(id);
    reload();
  };

  const pending = tasks.filter((t) => !t.done).length;
  const done = tasks.filter((t) => t.done).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <CheckSquare className="h-4 w-4" />
          Tâches
          {pending > 0 && (
            <Badge variant="secondary" className="text-xs">
              {pending} en attente
            </Badge>
          )}
          {done > 0 && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {done} terminée{done > 1 ? "s" : ""}
            </Badge>
          )}
        </h3>
      </div>

      <div className="flex gap-2">
        <Input
          className="h-8 text-sm flex-1"
          placeholder="Nouvelle tâche…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Input
          type="date"
          className="h-8 text-sm w-36"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <Button
          size="sm"
          className="h-8 px-3"
          onClick={add}
          disabled={!newTitle.trim()}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-2">
        {tasks.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 p-2.5 rounded-md border transition-colors ${
              t.done ? "opacity-60 bg-muted/30" : "bg-card hover:bg-muted/20"
            }`}
          >
            <Checkbox
              checked={t.done}
              onCheckedChange={() => toggle(t.id)}
              className="shrink-0"
            />
            <span
              className={`text-sm flex-1 ${t.done ? "line-through text-muted-foreground" : ""}`}
            >
              {t.title}
            </span>
            {t.dueDate && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {new Date(t.dueDate).toLocaleDateString("fr-FR")}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
              onClick={() => remove(t.id)}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune tâche.
          </p>
        )}
      </div>
    </div>
  );
}
