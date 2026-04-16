"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flag, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useFeatureFlags } from "@/lib/feature-flags";
import { FEATURES } from "@/lib/features";
import { toast } from "sonner";
import { TenantFeatureFlags } from "@/components/admin/tenant-feature-flags";
import { usePageTitle } from "@/hooks/use-page-title";

export default function FeatureFlagsPage() {
  usePageTitle("Feature flags");
  const { isEnabled, setOverride, clearOverride, clearAll, getAll } =
    useFeatureFlags();
  const all = getAll();

  const handleToggle = (key: string, current: boolean) => {
    setOverride(key as keyof typeof FEATURES, !current);
    toast.success(`${key} ${!current ? "activé" : "désactivé"}`);
  };

  const handleClearOverride = (key: string) => {
    clearOverride(key as keyof typeof FEATURES);
    toast.info(`${key} réinitialisé par défaut`);
  };

  const handleClearAll = () => {
    clearAll();
    toast.info("Tous les remplacements effacés");
  };

  const keys = Object.keys(all);
  const overrideCount = keys.filter(
    (k) => all[k].override !== undefined,
  ).length;

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          title="Feature Flags"
          description="Runtime overrides persist in localStorage. Overrides take priority over defaults."
          icon={<Flag className="h-5 w-5 text-primary" />}
          actions={
            overrideCount > 0 ? (
              <Button variant="outline" size="sm" onClick={handleClearAll}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear all overrides ({overrideCount})
              </Button>
            ) : undefined
          }
        />

        <div className="grid gap-3 md:grid-cols-2">
          {keys.map((key) => {
            const { default: def, override, effective } = all[key];
            const hasOverride = override !== undefined;
            return (
              <Card
                key={key}
                className={hasOverride ? "ring-1 ring-primary/30" : ""}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-sm font-medium truncate">
                        {key}
                      </span>
                      {hasOverride && (
                        <Badge
                          variant="outline"
                          className="text-primary border-primary/40 text-xs shrink-0"
                        >
                          overridden
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        default:{" "}
                        <span
                          className={def ? "text-green-600" : "text-red-500"}
                        >
                          {def ? "on" : "off"}
                        </span>
                      </span>
                      <button
                        onClick={() => handleToggle(key, effective)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 ${
                          effective ? "bg-green-500" : "bg-muted-foreground/30"
                        }`}
                        aria-checked={effective}
                        aria-label={`Feature flag ${key}: ${effective ? "activé" : "désactivé"}`}
                        role="switch"
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white dark:bg-zinc-200 shadow transition-transform ${
                            effective ? "translate-x-4.5" : "translate-x-0.5"
                          }`}
                        />
                        <span className="sr-only">
                          {effective ? `Désactiver ${key}` : `Activer ${key}`}
                        </span>
                      </button>
                      {hasOverride && (
                        <button
                          onClick={() => handleClearOverride(key)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Reset to default"
                          aria-label={`Réinitialiser ${key} à la valeur par défaut`}
                        >
                          <RotateCcw
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          <span className="sr-only">Réinitialiser {key}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <TenantFeatureFlags />
      </div>
    </AppLayout>
  );
}
