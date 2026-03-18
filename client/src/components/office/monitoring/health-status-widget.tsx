'use client';

/**
 * HealthStatusWidget
 *
 * Widget showing Office Suite system health.
 */

import React, { useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Server,
  Database,
  HardDrive,
  Cloud,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useMonitoringStore } from '@/stores/monitoring-store';
import type { HealthStatus, HealthCheck } from '@/lib/office/monitoring/types';
import {
  HEALTH_STATUS_LABELS,
  HEALTH_STATUS_COLORS,
} from '@/lib/office/monitoring/types';

// ============================================================================
// Helpers
// ============================================================================

function getStatusIcon(status: HealthStatus) {
  switch (status) {
    case 'healthy':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'degraded':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'unhealthy':
      return <XCircle className="h-4 w-4 text-red-500" />;
  }
}

function getComponentIcon(component: string) {
  switch (component) {
    case 'editor':
      return <FileText className="h-4 w-4" />;
    case 'converter':
      return <RefreshCw className="h-4 w-4" />;
    case 'cache':
      return <HardDrive className="h-4 w-4" />;
    case 'storage':
      return <Server className="h-4 w-4" />;
    case 'sync':
      return <Cloud className="h-4 w-4" />;
    case 'database':
      return <Database className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const componentLabels: Record<string, string> = {
  editor: 'Éditeur',
  converter: 'Convertisseur',
  cache: 'Cache',
  storage: 'Stockage',
  sync: 'Synchronisation',
  database: 'Base de données',
};

// ============================================================================
// Component Health Item
// ============================================================================

interface ComponentHealthItemProps {
  name: string;
  check: HealthCheck;
}

function ComponentHealthItem({ name, check }: ComponentHealthItemProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{getComponentIcon(name)}</span>
        <span className="text-sm">{componentLabels[name] || name}</span>
      </div>
      <div className="flex items-center gap-2">
        {check.latency !== undefined && (
          <span className="text-xs text-muted-foreground">{check.latency}ms</span>
        )}
        {getStatusIcon(check.status)}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface HealthStatusWidgetProps {
  variant?: 'compact' | 'detailed';
  className?: string;
}

export function HealthStatusWidget({
  variant = 'compact',
  className,
}: HealthStatusWidgetProps) {
  const { health, isLoadingHealth, loadHealth } = useMonitoringStore();

  useEffect(() => {
    loadHealth();

    // Refresh health periodically
    const interval = setInterval(loadHealth, 30000);
    return () => clearInterval(interval);
  }, [loadHealth]);

  if (!health) {
    return (
      <div className={cn('p-4 rounded-lg border animate-pulse', className)}>
        <div className="h-4 w-24 bg-muted rounded mb-2" />
        <div className="h-8 w-full bg-muted rounded" />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-3 p-3 rounded-lg border', className)}>
        {getStatusIcon(health.overall)}
        <div className="flex-1">
          <span className="text-sm font-medium">Système Office</span>
          <Badge
            variant="outline"
            className={cn('ml-2 text-xs', HEALTH_STATUS_COLORS[health.overall])}
          >
            {HEALTH_STATUS_LABELS[health.overall]}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          Uptime: {formatUptime(health.uptime)}
        </span>
      </div>
    );
  }

  // Detailed variant
  return (
    <div className={cn('p-4 rounded-lg border space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <h3 className="font-semibold">État du système</h3>
        </div>
        <Badge
          variant="outline"
          className={cn(HEALTH_STATUS_COLORS[health.overall])}
        >
          {HEALTH_STATUS_LABELS[health.overall]}
        </Badge>
      </div>

      {/* Overall Status */}
      <div
        className={cn(
          'p-4 rounded-lg text-center',
          health.overall === 'healthy' && 'bg-green-50 dark:bg-green-900/20',
          health.overall === 'degraded' && 'bg-yellow-50 dark:bg-yellow-900/20',
          health.overall === 'unhealthy' && 'bg-red-50 dark:bg-red-900/20'
        )}
      >
        <div className="flex justify-center mb-2">
          {health.overall === 'healthy' && (
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          )}
          {health.overall === 'degraded' && (
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
          )}
          {health.overall === 'unhealthy' && (
            <XCircle className="h-8 w-8 text-red-500" />
          )}
        </div>
        <p className="font-medium">
          {health.overall === 'healthy' && 'Tous les systèmes opérationnels'}
          {health.overall === 'degraded' && 'Performance dégradée'}
          {health.overall === 'unhealthy' && 'Problème détecté'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Uptime: {formatUptime(health.uptime)}
        </p>
      </div>

      {/* Components */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">
          Composants
        </h4>
        <div className="divide-y">
          {Object.entries(health.components).map(([name, check]) => (
            <ComponentHealthItem key={name} name={name} check={check} />
          ))}
        </div>
      </div>

      {/* Last Incident */}
      {health.lastIncident && (
        <div className="p-3 rounded-lg bg-muted/50 text-sm">
          <p className="text-muted-foreground">Dernier incident:</p>
          <p className="font-medium">
            {new Date(health.lastIncident).toLocaleString('fr-FR')}
          </p>
        </div>
      )}
    </div>
  );
}

export default HealthStatusWidget;
