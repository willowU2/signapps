"use client";
// Feature 12: Contact → show tasks assigned to them

import { useState, useEffect, useCallback } from "react";
import { CheckSquare, Square, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { crmTasksApi, dealsApi, type Deal, type CrmTask } from "@/lib/api/crm";
import { toast } from "sonner";

interface Props {
  contactId: string;
  contactEmail?: string;
}

export function ContactTasksPanel({ contactId, contactEmail }: Props) {
  const [tasks, setTasks] = useState<(CrmTask & { dealTitle?: string })[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    dealsApi.list().then((all) => {
      const filtered = all.filter(
        (d) =>
          d.contactId === contactId ||
          (contactEmail &&
            d.contactEmail?.toLowerCase() === contactEmail?.toLowerCase()),
      );
      setDeals(filtered);
      const t = filtered.flatMap((deal) =>
        crmTasksApi
          .byDeal(deal.id)
          .map((t) => ({ ...t, dealTitle: deal.title })),
      );
      setTasks(t);
    });
  }, [contactId, contactEmail]);

  const refresh = useCallback(() => {
    const updated = deals.flatMap((deal) =>
      crmTasksApi.byDeal(deal.id).map((t) => ({ ...t, dealTitle: deal.title })),
    );
    setTasks(updated);
  }, [deals]);

  const handleToggle = (id: string) => {
    crmTasksApi.toggle(id);
    refresh();
  };

  const handleAdd = () => {
    if (!newTitle.trim() || deals.length === 0) return;
    crmTasksApi.create({
      dealId: deals[0].id,
      title: newTitle.trim(),
      done: false,
      assignedTo: undefined,
    });
    toast.success("Tâche créée.");
    setNewTitle("");
    setAdding(false);
    refresh();
  };

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <CheckSquare className="h-3 w-3" /> Tâches ({pending.length} en cours)
        </p>
        {deals.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setAdding((v) => !v)}
          >
            <Plus className="h-3 w-3 mr-1" /> Ajouter
          </Button>
        )}
      </div>

      {adding && (
        <div className="flex gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Nouvelle tâche…"
            className="h-7 text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            autoFocus
          />
          <Button size="sm" className="h-7 text-xs" onClick={handleAdd}>
            OK
          </Button>
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Aucune tâche liée.
        </p>
      ) : (
        <div className="space-y-1">
          {[...pending, ...done].map((task) => (
            <div
              key={task.id}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer text-sm"
              onClick={() => handleToggle(task.id)}
            >
              {task.done ? (
                <CheckSquare className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
              ) : (
                <Square className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <span
                  className={
                    task.done ? "line-through text-muted-foreground" : ""
                  }
                >
                  {task.title}
                </span>
                {task.dealTitle && (
                  <p className="text-xs text-muted-foreground truncate">
                    {task.dealTitle}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
