"use client";

/**
 * Performance Chart widget — self-contained.
 * Shows CPU/RAM/Disk metrics from the metrics service.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Cpu, MemoryStick, HardDrive, Wifi } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard";
import type { WidgetRenderProps } from "@/lib/dashboard/types";

function MetricBar({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Icon className="h-3 w-3" />
          {label}
        </span>
        <span className="font-medium">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function WidgetPerformanceChart({
  widget,
}: Partial<WidgetRenderProps> = {}) {
  const { data, isLoading } = useDashboardData();

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <MetricBar
          label="CPU"
          value={data?.cpu ?? 0}
          icon={Cpu}
          color="bg-blue-500"
        />
        <MetricBar
          label="Mémoire"
          value={data?.memory ?? 0}
          icon={MemoryStick}
          color="bg-purple-500"
        />
        <MetricBar
          label="Disque"
          value={data?.disk ?? 0}
          icon={HardDrive}
          color="bg-amber-500"
        />
      </CardContent>
    </Card>
  );
}
