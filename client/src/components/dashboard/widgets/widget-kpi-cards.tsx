"use client";

// Feature 23: KPI cards pulling from multiple services

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useKpiMetrics } from "@/hooks/use-kpi-metrics";
import type { WidgetRenderProps } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

export function WidgetKpiCards({ widget }: Partial<WidgetRenderProps> = {}) {
  const { kpis, isLoading } = useKpiMetrics();

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-primary" />
          KPIs clés
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-3 pt-0">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : kpis.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
            Aucune métrique disponible
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {kpis.slice(0, 6).map((k) => {
              const TrendIcon =
                k.trend === "up"
                  ? TrendingUp
                  : k.trend === "down"
                    ? TrendingDown
                    : Minus;
              const trendColor =
                k.trend === "up"
                  ? "text-green-600"
                  : k.trend === "down"
                    ? "text-red-500"
                    : "text-muted-foreground";
              return (
                <div
                  key={k.id}
                  className={cn(
                    "rounded-lg p-3 border",
                    k.color ? `border-${k.color}-200` : "",
                  )}
                >
                  <p className="text-xs text-muted-foreground truncate mb-1">
                    {k.label}
                  </p>
                  <div className="flex items-end justify-between gap-1">
                    <p className="text-lg font-bold leading-none">
                      {typeof k.value === "number"
                        ? k.value.toLocaleString("fr-FR")
                        : k.value}
                      {k.unit && (
                        <span className="text-xs font-normal ml-0.5 text-muted-foreground">
                          {k.unit}
                        </span>
                      )}
                    </p>
                    {k.change !== undefined && (
                      <div
                        className={`flex items-center gap-0.5 ${trendColor}`}
                      >
                        <TrendIcon className="w-3 h-3" />
                        <span className="text-xs font-medium">
                          {Math.abs(k.change)}%
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                    {k.module}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
