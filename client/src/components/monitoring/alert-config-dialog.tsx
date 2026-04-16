"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Mail,
  Webhook,
  Bell,
  Plus,
  Trash2,
} from "lucide-react";
import {
  AlertConfig,
  AlertAction,
  CreateAlertConfigRequest,
  alertsApi,
  type MetricType as ApiMetricType,
} from "@/lib/api";

interface AlertConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: AlertConfig | null;
  onSuccess?: () => void;
}

type MetricType = "cpu" | "memory" | "disk" | "network";
type ActionType = "email" | "webhook" | "browser";

const metricOptions: {
  value: MetricType;
  label: string;
  icon: React.ReactNode;
  defaultThreshold: number;
}[] = [
  {
    value: "cpu",
    label: "CPU Usage",
    icon: <Cpu className="h-4 w-4" />,
    defaultThreshold: 80,
  },
  {
    value: "memory",
    label: "Memory Usage",
    icon: <MemoryStick className="h-4 w-4" />,
    defaultThreshold: 90,
  },
  {
    value: "disk",
    label: "Disk Usage",
    icon: <HardDrive className="h-4 w-4" />,
    defaultThreshold: 85,
  },
  {
    value: "network",
    label: "Network Traffic",
    icon: <Network className="h-4 w-4" />,
    defaultThreshold: 1000,
  },
];

const actionTypeOptions: {
  value: ActionType;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "email", label: "Email", icon: <Mail className="h-4 w-4" /> },
  { value: "webhook", label: "Webhook", icon: <Webhook className="h-4 w-4" /> },
  {
    value: "browser",
    label: "Browser Notification",
    icon: <Bell className="h-4 w-4" />,
  },
];

interface FormData {
  name: string;
  metric: MetricType;
  condition: "above" | "below";
  threshold: number;
  duration_seconds: number;
}

export function AlertConfigDialog({
  open,
  onOpenChange,
  config,
  onSuccess,
}: AlertConfigDialogProps) {
  const [actions, setActions] = useState<AlertAction[]>(
    config?.actions || [{ type: "browser", config: {} }],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      name: config?.name || "",
      metric: (config?.metric as MetricType) || "cpu",
      condition: (config?.condition as "above" | "below") || "above",
      threshold: config?.threshold || 80,
      duration_seconds: config?.duration_seconds || 60,
    },
  });

  const selectedMetric = watch("metric");

  const addAction = () => {
    setActions([...actions, { type: "browser", config: {} }]);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateActionType = (index: number, type: ActionType) => {
    const newActions = [...actions];
    newActions[index] = { type, config: {} };
    setActions(newActions);
  };

  const updateActionConfig = (index: number, key: string, value: string) => {
    const newActions = [...actions];
    newActions[index] = {
      ...newActions[index],
      config: { ...newActions[index].config, [key]: value },
    };
    setActions(newActions);
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError(null);

    try {
      const payload: CreateAlertConfigRequest = {
        name: data.name,
        metric: data.metric,
        metric_type: (data.metric === "network"
          ? "network_in"
          : `${data.metric}_usage`) as ApiMetricType,
        condition: data.condition,
        operator: data.condition === "above" ? "greater_than" : "less_than",
        threshold: data.threshold,
        severity: "warning",
        duration_seconds: data.duration_seconds,
        actions,
      };

      if (config) {
        await alertsApi.updateConfig(config.id, payload);
      } else {
        await alertsApi.createConfig(payload);
      }

      onSuccess?.();
      onOpenChange(false);
    } catch {
      setError("Impossible d'enregistrer alert configuration");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {config ? "Edit Alert Configuration" : "Create Alert Configuration"}
          </DialogTitle>
          <DialogDescription>
            Define thresholds and notification actions for system metrics.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Alert Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Alert Name</Label>
            <Input
              id="name"
              placeholder="e.g., High CPU Alert"
              {...register("name", { required: "Name is required" })}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Metric Selection */}
          <div className="space-y-2">
            <Label>Metric</Label>
            <Select
              value={selectedMetric}
              onValueChange={(v) => setValue("metric", v as MetricType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select metric" />
              </SelectTrigger>
              <SelectContent>
                {metricOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      {opt.icon}
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Condition and Threshold */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select
                value={watch("condition")}
                onValueChange={(v) =>
                  setValue("condition", v as "above" | "below")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">Above</SelectItem>
                  <SelectItem value="below">Below</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold">
                Threshold {selectedMetric !== "network" ? "(%)" : "(MB/s)"}
              </Label>
              <Input
                id="threshold"
                type="number"
                min={0}
                max={selectedMetric !== "network" ? 100 : undefined}
                {...register("threshold", {
                  required: "Threshold is required",
                  valueAsNumber: true,
                  min: { value: 0, message: "Must be positive" },
                })}
              />
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (seconds)</Label>
            <p className="text-xs text-muted-foreground">
              Alert triggers only if condition persists for this duration
            </p>
            <Input
              id="duration"
              type="number"
              min={10}
              {...register("duration_seconds", {
                valueAsNumber: true,
                min: { value: 10, message: "Minimum 10 seconds" },
              })}
            />
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Notification Actions</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAction}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add
              </Button>
            </div>

            {actions.map((action, index) => (
              <Card key={index} className="p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Select
                      value={action.type}
                      onValueChange={(v) =>
                        updateActionType(index, v as ActionType)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {actionTypeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              {opt.icon}
                              {opt.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {action.type === "email" && (
                      <Input
                        placeholder="Email address"
                        value={
                          typeof action.config.email === "string"
                            ? action.config.email
                            : ""
                        }
                        onChange={(e) =>
                          updateActionConfig(index, "email", e.target.value)
                        }
                      />
                    )}

                    {action.type === "webhook" && (
                      <Input
                        placeholder="https://your-webhook-url.com"
                        value={
                          typeof action.config.webhook_url === "string"
                            ? action.config.webhook_url
                            : ""
                        }
                        onChange={(e) =>
                          updateActionConfig(
                            index,
                            "webhook_url",
                            e.target.value,
                          )
                        }
                      />
                    )}

                    {action.type === "browser" && (
                      <p className="text-xs text-muted-foreground">
                        Browser notifications will be shown when alert triggers
                      </p>
                    )}
                  </div>

                  {actions.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => removeAction(index)}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Enregistrement..."
                : config
                  ? "Mettre à jour"
                  : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
