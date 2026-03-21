'use client';

import { SpinnerInfinity } from 'spinners-react';

/**
 * QueueStatusWidget
 *
 * Compact widget showing queue health and active jobs.
 */

import React, { useEffect } from 'react';
import { FileText, CheckCircle2, AlertCircle, Clock, TrendingUp, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useConversionQueueStore } from '@/stores/conversion-queue-store';

// ============================================================================
// Health Status Badge
// ============================================================================

function getHealthColor(status?: string) {
  switch (status) {
    case 'healthy':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'degraded':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getHealthLabel(status?: string) {
  switch (status) {
    case 'healthy':
      return 'Opérationnel';
    case 'degraded':
      return 'Dégradé';
    case 'critical':
      return 'Critique';
    default:
      return 'Inconnu';
  }
}

// ============================================================================
// Stat Card
// ============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
}

function StatCard({ icon, label, value, subValue, trend }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className="p-2 rounded-full bg-background">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1">
          <span className="text-lg font-semibold">{value}</span>
          {subValue && (
            <span className="text-xs text-muted-foreground">{subValue}</span>
          )}
        </div>
      </div>
      {trend && trend !== 'neutral' && (
        <TrendingUp
          className={cn(
            'h-4 w-4',
            trend === 'up' ? 'text-green-500' : 'text-red-500 rotate-180'
          )}
        />
      )}
    </div>
  );
}

// ============================================================================
// Active Job Preview
// ============================================================================

interface ActiveJobPreviewProps {
  name: string;
  progress: number;
  type: string;
}

function ActiveJobPreview({ name, progress, type }: ActiveJobPreviewProps) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg border bg-background">
      <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4  text-primary" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <div className="flex items-center gap-2 mt-1">
          <Progress value={progress} className="h-1 flex-1" />
          <span className="text-xs text-muted-foreground">{progress}%</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface QueueStatusWidgetProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export function QueueStatusWidget({
  variant = 'compact',
  className,
}: QueueStatusWidgetProps) {
  const {
    activeJobs,
    stats,
    health,
    loadStats,
    loadHealth,
    subscribeToUpdates,
    unsubscribeFromUpdates,
  } = useConversionQueueStore();

  useEffect(() => {
    loadStats();
    loadHealth();
    subscribeToUpdates();

    // Refresh stats periodically
    const interval = setInterval(() => {
      loadStats();
      loadHealth();
    }, 30000);

    return () => {
      clearInterval(interval);
      unsubscribeFromUpdates();
    };
  }, [loadStats, loadHealth, subscribeToUpdates, unsubscribeFromUpdates]);

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-3 p-3 rounded-lg border', className)}>
        <Activity className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">File de conversion</span>
            <Badge variant="outline" className={getHealthColor(health?.status)}>
              {getHealthLabel(health?.status)}
            </Badge>
          </div>
          {stats && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {stats.processingJobs} en cours · {stats.pendingJobs} en attente
            </p>
          )}
        </div>
        {activeJobs.length > 0 && (
          <div className="flex items-center gap-1 text-primary">
            <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4 " />
            <span className="text-sm font-medium">{activeJobs.length}</span>
          </div>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className={cn('p-4 rounded-lg border space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <h3 className="font-semibold">File de conversion</h3>
        </div>
        <Badge variant="outline" className={getHealthColor(health?.status)}>
          {getHealthLabel(health?.status)}
        </Badge>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon={<Clock className="h-4 w-4 text-blue-500" />}
            label="En attente"
            value={stats.pendingJobs}
          />
          <StatCard
            icon={<SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4 text-yellow-500" />}
            label="En cours"
            value={stats.processingJobs}
          />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
            label="Terminés"
            value={stats.completedJobs}
          />
          <StatCard
            icon={<AlertCircle className="h-4 w-4 text-red-500" />}
            label="Échoués"
            value={stats.failedJobs}
          />
        </div>
      )}

      {/* Health Details */}
      {health && (
        <div className="flex items-center justify-between text-xs text-muted-foreground p-2 rounded bg-muted/50">
          <span>
            Workers: {health.workersActive}/{health.workersTotal}
          </span>
          <span>
            Débit: {health.processingRate.toFixed(1)}/min
          </span>
          <span>
            Erreurs: {health.errorRate.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Active Jobs Preview */}
      {activeJobs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Tâches actives</h4>
          {activeJobs.slice(0, 3).map((job) => (
            <ActiveJobPreview
              key={job.id}
              name={job.sourceDocumentName}
              progress={job.progress}
              type={job.type}
            />
          ))}
          {activeJobs.length > 3 && (
            <p className="text-xs text-muted-foreground text-center">
              + {activeJobs.length - 3} autre{activeJobs.length - 3 > 1 ? 's' : ''} tâche{activeJobs.length - 3 > 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Estimated Wait Time */}
      {stats && stats.estimatedWaitTime > 0 && (
        <div className="flex items-center justify-center gap-2 p-2 rounded bg-muted/50 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            Temps d'attente estimé: ~{Math.round(stats.estimatedWaitTime / 60)} min
          </span>
        </div>
      )}
    </div>
  );
}

export default QueueStatusWidget;
