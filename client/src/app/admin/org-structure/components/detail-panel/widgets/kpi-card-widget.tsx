"use client";

/**
 * kpi-card-widget — single KPI card rendered inside main_tabs when a
 * layout item carries `widget_type === "kpi_card"`.
 *
 * The `config.metric` points at a builtin metric id (headcount |
 * positions_open | raci_count | …) resolved by
 * `GET /org/panel-layouts/metrics`.
 */
import { useEffect, useState } from "react";
import { orgApi } from "@/lib/api/org";
import type { PanelEntitySlug } from "@/lib/api/org";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface KpiCardWidgetProps {
  config: Record<string, unknown>;
  ctx: {
    entityId: string;
    entityType: PanelEntitySlug;
  };
}

export function KpiCardWidget({ config, ctx }: KpiCardWidgetProps) {
  const metric = typeof config.metric === "string" ? config.metric : "";
  const customLabel =
    typeof config.label === "string" ? config.label : undefined;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState<number | null>(null);
  const [label, setLabel] = useState<string>(customLabel ?? metric);

  useEffect(() => {
    let cancelled = false;
    if (!metric || !ctx.entityId) {
      setLoading(false);
      return () => {};
    }
    setLoading(true);
    orgApi.panelLayouts
      .metric(metric, ctx.entityId, ctx.entityType)
      .then((res) => {
        if (cancelled) return;
        setValue(res.data.value);
        if (!customLabel) setLabel(res.data.label);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erreur KPI");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [metric, ctx.entityId, ctx.entityType, customLabel]);

  return (
    <Card className="p-0 overflow-hidden">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="py-3 px-3">
        {loading ? (
          <div className="h-6 bg-muted rounded animate-pulse w-12" />
        ) : error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : (
          <p className="text-2xl font-semibold tabular-nums">{value ?? "—"}</p>
        )}
      </CardContent>
    </Card>
  );
}
