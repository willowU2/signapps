"use client";

import React, { useState } from "react";
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
import { useTasks, CreateTaskRequest } from "@/hooks/use-tasks";
import { useToast } from "@/hooks/use-toast";

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
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
  calendarId,
  parentTaskId,
  onTaskCreated,
}: TaskFormProps) {
  const { createTask } = useTasks(calendarId);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "1",
    due_date: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const createData: CreateTaskRequest = {
        parent_task_id: parentTaskId,
        title: formData.title || "Untitled Task",
        description: formData.description || undefined,
        priority: parseInt(formData.priority),
        due_date: formData.due_date || undefined,
      };

      await createTask(createData);
      toast({ title: "Task created successfully" });
      onOpenChange(false);
      setFormData({ title: "", description: "", priority: "1", due_date: "" });
      onTaskCreated?.();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            {parentTaskId
              ? "Create a subtask"
              : "Create a new task in your task list"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              name="title"
              placeholder="Task title"
              value={formData.title}
              onChange={handleInputChange}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Add details..."
              rows={3}
              value={formData.description}
              onChange={handleInputChange}
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
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
            <Label htmlFor="due_date">Due Date</Label>
            <Input
              id="due_date"
              name="due_date"
              type="date"
              value={formData.due_date}
              onChange={handleInputChange}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
