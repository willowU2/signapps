"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Switch } from "@/components/ui/switch";
import { useEntityStore } from "@/stores/entity-hub-store";
import { toast } from "sonner";
import { TaskAssigneeSelector } from "./task-assignee-selector";
import { useCalendarAvailability } from "@/components/interop/CalendarContactSuggestions";

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  parentTaskId?: string;
  onTaskCreated?: () => void;
}

const PRIORITY_OPTIONS = [
  { label: "Low", value: "0" },
  { label: "Medium", value: "1" },
  { label: "High", value: "2" },
  { label: "Urgent", value: "3" },
];

export function TaskForm({
  open,
  onOpenChange,
  projectId,
  parentTaskId,
  onTaskCreated,
}: TaskFormProps) {
  const router = useRouter();
  const { createTask } = useEntityStore();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "1",
    due_date: "",
    assignee_id: null as string | null,
    reminder_enabled: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Feature 24: Calendar availability for assignee
  const [assigneeEmail, setAssigneeEmail] = useState<string | null>(null);
  const availabilitySlots = useCalendarAvailability(assigneeEmail);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const createData = {
        project_id: projectId,
        parent_id: parentTaskId,
        title: formData.title || "Untitled Task",
        description: formData.description || undefined,
        priority: parseInt(formData.priority),
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : undefined,
        assignee_id: formData.assignee_id || undefined,
        reminder_enabled: formData.reminder_enabled,
      };

      await createTask(createData);
      toast.success("Tâche créée avec succès", {
        action: {
          label: 'Voir',
          onClick: () => router.push('/tasks'),
        },
      });
      onOpenChange(false);
      setFormData({ title: "", description: "", priority: "1", due_date: "", assignee_id: null, reminder_enabled: false });
      onTaskCreated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Créer une tâche</DialogTitle>
          <DialogDescription>
            {parentTaskId
              ? "Créer une sous-tâche"
              : "Ajouter une nouvelle tâche à votre liste"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              name="title"
              placeholder="Titre de la tâche"
              value={formData.title}
              onChange={handleInputChange}
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Ajouter des détails..."
              rows={3}
              value={formData.description}
              onChange={handleInputChange}
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priorité</Label>
            <Select value={formData.priority} onValueChange={(val) => {
              setFormData((prev) => ({ ...prev, priority: val }));
            }}>
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due date */}
          <div className="space-y-2">
            <Label htmlFor="due_date">Échéance</Label>
            <Input
              id="due_date"
              name="due_date"
              type="date"
              value={formData.due_date}
              onChange={handleInputChange}
            />
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <Label>Assigné à</Label>
            <TaskAssigneeSelector
              assigneeId={formData.assignee_id}
              onAssigneeChange={(userId) => {
                setFormData((prev) => ({ ...prev, assignee_id: userId }));
                // Feature 24: check assignee calendar availability
                if (userId) setAssigneeEmail(userId);
              }}
            />
            {/* Feature 24: Show next free slot */}
            {availabilitySlots.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Prochain créneau libre : {new Date(availabilitySlots[0].start).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>

          {/* Due date reminder */}
          {formData.due_date && (
            <div className="flex items-center justify-between">
              <Label htmlFor="reminder" className="text-sm">
                Rappel avant l&apos;échéance
              </Label>
              <Switch
                id="reminder"
                checked={formData.reminder_enabled}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, reminder_enabled: checked }))
                }
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Création..." : "Créer la tâche"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
