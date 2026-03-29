'use client';

import { SpinnerInfinity } from 'spinners-react';

/**
 * ConversionJobList
 *
 * Component for displaying and managing conversion jobs.
 */

import React, { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FileText, Clock, CheckCircle2, XCircle, MoreHorizontal, Download, RotateCcw, X, Trash2, Filter, RefreshCw, PlayCircle, PauseCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useConversionQueueStore } from '@/stores/conversion-queue-store';
import type { ConversionJob, JobStatus } from '@/lib/office/conversion-queue/types';
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
  JOB_PRIORITY_LABELS,
  JOB_PRIORITY_COLORS,
  CONVERSION_TYPE_LABELS,
} from '@/lib/office/conversion-queue/types';

// ============================================================================
// Job Status Icon
// ============================================================================

function getStatusIcon(status: JobStatus, className?: string) {
  switch (status) {
    case 'pending':
      return <Clock className={cn('h-4 w-4 text-muted-foreground', className)} />;
    case 'queued':
      return <PauseCircle className={cn('h-4 w-4 text-blue-500', className)} />;
    case 'processing':
      return <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className={cn('h-4 w-4 text-yellow-500 ', className)} />;
    case 'completed':
      return <CheckCircle2 className={cn('h-4 w-4 text-green-500', className)} />;
    case 'failed':
      return <XCircle className={cn('h-4 w-4 text-red-500', className)} />;
    case 'cancelled':
      return <X className={cn('h-4 w-4 text-gray-400', className)} />;
    default:
      return <FileText className={cn('h-4 w-4 text-muted-foreground', className)} />;
  }
}

// ============================================================================
// Job Item Component
// ============================================================================

interface JobItemProps {
  job: ConversionJob;
  isSelected: boolean;
  onSelect: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onDelete: () => void;
  onDownload: () => void;
}

