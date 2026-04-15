"use client";

/**
 * MetricsDashboard
 *
 * Dashboard for Office Suite metrics and monitoring.
 */

import React, { useEffect } from "react";
import {
  FileText,
  Users,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Activity,
  BarChart3,
  PieChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useMonitoringStore } from "@/stores/monitoring-store";
import type { TimeRange } from "@/lib/office/monitoring/types";
import { TIME_RANGE_LABELS } from "@/lib/office/monitoring/types";

// ============================================================================
// Stat Card
// ============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: number;
  className?: string;
}

function StatCard({
  icon,
  label,
  value,
  subValue,
  trend,
  className,
}: StatCardProps) {
  return (
    <div className={cn("p-4 rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="p-2 rounded-lg bg-muted">{icon}</div>
        {trend !== undefined && (
          <div
            className={cn(
              "flex items-center text-xs font-medium",
              trend >= 0 ? "text-green-600" : "text-red-600",
            )}
          >
            {trend >= 0 ? (
              <TrendingUp className="h-3 w-3 mr-1" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1" />
            )}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      {subValue && (
        <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
      )}
    </div>
  );
}

// ============================================================================
// Document Type Chart
// ============================================================================

interface DocumentTypeChartProps {
  breakdown: Array<{
    type: string;
    count: number;
    percentage: number;
    trend: number;
  }>;
}

function DocumentTypeChart({ breakdown }: DocumentTypeChartProps) {
  const colors = {
    document: "bg-blue-500",
    spreadsheet: "bg-green-500",
    presentation: "bg-orange-500",
    form: "bg-purple-500",
  };

  const labels = {
    document: "Documents",
    spreadsheet: "Feuilles de calcul",
    presentation: "Présentations",
    form: "Formulaires",
  };

  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Types de documents</h3>
      </div>
      <div className="space-y-3">
        {breakdown.map((item) => (
          <div key={item.type}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span>
                {labels[item.type as keyof typeof labels] || item.type}
              </span>
              <span className="font-medium">{item.count}</span>
            </div>
            <div className="flex items-center gap-2">
              <Progress
                value={item.percentage}
                className={cn(
                  "h-2 flex-1",
                  `[&>div]:${colors[item.type as keyof typeof colors] || "bg-gray-500"}`,
                )}
              />
              <span className="text-xs text-muted-foreground w-12 text-right">
                {item.percentage.toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Performance Metrics
// ============================================================================

interface PerformanceMetricsProps {
  averageLoadTime: number;
  averageSaveTime: number;
  averageExportTime: number;
  p99LoadTime: number;
}

function PerformanceMetrics({
  averageLoadTime,
  averageSaveTime,
  averageExportTime,
  p99LoadTime,
}: PerformanceMetricsProps) {
  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getPerformanceColor = (
    ms: number,
    thresholds: { good: number; warn: number },
  ) => {
    if (ms <= thresholds.good) return "text-green-600";
    if (ms <= thresholds.warn) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Performance</h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Chargement moyen</p>
          <p
            className={cn(
              "text-lg font-semibold",
              getPerformanceColor(averageLoadTime, { good: 500, warn: 1000 }),
            )}
          >
            {formatMs(averageLoadTime)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Sauvegarde moyenne</p>
          <p
            className={cn(
              "text-lg font-semibold",
              getPerformanceColor(averageSaveTime, { good: 200, warn: 500 }),
            )}
          >
            {formatMs(averageSaveTime)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Export moyen</p>
          <p
            className={cn(
              "text-lg font-semibold",
              getPerformanceColor(averageExportTime, {
                good: 2000,
                warn: 5000,
              }),
            )}
          >
            {formatMs(averageExportTime)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">P99 Chargement</p>
          <p
            className={cn(
              "text-lg font-semibold",
              getPerformanceColor(p99LoadTime, { good: 1000, warn: 2000 }),
            )}
          >
            {formatMs(p99LoadTime)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Conversion Stats
// ============================================================================

interface ConversionStatsProps {
  total: number;
  successful: number;
  failed: number;
  averageTime: number;
}

function ConversionStats({
  total,
  successful,
  failed,
  averageTime,
}: ConversionStatsProps) {
  const successRate = total > 0 ? (successful / total) * 100 : 0;

  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-center gap-2 mb-4">
        <RefreshCw className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Conversions</h3>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm">Taux de succès</span>
          <Badge
            variant="outline"
            className={cn(
              successRate >= 95
                ? "text-green-600"
                : successRate >= 80
                  ? "text-yellow-600"
                  : "text-red-600",
            )}
          >
            {successRate.toFixed(1)}%
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded bg-muted">
            <p className="text-lg font-semibold">{total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="p-2 rounded bg-green-50 dark:bg-green-900/20">
            <p className="text-lg font-semibold text-green-600">{successful}</p>
            <p className="text-xs text-muted-foreground">Réussies</p>
          </div>
          <div className="p-2 rounded bg-red-50 dark:bg-red-900/20">
            <p className="text-lg font-semibold text-red-600">{failed}</p>
            <p className="text-xs text-muted-foreground">Échouées</p>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Temps moyen</span>
          <span className="font-medium">
            {(averageTime / 1000).toFixed(1)}s
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface MetricsDashboardProps {
  className?: string;
}

export function MetricsDashboard({ className }: MetricsDashboardProps) {
  const {
    summary,
    documentBreakdown,
    userActivity,
    timeRange,
    isLoadingSummary,
    loadSummary,
    loadDocumentBreakdown,
    loadUserActivity,
    setTimeRange,
    subscribeToMetrics,
    unsubscribeAll,
  } = useMonitoringStore();

  useEffect(() => {
    loadSummary();
    loadDocumentBreakdown();
    loadUserActivity();
    subscribeToMetrics();

    return () => {
      unsubscribeAll();
    };
  }, [
    loadSummary,
    loadDocumentBreakdown,
    loadUserActivity,
    subscribeToMetrics,
    unsubscribeAll,
  ]);

  const handleRefresh = () => {
    loadSummary();
    loadDocumentBreakdown();
    loadUserActivity();
  };

  if (!summary) {
    return (
      <div className={cn("flex items-center justify-center h-64", className)}>
        <div className="text-center">
          <Activity className="h-12 w-12 mx-auto mb-3 text-muted-foreground animate-pulse" />
          <p className="text-sm text-muted-foreground">
            Chargement des métriques...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Tableau de bord Office</h2>
          <p className="text-sm text-muted-foreground">
            Mis à jour: {new Date(summary.updatedAt).toLocaleString("fr-FR")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={timeRange}
            onValueChange={(v) => setTimeRange(v as TimeRange)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIME_RANGE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoadingSummary}
          >
            <RefreshCw
              className={cn("h-4 w-4", isLoadingSummary && "animate-spin")}
            />
          </Button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText className="h-5 w-5 text-blue-500" />}
          label="Documents créés"
          value={summary.documentsCreated}
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-green-500" />}
          label="Sessions éditeur"
          value={summary.editorSessions}
          subValue={`${summary.collaborativeSessions} collaboratives`}
        />
        <StatCard
          icon={<RefreshCw className="h-5 w-5 text-orange-500" />}
          label="Conversions"
          value={summary.conversionsTotal}
          subValue={`${summary.conversionsSuccessful} réussies`}
        />
        <StatCard
          icon={<Zap className="h-5 w-5 text-yellow-500" />}
          label="Hit rate cache"
          value={`${summary.cacheHitRate.toFixed(1)}%`}
        />
      </div>

      {/* Secondary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Document Breakdown */}
        {documentBreakdown.length > 0 && (
          <DocumentTypeChart breakdown={documentBreakdown} />
        )}

        {/* Performance */}
        <PerformanceMetrics
          averageLoadTime={summary.averageLoadTime}
          averageSaveTime={summary.averageSaveTime}
          averageExportTime={summary.averageExportTime}
          p99LoadTime={summary.p99LoadTime}
        />

        {/* Conversions */}
        <ConversionStats
          total={summary.conversionsTotal}
          successful={summary.conversionsSuccessful}
          failed={summary.conversionsFailed}
          averageTime={summary.averageConversionTime}
        />
      </div>

      {/* Activity & Sync */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* User Activity */}
        {userActivity && (
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Activité utilisateurs</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{userActivity.activeUsers}</p>
                <p className="text-xs text-muted-foreground">Actifs</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {userActivity.newUsers}
                </p>
                <p className="text-xs text-muted-foreground">Nouveaux</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {userActivity.returningUsers}
                </p>
                <p className="text-xs text-muted-foreground">Récurrents</p>
              </div>
            </div>
            {userActivity.topUsers.length > 0 && (
              <>
                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground mb-2">
                  Top contributeurs
                </p>
                <div className="space-y-2">
                  {userActivity.topUsers.slice(0, 3).map((user, index) => (
                    <div
                      key={user.userId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {index + 1}.
                        </span>
                        {user.userName}
                      </span>
                      <span className="font-medium">
                        {user.totalEdits} édits
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Sync Status */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Synchronisation</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded bg-muted text-center">
              <p className="text-2xl font-bold">{summary.syncedDocuments}</p>
              <p className="text-xs text-muted-foreground">
                Documents synchronisés
              </p>
            </div>
            <div
              className={cn(
                "p-3 rounded text-center",
                summary.syncConflicts > 0
                  ? "bg-yellow-50 dark:bg-yellow-900/20"
                  : "bg-muted",
              )}
            >
              <p
                className={cn(
                  "text-2xl font-bold",
                  summary.syncConflicts > 0 && "text-yellow-600",
                )}
              >
                {summary.syncConflicts}
              </p>
              <p className="text-xs text-muted-foreground">Conflits</p>
            </div>
          </div>
          {summary.lastSyncTime && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Dernière sync:{" "}
              {new Date(summary.lastSyncTime).toLocaleString("fr-FR")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default MetricsDashboard;
