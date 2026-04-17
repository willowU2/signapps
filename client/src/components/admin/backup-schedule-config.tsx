"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Database, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface CronField {
  value: string;
  mode: "every" | "specific" | "custom";
}

const PRESETS = [
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Daily at midnight", cron: "0 0 * * *" },
  { label: "Daily at 2 AM", cron: "0 2 * * *" },
  { label: "Weekly (Sunday 2 AM)", cron: "0 2 * * 0" },
  { label: "Monthly (1st at 2 AM)", cron: "0 2 1 * *" },
];

function parseCron(cron: string): {
  min: string;
  hour: string;
  dom: string;
  month: string;
  dow: string;
} {
  const [min = "*", hour = "*", dom = "*", month = "*", dow = "*"] =
    cron.split(" ");
  return { min, hour, dom, month, dow };
}

function describeCron(cron: string): string {
  const p = parseCron(cron);
  if (cron === "0 * * * *") return "Every hour at minute 0";
  if (cron === "0 0 * * *") return "Daily at midnight";
  if (p.dom === "*" && p.month === "*" && p.dow === "*") {
    return `Daily at ${p.hour.padStart(2, "0")}:${p.min.padStart(2, "0")}`;
  }
  if (p.dom === "*" && p.month === "*" && p.dow !== "*") {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return `Every ${days[parseInt(p.dow)] ?? p.dow} at ${p.hour.padStart(2, "0")}:${p.min.padStart(2, "0")}`;
  }
  if (p.month === "*" && p.dow === "*") {
    return `Monthly on day ${p.dom} at ${p.hour.padStart(2, "0")}:${p.min.padStart(2, "0")}`;
  }
  return `Custom schedule: ${cron}`;
}

const STORAGE_KEY = "backup_schedule_config";

interface BackupConfig {
  enabled: boolean;
  cron: string;
  retentionDays: number;
  destination: string;
}

const DEFAULT_CONFIG: BackupConfig = {
  enabled: true,
  cron: "0 2 * * *",
  retentionDays: 30,
  destination: "local",
};

export function BackupScheduleConfig() {
  const [config, setConfig] = useState<BackupConfig>(() => {
    if (typeof window === "undefined") return DEFAULT_CONFIG;
    try {
      return JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "",
      ) as BackupConfig;
    } catch {
      return DEFAULT_CONFIG;
    }
  });
  const [customCron, setCustomCron] = useState(config.cron);
  const [presetIdx, setPresetIdx] = useState<number>(-1);

  const description = useMemo(() => {
    try {
      return describeCron(customCron);
    } catch {
      return "Invalid expression";
    }
  }, [customCron]);

  const handlePreset = (idx: number) => {
    setPresetIdx(idx);
    setCustomCron(PRESETS[idx].cron);
  };

  const handleSave = () => {
    const newConfig = { ...config, cron: customCron };
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    toast.success("Backup schedule saved");
  };

  const cronParts = parseCron(customCron);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-5 w-5" />
          Backup Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Presets */}
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
            Quick presets
          </Label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={p.cron}
                onClick={() => handlePreset(i)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  presetIdx === i
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-transparent hover:border-border"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cron visual builder */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide block">
            Expression builder
          </Label>
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            {(["min", "hour", "dom", "month", "dow"] as const).map(
              (field, fi) => {
                const labels = ["Minute", "Hour", "Day", "Month", "Weekday"];
                const val = Object.values(cronParts)[fi];
                return (
                  <div key={field} className="space-y-1">
                    <label
                      htmlFor={`cron-${field}`}
                      className="text-muted-foreground"
                    >
                      {labels[fi]}
                    </label>
                    <Input
                      id={`cron-${field}`}
                      value={val}
                      onChange={(e) => {
                        const parts = [
                          cronParts.min,
                          cronParts.hour,
                          cronParts.dom,
                          cronParts.month,
                          cronParts.dow,
                        ];
                        parts[fi] = e.target.value || "*";
                        setCustomCron(parts.join(" "));
                        setPresetIdx(-1);
                      }}
                      className="h-8 text-center text-xs font-mono"
                    />
                  </div>
                );
              },
            )}
          </div>
          <div className="flex items-center gap-2 p-2 bg-muted/30 rounded text-xs">
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono text-muted-foreground">
              {customCron}
            </span>
            <span className="text-foreground ml-auto">{description}</span>
          </div>
        </div>

        {/* Retention */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="backup-retention">Retention (days)</Label>
            <Input
              id="backup-retention"
              type="number"
              min={1}
              value={config.retentionDays}
              onChange={(e) =>
                setConfig({
                  ...config,
                  retentionDays: parseInt(e.target.value) || 30,
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="backup-destination">Destination</Label>
            <Select
              value={config.destination}
              onValueChange={(v) => setConfig({ ...config, destination: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local storage</SelectItem>
                <SelectItem value="s3">S3 bucket</SelectItem>
                <SelectItem value="restic">Restic repository</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <Badge variant={config.enabled ? "default" : "secondary"}>
              {config.enabled ? "Enabled" : "Disabled"}
            </Badge>
            <button
              className="text-xs text-muted-foreground underline"
              onClick={() => setConfig({ ...config, enabled: !config.enabled })}
            >
              {config.enabled ? "Disable" : "Enable"}
            </button>
          </div>
          <Button size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Schedule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
