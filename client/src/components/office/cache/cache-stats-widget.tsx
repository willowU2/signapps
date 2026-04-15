"use client";

/**
 * CacheStatsWidget
 *
 * Compact widget showing cache statistics and performance.
 */

import React, { useEffect } from "react";
import {
  Database,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Clock,
  HardDrive,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useCacheStore } from "@/stores/cache-store";

// ============================================================================
// Helpers
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getHitRateColor(rate: number): string {
  if (rate >= 80) return "text-green-600";
  if (rate >= 50) return "text-yellow-600";
  return "text-red-600";
}

function getUsageColor(percentage: number): string {
  if (percentage >= 90) return "bg-red-500";
  if (percentage >= 70) return "bg-yellow-500";
  return "bg-green-500";
}

// ============================================================================
// Stat Item
// ============================================================================

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

function StatItem({
  icon,
  label,
  value,
  subValue,
  trend,
  className,
}: StatItemProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="p-2 rounded-lg bg-muted">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold">{value}</span>
          {subValue && (
            <span className="text-xs text-muted-foreground">{subValue}</span>
          )}
          {trend &&
            trend !== "neutral" &&
            (trend === "up" ? (
              <TrendingUp className="h-3 w-3 text-green-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500" />
            ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface CacheStatsWidgetProps {
  variant?: "compact" | "detailed";
  showActions?: boolean;
  className?: string;
}

export function CacheStatsWidget({
  variant = "compact",
  showActions = false,
  className,
}: CacheStatsWidgetProps) {
  const { stats, performance, isLoadingStats, loadStats, loadPerformance } =
    useCacheStore();

  useEffect(() => {
    loadStats();
    loadPerformance("24h");

    // Refresh periodically
    const interval = setInterval(() => {
      loadStats();
    }, 60000);

    return () => clearInterval(interval);
  }, [loadStats, loadPerformance]);

  if (!stats) {
    return (
      <div className={cn("p-4 rounded-lg border animate-pulse", className)}>
        <div className="h-4 w-24 bg-muted rounded mb-2" />
        <div className="h-8 w-full bg-muted rounded" />
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center gap-4 p-3 rounded-lg border",
          className,
        )}
      >
        <Database className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">Cache Office</span>
            <Badge
              variant="outline"
              className={cn("text-xs", getHitRateColor(stats.hitRate))}
            >
              {stats.hitRate.toFixed(0)}% hit
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Progress value={stats.usedPercentage} className="h-1.5 flex-1" />
            <span className="text-xs text-muted-foreground">
              {formatBytes(stats.totalSize)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Detailed variant
  return (
    <div className={cn("p-4 rounded-lg border space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          <h3 className="font-semibold">Cache Office</h3>
        </div>
        <Badge variant="outline" className={cn(getHitRateColor(stats.hitRate))}>
          {stats.hitRate.toFixed(1)}% hit rate
        </Badge>
      </div>

      {/* Usage Bar */}
      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span>Utilisation du cache</span>
          <span className="font-medium">
            {formatBytes(stats.totalSize)} / {formatBytes(stats.maxSize)}
          </span>
        </div>
        <Progress
          value={stats.usedPercentage}
          className={cn(
            "h-2",
            stats.usedPercentage > 90 && "[&>div]:bg-red-500",
            stats.usedPercentage > 70 &&
              stats.usedPercentage <= 90 &&
              "[&>div]:bg-yellow-500",
          )}
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatItem
          icon={<Zap className="h-4 w-4 text-yellow-500" />}
          label="Hits"
          value={stats.hitCount.toLocaleString()}
          trend={performance && performance.hits > 0 ? "up" : "neutral"}
        />
        <StatItem
          icon={<Minus className="h-4 w-4 text-muted-foreground" />}
          label="Miss"
          value={stats.missCount.toLocaleString()}
        />
        <StatItem
          icon={<Clock className="h-4 w-4 text-blue-500" />}
          label="Temps d'accès"
          value={`${stats.averageAccessTime.toFixed(1)}ms`}
        />
        <StatItem
          icon={<HardDrive className="h-4 w-4 text-purple-500" />}
          label="Entrées"
          value={stats.totalEntries.toLocaleString()}
        />
      </div>

      {/* Performance Summary */}
      {performance && (
        <div className="p-3 rounded-lg bg-muted/50">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            Dernières 24h
          </h4>
          <div className="flex items-center justify-between text-sm">
            <span>Données servies</span>
            <span className="font-medium">
              {formatBytes(performance.bytesServed)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span>Économies</span>
            <span className="font-medium text-green-600">
              {formatBytes(performance.bytesSaved)}
            </span>
          </div>
        </div>
      )}

      {/* Type Distribution */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">
          Répartition par type
        </h4>
        <div className="flex flex-wrap gap-1">
          {Object.entries(stats.entriesByType)
            .filter(([_, count]) => count > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => (
              <Badge key={type} variant="secondary" className="text-xs">
                {type.replace("_", " ")}: {count}
              </Badge>
            ))}
        </div>
      </div>
    </div>
  );
}

export default CacheStatsWidget;