function JobItem({
  job,
  isSelected,
  onSelect,
  onCancel,
  onRetry,
  onDelete,
  onDownload,
}: JobItemProps) {
  const isActive = ['pending', 'queued', 'processing'].includes(job.status);
  const canCancel = ['pending', 'queued'].includes(job.status);
  const canRetry = job.status === 'failed' && job.retryCount < job.maxRetries;
  const canDownload = job.status === 'completed' && job.downloadUrl;
  const canDelete = ['completed', 'failed', 'cancelled'].includes(job.status);

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-transparent hover:bg-muted/50'
      )}
      onClick={onSelect}
    >
      {/* Status Icon */}
      <div className="flex-shrink-0">
        {getStatusIcon(job.status, 'h-5 w-5')}
      </div>

      {/* Job Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{job.sourceDocumentName}</span>
          <Badge variant="outline" className="text-xs">
            {CONVERSION_TYPE_LABELS[job.type]}
          </Badge>
        </div>

        <div className="flex items-center gap-3 mt-1">
          {/* Progress for active jobs */}
          {job.status === 'processing' && (
            <div className="flex items-center gap-2 flex-1">
              <Progress value={job.progress} className="h-1.5 flex-1" />
              <span className="text-xs text-muted-foreground">{job.progress}%</span>
            </div>
          )}

          {/* Status and timing */}
          {job.status !== 'processing' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className={cn('text-xs', JOB_STATUS_COLORS[job.status])}>
                {JOB_STATUS_LABELS[job.status]}
              </Badge>
              <span>·</span>
              <span>
                {formatDistanceToNow(new Date(job.createdAt), {
                  addSuffix: true,
                  locale: fr,
                })}
              </span>
            </div>
          )}
        </div>

        {/* Error message */}
        {job.error && (
          <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3" />
            <span className="truncate">{job.error.message}</span>
          </div>
        )}
      </div>

      {/* Priority Badge */}
      <Badge variant="outline" className={cn('text-xs', JOB_PRIORITY_COLORS[job.priority])}>
        {JOB_PRIORITY_LABELS[job.priority]}
      </Badge>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canDownload && (
            <DropdownMenuItem onClick={onDownload}>
              <Download className="mr-2 h-4 w-4" />
              Télécharger
            </DropdownMenuItem>
          )}
          {canCancel && (
            <DropdownMenuItem onClick={onCancel}>
              <X className="mr-2 h-4 w-4" />
              Annuler
            </DropdownMenuItem>
          )}
          {canRetry && (
            <DropdownMenuItem onClick={onRetry}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Réessayer
            </DropdownMenuItem>
          )}
          {(canDownload || canCancel || canRetry) && <DropdownMenuSeparator />}
          {canDelete && (
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface ConversionJobListProps {
  className?: string;
  onJobSelect?: (job: ConversionJob | null) => void;
}

export function ConversionJobList({ className, onJobSelect }: ConversionJobListProps) {
  const {
    jobs,
    selectedJob,
    isLoading,
    hasMoreJobs,
    totalJobs,
    statusFilter,
    stats,
    loadJobs,
    loadMoreJobs,
    refreshJobs,
    cancelJob,
    retryJob,
    deleteJob,
    downloadJob,
    selectJob,
    setStatusFilter,
    loadStats,
    subscribeToUpdates,
    unsubscribeFromUpdates,
  } = useConversionQueueStore();

  // Initialize
  useEffect(() => {
    loadJobs();
    loadStats();
    subscribeToUpdates();

    return () => {
      unsubscribeFromUpdates();
    };
  }, [loadJobs, loadStats, subscribeToUpdates, unsubscribeFromUpdates]);

  const handleSelectJob = (job: ConversionJob) => {
    selectJob(selectedJob?.id === job.id ? null : job);
    onJobSelect?.(selectedJob?.id === job.id ? null : job);
  };

  const handleDownload = async (jobId: string) => {
    const url = await downloadJob(jobId);
    if (url) {
      window.open(url, '_blank');
    }
  };

  const statusOptions: Array<{ value: JobStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Tous les statuts' },
    { value: 'pending', label: 'En attente' },
    { value: 'queued', label: 'Dans la file' },
    { value: 'processing', label: 'En cours' },
    { value: 'completed', label: 'Terminés' },
    { value: 'failed', label: 'Échoués' },
    { value: 'cancelled', label: 'Annulés' },
  ];

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="font-semibold">File de conversion</h2>
          <p className="text-sm text-muted-foreground">
            {totalJobs} tâche{totalJobs !== 1 ? 's' : ''}
            {stats && ` · ${stats.processingJobs} en cours`}
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={refreshJobs} disabled={isLoading}>
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 p-3 border-b">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select
          value={statusFilter ?? 'all'}
          onValueChange={(value) => setStatusFilter(value === 'all' ? null : (value as JobStatus))}
        >
          <SelectTrigger className="w-[180px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Job List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {isLoading && jobs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8  text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Aucune tâche de conversion</p>
            </div>
          ) : (
            <>
              {jobs.map((job) => (
                <JobItem
                  key={job.id}
                  job={job}
                  isSelected={selectedJob?.id === job.id}
                  onSelect={() => handleSelectJob(job)}
                  onCancel={() => cancelJob(job.id)}
                  onRetry={() => retryJob(job.id)}
                  onDelete={() => deleteJob(job.id)}
                  onDownload={() => handleDownload(job.id)}
                />
              ))}

              {hasMoreJobs && (
                <div className="flex justify-center pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMoreJobs}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4  mr-2" />
                    ) : null}
                    Charger plus
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Stats Footer */}
      {stats && (
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
          <span>
            {stats.pendingJobs} en attente · {stats.processingJobs} en cours
          </span>
          <span>
            Temps moyen: {Math.round(stats.averageProcessingTime)}s
          </span>
        </div>
      )}
    </div>
  );
}

export default ConversionJobList;
