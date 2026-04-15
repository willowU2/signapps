"use client";

import { useState } from "react";
import { Bell, BellOff, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { schedulerApi } from "@/lib/api/scheduler";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

export interface TaskReminderConfig {
  enabled: boolean;
  /** Minutes before due date to remind */
  minutesBefore: number;
}

export interface TaskReminderToggleProps {
  taskId: string;
  taskTitle: string;
  dueDate?: string;
  initialConfig?: TaskReminderConfig;
  onConfigChange?: (config: TaskReminderConfig) => void;
  className?: string;
}

// ============================================================================
// Reminder options
// ============================================================================

const REMINDER_OPTIONS = [
  { value: "5", label: "5 minutes avant" },
  { value: "15", label: "15 minutes avant" },
  { value: "30", label: "30 minutes avant" },
  { value: "60", label: "1 heure avant" },
  { value: "120", label: "2 heures avant" },
  { value: "1440", label: "1 jour avant" },
];

// ============================================================================
// Component
// ============================================================================

export function TaskReminderToggle({
  taskId,
  taskTitle,
  dueDate,
  initialConfig = { enabled: false, minutesBefore: 30 },
  onConfigChange,
  className,
}: TaskReminderToggleProps) {
  const [config, setConfig] = useState<TaskReminderConfig>(initialConfig);
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = async (enabled: boolean) => {
    if (!dueDate) {
      toast.error("Definissez une date limite pour activer les rappels");
      return;
    }

    const newConfig = { ...config, enabled };
    setConfig(newConfig);
    onConfigChange?.(newConfig);

    // Create or delete scheduler job for the reminder
    setIsSaving(true);
    try {
      if (enabled) {
        const reminderDate = new Date(dueDate);
        reminderDate.setMinutes(
          reminderDate.getMinutes() - config.minutesBefore,
        );

        // Only schedule if reminder time is in the future
        if (reminderDate > new Date()) {
          await schedulerApi.createJob({
            name: `task-reminder-${taskId}`,
            description: `Rappel: ${taskTitle}`,
            cron_expression: `at ${reminderDate.toISOString()}`,
            command: `notify:task_reminder:${taskId}`,
            target_type: "host",
            enabled: true,
          });
          toast.success("Rappel active");
        } else {
          toast.warning("La date du rappel est deja passee");
          setConfig({ ...newConfig, enabled: false });
          onConfigChange?.({ ...newConfig, enabled: false });
        }
      } else {
        // Find and delete the reminder job
        const jobs = await schedulerApi.listJobs();
        const reminderJob = (jobs.data || []).find(
          (j: { name: string }) => j.name === `task-reminder-${taskId}`,
        );
        if (reminderJob) {
          await schedulerApi.deleteJob(reminderJob.id);
        }
        toast.success("Rappel desactive");
      }
    } catch {
      toast.error("Erreur lors de la configuration du rappel");
      // Revert
      setConfig(initialConfig);
      onConfigChange?.(initialConfig);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMinutesChange = (value: string) => {
    const newConfig = { ...config, minutesBefore: parseInt(value) };
    setConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("gap-1.5", config.enabled && "text-primary", className)}
          disabled={isSaving}
        >
          {config.enabled ? (
            <Bell className="h-4 w-4" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}
          <span className="text-xs">
            {config.enabled ? "Rappel actif" : "Rappel"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="reminder-toggle"
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Rappel
            </Label>
            <Switch
              id="reminder-toggle"
              checked={config.enabled}
              onCheckedChange={handleToggle}
              disabled={isSaving || !dueDate}
            />
          </div>

          {!dueDate && (
            <p className="text-xs text-muted-foreground">
              Ajoutez une date limite pour activer les rappels.
            </p>
          )}

          {dueDate && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Me rappeler
              </Label>
              <Select
                value={config.minutesBefore.toString()}
                onValueChange={handleMinutesChange}
                disabled={!config.enabled}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default TaskReminderToggle;
