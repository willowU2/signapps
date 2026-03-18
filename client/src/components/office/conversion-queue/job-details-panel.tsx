'use client';

/**
 * JobDetailsPanel
 *
 * Panel for displaying detailed information about a conversion job.
 */

import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  FileText,
  FileOutput,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  RotateCcw,
  X,
  Trash2,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Timer,
  Hash,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ConversionJob } from '@/lib/office/conversion-queue/types';
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
  JOB_PRIORITY_LABELS,
  JOB_PRIORITY_COLORS,
  CONVERSION_TYPE_LABELS,
} from '@/lib/office/conversion-queue/types';

// ============================================================================
// Info Row Component
// ============================================================================

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface JobDetailsPanelProps {
  job: ConversionJob;
  onCancel?: () => void;
  onRetry?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  onClose?: () => void;
  className?: string;
}

export function JobDetailsPanel({
  job,
  onCancel,
  onRetry,
  onDelete,
  onDownload,
  onClose,
  className,
}: JobDetailsPanelProps) {
  const isActive = ['pending', 'queued', 'processing'].includes(job.status);
  const canCancel = ['pending', 'queued'].includes(job.status);
  const canRetry = job.status === 'failed' && job.retryCount < job.maxRetries;
  const canDownload = job.status === 'completed' && job.downloadUrl;
  const canDelete = ['completed', 'failed', 'cancelled'].includes(job.status);

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <div className={cn('flex flex-col h-full border-l', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Détails de la tâche</h3>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Status Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Badge
                variant="secondary"
                className={cn('text-sm px-3 py-1', JOB_STATUS_COLORS[job.status])}
              >
                {JOB_STATUS_LABELS[job.status]}
              </Badge>
              <Badge variant="outline" className={cn(JOB_PRIORITY_COLORS[job.priority])}>
                {JOB_PRIORITY_LABELS[job.priority]}
              </Badge>
            </div>

            {/* Progress for active jobs */}
            {job.status === 'processing' && (
              <div className="space-y-2">
                <Progress value={job.progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  {job.progress}% terminé
                  {job.estimatedDuration && (
                    <> · ~{formatDuration(job.estimatedDuration - (job.progress / 100) * job.estimatedDuration)} restant</>
                  )}
                </p>
              </div>
            )}

            {/* Error message */}
            {job.error && (
              <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center gap-2 text-destructive mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium text-sm">Erreur</span>
                </div>
                <p className="text-sm">{job.error.message}</p>
                {job.error.details && (
                  <p className="text-xs text-muted-foreground mt-1">{job.error.details}</p>
                )}
                {job.error.retryable && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Tentatives: {job.retryCount} / {job.maxRetries}
                  </p>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Conversion Info */}
          <div>
            <h4 className="text-sm font-medium mb-3">Conversion</h4>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <FileText className="h-8 w-8 text-blue-500" />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <FileOutput className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-3 space-y-1">
              <InfoRow
                icon={<FileText className="h-4 w-4" />}
                label="Document source"
                value={job.sourceDocumentName}
              />
              <InfoRow
                icon={<FileOutput className="h-4 w-4" />}
                label="Format cible"
                value={job.targetFormat.toUpperCase()}
              />
              <InfoRow
                icon={<Hash className="h-4 w-4" />}
                label="Type de conversion"
                value={CONVERSION_TYPE_LABELS[job.type]}
              />
            </div>
          </div>

          <Separator />

          {/* Timing Info */}
          <div>
            <h4 className="text-sm font-medium mb-3">Chronologie</h4>
            <div className="space-y-1">
              <InfoRow
                icon={<Calendar className="h-4 w-4" />}
                label="Créé le"
                value={format(new Date(job.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
              />
              {job.startedAt && (
                <InfoRow
                  icon={<Clock className="h-4 w-4" />}
                  label="Démarré"
                  value={formatDistanceToNow(new Date(job.startedAt), {
                    addSuffix: true,
                    locale: fr,
                  })}
                />
              )}
              {job.completedAt && (
                <InfoRow
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  label="Terminé"
                  value={format(new Date(job.completedAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                />
              )}
              {job.startedAt && job.completedAt && (
                <InfoRow
                  icon={<Timer className="h-4 w-4" />}
                  label="Durée"
                  value={formatDuration(
                    Math.round(
                      (new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000
                    )
                  )}
                />
              )}
            </div>
          </div>

          {/* Result Info */}
          {job.status === 'completed' && job.resultFileName && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3">Résultat</h4>
                <div className="space-y-1">
                  <InfoRow
                    icon={<FileOutput className="h-4 w-4" />}
                    label="Fichier généré"
                    value={job.resultFileName}
                  />
                  <InfoRow
                    icon={<Hash className="h-4 w-4" />}
                    label="Taille"
                    value={formatFileSize(job.resultFileSize)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Options Info */}
          {job.options && Object.keys(job.options).length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3">Options</h4>
                <div className="space-y-1">
                  {job.options.pageSize && (
                    <InfoRow
                      icon={<Settings className="h-4 w-4" />}
                      label="Taille de page"
                      value={job.options.pageSize}
                    />
                  )}
                  {job.options.orientation && (
                    <InfoRow
                      icon={<Settings className="h-4 w-4" />}
                      label="Orientation"
                      value={job.options.orientation === 'portrait' ? 'Portrait' : 'Paysage'}
                    />
                  )}
                  {job.options.quality && (
                    <InfoRow
                      icon={<Settings className="h-4 w-4" />}
                      label="Qualité"
                      value={`${job.options.quality}%`}
                    />
                  )}
                  {job.options.includeComments && (
                    <InfoRow
                      icon={<Settings className="h-4 w-4" />}
                      label="Commentaires"
                      value="Inclus"
                    />
                  )}
                  {job.options.includeTrackChanges && (
                    <InfoRow
                      icon={<Settings className="h-4 w-4" />}
                      label="Suivi des modifications"
                      value="Inclus"
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="flex items-center gap-2 p-4 border-t">
        {canDownload && (
          <Button onClick={onDownload} className="flex-1">
            <Download className="mr-2 h-4 w-4" />
            Télécharger
          </Button>
        )}
        {canCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1">
            <X className="mr-2 h-4 w-4" />
            Annuler
          </Button>
        )}
        {canRetry && (
          <Button variant="outline" onClick={onRetry} className="flex-1">
            <RotateCcw className="mr-2 h-4 w-4" />
            Réessayer
          </Button>
        )}
        {canDelete && (
          <Button variant="outline" onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default JobDetailsPanel;
