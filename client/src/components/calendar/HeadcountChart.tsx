"use client";

import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface HeadcountChartProps {
  /** Array of data points keyed by time (HH:mm) and role names */
  data: Array<{ time: string; [role: string]: number | string }>;
  /** List of roles to render as areas */
  roles: string[];
  /** Optional per-role minimum thresholds (shown as red dashed lines) */
  thresholds?: Array<{ role: string; min: number }>;
  className?: string;
  /** Height in pixels (default 220) */
  height?: number;
  /** Whether to show the legend (default true) */
  showLegend?: boolean;
}

// ============================================================================
// Color palette for roles
// ============================================================================

const ROLE_COLORS: Record<string, string> = {
  Bureau: "#22c55e",
  Remote: "#3b82f6",
  Congé: "#f97316",
  Absent: "#ef4444",
  Manager: "#8b5cf6",
  Développeur: "#06b6d4",
  Commercial: "#f59e0b",
  Support: "#ec4899",
  RH: "#84cc16",
  Direction: "#6366f1",
};

const FALLBACK_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f97316",
  "#8b5cf6",
  "#06b6d4",
  "#f59e0b",
  "#ec4899",
  "#84cc16",
  "#6366f1",
  "#14b8a6",
];

function getRoleColor(role: string, index: number): string {
  return ROLE_COLORS[role] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

// ============================================================================
// Custom Tooltip
// ============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  thresholds?: Array<{ role: string; min: number }>;
}

function CustomTooltip({ active, payload, label, thresholds }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const total = payload.reduce((sum, p) => sum + (p.value ?? 0), 0);

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-2.5 text-xs min-w-32">
      <p className="font-semibold text-foreground mb-1.5 border-b border-border pb-1">
        {label}
      </p>
      {payload.map((p) => {
        const threshold = thresholds?.find((t) => t.role === p.name);
        const isBelowThreshold = threshold && p.value < threshold.min;
        return (
          <div key={p.name} className="flex items-center justify-between gap-3 py-0.5">
            <span className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-muted-foreground">{p.name}</span>
            </span>
            <span
              className={cn(
                "font-medium tabular-nums",
                isBelowThreshold ? "text-red-500" : "text-foreground"
              )}
            >
              {p.value}
              {isBelowThreshold && (
                <AlertTriangle className="inline w-2.5 h-2.5 ml-0.5 text-red-500" />
              )}
            </span>
          </div>
        );
      })}
      <div className="border-t border-border mt-1 pt-1 flex justify-between">
        <span className="text-muted-foreground">Total</span>
        <span className="font-bold text-foreground">{total}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Custom Legend
// ============================================================================

interface CustomLegendProps {
  roles: string[];
  thresholds?: Array<{ role: string; min: number }>;
}

function CustomLegend({ roles, thresholds }: CustomLegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-2 pt-1">
      {roles.map((role, i) => {
        const color = getRoleColor(role, i);
        const threshold = thresholds?.find((t) => t.role === role);
        return (
          <div key={role} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-3 h-2 rounded-sm shrink-0"
              style={{ backgroundColor: color, opacity: 0.7 }}
            />
            <span className="text-muted-foreground">{role}</span>
            {threshold && (
              <span className="text-red-500 font-medium">
                (min: {threshold.min})
              </span>
            )}
          </div>
        );
      })}
      {thresholds && thresholds.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs ml-2">
          <svg width="16" height="10">
            <line
              x1="0"
              y1="5"
              x2="16"
              y2="5"
              stroke="#ef4444"
              strokeDasharray="4,3"
              strokeWidth="1.5"
            />
          </svg>
          <span className="text-red-500 text-[11px]">Seuil minimum</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Threshold reference lines
// ============================================================================

interface ThresholdLinesProps {
  thresholds: Array<{ role: string; min: number }>;
  roles: string[];
}

function ThresholdLines({ thresholds, roles }: ThresholdLinesProps) {
  // Group thresholds by min value to avoid duplicate lines
  const byValue = new Map<number, string[]>();
  for (const t of thresholds) {
    if (!byValue.has(t.min)) byValue.set(t.min, []);
    byValue.get(t.min)!.push(t.role);
  }

  return (
    <>
      {[...byValue.entries()].map(([value, roleNames]) => (
        <ReferenceLine
          key={`threshold-${value}`}
          y={value}
          stroke="#ef4444"
          strokeDasharray="5 4"
          strokeWidth={1.5}
          label={{
            value: roleNames.join(", ") + ` ≥ ${value}`,
            position: "insideTopRight",
            fill: "#ef4444",
            fontSize: 10,
          }}
        />
      ))}
    </>
  );
}

// ============================================================================
// Main HeadcountChart
// ============================================================================

export default function HeadcountChart({
  data,
  roles,
  thresholds = [],
  className,
  height = 220,
  showLegend = true,
}: HeadcountChartProps) {
  // Ensure data is sorted by time
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const toMins = (t: string) => {
        const [h, m] = String(t).split(":").map(Number);
        return (h ?? 0) * 60 + (m ?? 0);
      };
      return toMins(String(a.time)) - toMins(String(b.time));
    });
  }, [data]);

  // Compute max Y value for domain
  const maxY = useMemo(() => {
    let max = 0;
    for (const row of sortedData) {
      for (const role of roles) {
        const v = Number(row[role] ?? 0);
        if (v > max) max = v;
      }
    }
    // Include threshold values in max
    for (const t of thresholds) {
      if (t.min > max) max = t.min;
    }
    return Math.max(max + 1, 5);
  }, [sortedData, roles, thresholds]);

  if (data.length === 0 || roles.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-muted-foreground text-sm",
          className
        )}
        style={{ height }}
      >
        Aucune donnée de présence disponible
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {showLegend && <CustomLegend roles={roles} thresholds={thresholds} />}

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={sortedData}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <defs>
            {roles.map((role, i) => {
              const color = getRoleColor(role, i);
              return (
                <linearGradient key={role} id={`grad-${role}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                </linearGradient>
              );
            })}
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />

          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />

          <YAxis
            domain={[0, maxY]}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickCount={5}
            width={32}
          />

          <Tooltip
            content={<CustomTooltip thresholds={thresholds} />}
            cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "4 2" }}
          />

          {/* Threshold reference lines */}
          {thresholds.length > 0 && (
            <ThresholdLines thresholds={thresholds} roles={roles} />
          )}

          {/* Areas per role with step interpolation */}
          {roles.map((role, i) => {
            const color = getRoleColor(role, i);
            return (
              <Area
                key={role}
                type="stepAfter"
                dataKey={role}
                name={role}
                stroke={color}
                strokeWidth={2}
                fill={`url(#grad-${role})`}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================================
// Export role colors helper for use in parent components
// ============================================================================

export { getRoleColor };
