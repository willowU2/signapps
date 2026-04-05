import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { cn } from "@/lib/utils";

interface StatCardTrend {
  /** Trend value to display (e.g., "12%", "+5") */
  value: string;
  /** Whether the trend is positive (green) or negative (red) */
  positive: boolean;
}

interface StatCardProps {
  /** Card title */
  title: string;
  /** Main metric value */
  value: string | number;
  /** Contextual description under the value */
  description?: string;
  /** Icon shown in the card header (right-aligned) */
  icon?: React.ReactNode;
  /** Optional trend indicator shown next to the value */
  trend?: StatCardTrend;
  /** Additional className */
  className?: string;
}

/**
 * Standardized metric/stat card for dashboards and overview pages.
 *
 * @example
 * ```tsx
 * <StatCard
 *   title="Employés actifs"
 *   value={142}
 *   description="Sur 150 inscrits"
 *   icon={<Users className="h-4 w-4" />}
 *   trend={{ value: "3.2%", positive: true }}
 * />
 * ```
 */
export function StatCard({
  title,
  value,
  description,
  icon,
  trend,
  className,
}: StatCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold count-up">{value}</div>
          {trend && (
            <span
              className={cn(
                "text-xs font-medium",
                trend.positive ? "text-green-500" : "text-red-500",
              )}
            >
              {trend.positive ? "+" : ""}
              {trend.value}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
