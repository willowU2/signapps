"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Database, Save, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

interface IncrementalConfig {
  enabled: boolean;
  fullBackupEveryNth: number;
  retainIncrementals: number;
  deduplication: boolean;
  compressionEnabled: boolean;
}

export function IncrementalBackupSettings() {
  const [config, setConfig] = useState<IncrementalConfig>({
    enabled: false,
    fullBackupEveryNth: 7,
    retainIncrementals: 30,
    deduplication: true,
    compressionEnabled: true,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    toast.success("Paramètres de sauvegarde incrémentielle enregistrés");
  };

  const estimatedSavings = config.enabled
    ? Math.round(
        ((config.fullBackupEveryNth - 1) / config.fullBackupEveryNth) *
          100 *
          (config.deduplication ? 1.2 : 1),
      )
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-5 w-5 text-primary" />
          Incremental Backup Support
          {config.enabled && (
            <Badge className="ml-auto text-xs bg-green-500">Active</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label className="font-medium">Enable incremental backups</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Only backup changes since the last full backup
            </p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))}
          />
        </div>

        {config.enabled && (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm">
                  Full backup every N days: {config.fullBackupEveryNth}
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Run a complete backup every N days; incremental backups in
                      between
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Slider
                min={1}
                max={30}
                step={1}
                value={[config.fullBackupEveryNth]}
                onValueChange={([v]) =>
                  setConfig((c) => ({ ...c, fullBackupEveryNth: v }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Retain incrementals: {config.retainIncrementals} days
              </Label>
              <Slider
                min={7}
                max={90}
                step={7}
                value={[config.retainIncrementals]}
                onValueChange={([v]) =>
                  setConfig((c) => ({ ...c, retainIncrementals: v }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Deduplication</Label>
                <p className="text-xs text-muted-foreground">
                  Remove duplicate data blocks
                </p>
              </div>
              <Switch
                checked={config.deduplication}
                onCheckedChange={(v) =>
                  setConfig((c) => ({ ...c, deduplication: v }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Compression</Label>
                <p className="text-xs text-muted-foreground">
                  Compress data blocks before writing
                </p>
              </div>
              <Switch
                checked={config.compressionEnabled}
                onCheckedChange={(v) =>
                  setConfig((c) => ({ ...c, compressionEnabled: v }))
                }
              />
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Estimated storage savings: ~{estimatedSavings}%
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                Based on your configuration (1 full every{" "}
                {config.fullBackupEveryNth} days)
              </p>
            </div>
          </>
        )}

        <Button onClick={save} disabled={saving} className="gap-1.5">
          <Save className="h-4 w-4" />
          {saving ? "Enregistrement..." : "Enregistrer les paramètres"}
        </Button>
      </CardContent>
    </Card>
  );
}
