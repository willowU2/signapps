"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FeatureFlag, UpsertFlagRequest } from "@/lib/api/deploy";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: FeatureFlag | null;
  onSave: (key: string, req: UpsertFlagRequest) => Promise<void>;
}

type EnvValue = "prod" | "dev" | "all";

/**
 * Side-drawer form to create or edit a feature flag.
 *
 * Disables the `key` field when `initial` is set — the key + env pair is the
 * unique identifier and cannot be renamed once persisted.
 */
export function FeatureFlagEditor({
  open,
  onOpenChange,
  initial,
  onSave,
}: Props) {
  const [key, setKey] = useState(initial?.key ?? "");
  const [env, setEnv] = useState<EnvValue>(
    (initial?.env as EnvValue) ?? "prod",
  );
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [rolloutPercent, setRolloutPercent] = useState(
    initial?.rollout_percent ?? 100,
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when a different flag is opened
  useEffect(() => {
    if (open) {
      setKey(initial?.key ?? "");
      setEnv((initial?.env as EnvValue) ?? "prod");
      setEnabled(initial?.enabled ?? false);
      setRolloutPercent(initial?.rollout_percent ?? 100);
      setDescription(initial?.description ?? "");
      setError(null);
    }
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) {
      setError("La clé est obligatoire");
      return;
    }
    if (rolloutPercent < 0 || rolloutPercent > 100) {
      setError("Le rollout doit être entre 0 et 100");
      return;
    }
    setSubmitting(true);
    try {
      await onSave(key, {
        env,
        enabled,
        rollout_percent: rolloutPercent,
        target_orgs: initial?.target_orgs ?? [],
        target_users: initial?.target_users ?? [],
        description: description || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de la sauvegarde",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>
            {initial ? `Édition : ${initial.key}` : "Nouveau feature flag"}
          </SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="ff-key">Clé</Label>
            <Input
              id="ff-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={!!initial}
              placeholder="ex: deploy.new_ui"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ff-env">Environnement</Label>
            <Select value={env} onValueChange={(v) => setEnv(v as EnvValue)}>
              <SelectTrigger id="ff-env">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prod">prod</SelectItem>
                <SelectItem value="dev">dev</SelectItem>
                <SelectItem value="all">all</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="ff-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
            <Label htmlFor="ff-enabled">Activé</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ff-rollout">Rollout (%)</Label>
            <Input
              id="ff-rollout"
              type="number"
              min={0}
              max={100}
              value={rolloutPercent}
              onChange={(e) => setRolloutPercent(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ff-desc">Description</Label>
            <Input
              id="ff-desc"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <SheetFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
