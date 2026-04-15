"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings2, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export interface HealthThresholds {
  cpu_warn: number;
  cpu_crit: number;
  mem_warn: number;
  mem_crit: number;
  disk_warn: number;
  disk_crit: number;
  response_warn_ms: number;
  response_crit_ms: number;
}

const DEFAULT_THRESHOLDS: HealthThresholds = {
  cpu_warn: 70,
  cpu_crit: 90,
  mem_warn: 75,
  mem_crit: 90,
  disk_warn: 80,
  disk_crit: 95,
  response_warn_ms: 500,
  response_crit_ms: 2000,
};

const STORAGE_KEY = "health_thresholds";

function loadThresholds(): HealthThresholds {
  if (typeof window === "undefined") return DEFAULT_THRESHOLDS;
  try {
    return {
      ...DEFAULT_THRESHOLDS,
      ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"),
    };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

interface ThresholdRowProps {
  label: string;
  warnKey: keyof HealthThresholds;
  critKey: keyof HealthThresholds;
  unit: string;
  values: HealthThresholds;
  onChange: (k: keyof HealthThresholds, v: number) => void;
}

function ThresholdRow({
  label,
  warnKey,
  critKey,
  unit,
  values,
  onChange,
}: ThresholdRowProps) {
  return (
    <div className="grid grid-cols-3 gap-3 items-center">
      <span className="text-sm font-medium">{label}</span>
      <div className="space-y-1">
        <Label className="text-xs text-amber-600">Warn ({unit})</Label>
        <Input
          type="number"
          min={0}
          value={values[warnKey]}
          onChange={(e) => onChange(warnKey, Number(e.target.value))}
          className="h-7 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-red-600">Critical ({unit})</Label>
        <Input
          type="number"
          min={0}
          value={values[critKey]}
          onChange={(e) => onChange(critKey, Number(e.target.value))}
          className="h-7 text-sm"
        />
      </div>
    </div>
  );
}

interface HealthThresholdsPanelProps {
  onThresholdsChange?: (t: HealthThresholds) => void;
}

export function HealthThresholdsPanel({
  onThresholdsChange,
}: HealthThresholdsPanelProps) {
  const [thresholds, setThresholds] =
    useState<HealthThresholds>(loadThresholds);
  const [open, setOpen] = useState(false);

  const handleChange = (k: keyof HealthThresholds, v: number) => {
    setThresholds((prev) => ({ ...prev, [k]: v }));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(thresholds));
    onThresholdsChange?.(thresholds);
    toast.success("Seuils de santé enregistrés");
    setOpen(false);
  };

  const handleReset = () => {
    setThresholds(DEFAULT_THRESHOLDS);
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <Settings2 className="h-4 w-4" />
        Thresholds
      </Button>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Alert Thresholds
          <Badge variant="outline" className="ml-auto text-xs">
            Stored locally
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ThresholdRow
          label="CPU"
          warnKey="cpu_warn"
          critKey="cpu_crit"
          unit="%"
          values={thresholds}
          onChange={handleChange}
        />
        <ThresholdRow
          label="Memory"
          warnKey="mem_warn"
          critKey="mem_crit"
          unit="%"
          values={thresholds}
          onChange={handleChange}
        />
        <ThresholdRow
          label="Disk"
          warnKey="disk_warn"
          critKey="disk_crit"
          unit="%"
          values={thresholds}
          onChange={handleChange}
        />
        <ThresholdRow
          label="Response time"
          warnKey="response_warn_ms"
          critKey="response_crit_ms"
          unit="ms"
          values={thresholds}
          onChange={handleChange}
        />

        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs"
          >
            Reset to defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
