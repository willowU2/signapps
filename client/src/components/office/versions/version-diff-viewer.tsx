'use client';

import { SpinnerInfinity } from 'spinners-react';

/**
 * VersionDiffViewer
 *
 * Component for viewing differences between two document versions.
 */

import React, { useMemo } from 'react';
import { GitCompare, Plus, Minus, Edit3, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useVersionsStore } from '@/stores/versions-store';
import type { VersionDiff, DiffLine, DiffChangeType } from '@/lib/office/versions/types';

// ============================================================================
// Diff Line Component
// ============================================================================

interface DiffLineProps {
  line: DiffLine;
  viewMode: 'unified' | 'sideBySide';
}

function DiffLineComponent({ line, viewMode }: DiffLineProps) {
  const getBgColor = (type: DiffChangeType) => {
    switch (type) {
      case 'added':
        return 'bg-green-50 dark:bg-green-900/20';
      case 'removed':
        return 'bg-red-50 dark:bg-red-900/20';
      case 'modified':
        return 'bg-amber-50 dark:bg-amber-900/20';
      default:
        return '';
    }
  };

  const getTextColor = (type: DiffChangeType) => {
    switch (type) {
      case 'added':
        return 'text-green-700 dark:text-green-400';
      case 'removed':
        return 'text-red-700 dark:text-red-400';
      case 'modified':
        return 'text-amber-700 dark:text-amber-400';
      default:
        return '';
    }
  };

  const getLinePrefix = (type: DiffChangeType) => {
    switch (type) {
      case 'added':
        return '+';
      case 'removed':
        return '-';
      case 'modified':
        return '~';
      default:
        return ' ';
    }
  };

  // Render content with inline changes highlighted
  const renderContent = () => {
    if (!line.inlineChanges || line.inlineChanges.length === 0) {
      return <span>{line.content}</span>;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    line.inlineChanges.forEach((change, i) => {
      // Add text before this change
      if (change.start > lastIndex) {
        parts.push(
          <span key={`text-${i}`}>
            {line.content.slice(lastIndex, change.start)}
          </span>
        );
      }

      // Add the changed text
      parts.push(
        <span
          key={`change-${i}`}
          className={cn(
            'rounded px-0.5',
            change.type === 'added'
              ? 'bg-green-200 dark:bg-green-800'
              : 'bg-red-200 dark:bg-red-800 line-through'
          )}
        >
          {change.text}
        </span>
      );

      lastIndex = change.end;
    });

    // Add remaining text
    if (lastIndex < line.content.length) {
      parts.push(<span key="end">{line.content.slice(lastIndex)}</span>);
    }

    return <>{parts}</>;
  };

  return (
    <div
      className={cn(
        'flex items-stretch font-mono text-sm',
        getBgColor(line.type)
      )}
    >
      {/* Line numbers */}
      <div className="flex-shrink-0 w-20 flex border-r border-border/50">
        <div className="w-10 px-2 py-0.5 text-right text-muted-foreground text-xs border-r border-border/50">
          {line.sourceLineNumber ?? ''}
        </div>
        <div className="w-10 px-2 py-0.5 text-right text-muted-foreground text-xs">
          {line.targetLineNumber ?? ''}
        </div>
      </div>

      {/* Prefix */}
      <div
        className={cn(
          'flex-shrink-0 w-6 px-2 py-0.5 font-bold',
          getTextColor(line.type)
        )}
      >
        {getLinePrefix(line.type)}
      </div>

      {/* Content */}
      <div className={cn('flex-1 px-2 py-0.5 whitespace-pre-wrap break-all', getTextColor(line.type))}>
        {renderContent()}
      </div>
    </div>
  );
}

// ============================================================================
// Stats Component
// ============================================================================

interface DiffStatsProps {
  stats: VersionDiff['stats'];
}

function DiffStats({ stats }: DiffStatsProps) {
  return (
    <div className="flex items-center gap-4 text-sm">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-green-600">
              <Plus className="h-4 w-4" />
              <span>+{stats.linesAdded}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {stats.linesAdded} lignes ajoutées ({stats.wordsAdded} mots, {stats.charsAdded} caractères)
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-red-600">
              <Minus className="h-4 w-4" />
              <span>-{stats.linesRemoved}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {stats.linesRemoved} lignes supprimées ({stats.wordsRemoved} mots, {stats.charsRemoved} caractères)
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {stats.linesModified > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-amber-600">
                <Edit3 className="h-4 w-4" />
                <span>~{stats.linesModified}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>{stats.linesModified} lignes modifiées</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

// ============================================================================
// Navigation Component
// ============================================================================

interface DiffNavigationProps {
  currentChange: number;
  totalChanges: number;
  onPrevious: () => void;
  onNext: () => void;
}

function DiffNavigation({
  currentChange,
  totalChanges,
  onPrevious,
  onNext,
}: DiffNavigationProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={onPrevious}
        disabled={currentChange <= 1}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm text-muted-foreground min-w-[80px] text-center">
        {currentChange} / {totalChanges}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={onNext}
        disabled={currentChange >= totalChanges}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface VersionDiffViewerProps {
  className?: string;
  onClose?: () => void;
}

export function VersionDiffViewer({ className, onClose }: VersionDiffViewerProps) {
  const {
    comparisonResult,
    isComparing,
    versions,
    clearComparison,
  } = useVersionsStore();

  const [currentChangeIndex, setCurrentChangeIndex] = React.useState(1);

  // Get changed lines for navigation
  const changedLines = useMemo(() => {
    if (!comparisonResult) return [];
    return comparisonResult.lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.type !== 'unchanged');
  }, [comparisonResult]);

  // Get version info
  const sourceVersion = versions.find(
    (v) => v.id === comparisonResult?.sourceVersionId
  );
  const targetVersion = versions.find(
    (v) => v.id === comparisonResult?.targetVersionId
  );

  const handlePreviousChange = () => {
    setCurrentChangeIndex((prev) => Math.max(1, prev - 1));
  };

  const handleNextChange = () => {
    setCurrentChangeIndex((prev) => Math.min(changedLines.length, prev + 1));
  };

  const handleClose = () => {
    clearComparison();
    if (onClose) onClose();
  };

  if (isComparing) {
    return (
      <div className={cn('flex items-center justify-center h-64', className)}>
        <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8  text-muted-foreground" />
      </div>
    );
  }

  if (!comparisonResult) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-64 text-muted-foreground', className)}>
        <GitCompare className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-sm">Sélectionnez deux versions pour comparer</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-3">
          <GitCompare className="h-5 w-5" />
          <h2 className="font-semibold">Comparaison</h2>
          {sourceVersion && targetVersion && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">v{sourceVersion.versionNumber}</Badge>
              <ArrowRight className="h-4 w-4" />
              <Badge variant="outline">v{targetVersion.versionNumber}</Badge>
            </div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={handleClose}>
          Fermer
        </Button>
      </div>

      {/* Stats and navigation */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <DiffStats stats={comparisonResult.stats} />
        {changedLines.length > 0 && (
          <DiffNavigation
            currentChange={currentChangeIndex}
            totalChanges={changedLines.length}
            onPrevious={handlePreviousChange}
            onNext={handleNextChange}
          />
        )}
      </div>

      {/* Diff content */}
      <ScrollArea className="flex-1">
        <div className="min-w-max">
          {comparisonResult.lines.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p>Les versions sont identiques</p>
            </div>
          ) : (
            comparisonResult.lines.map((line, index) => (
              <DiffLineComponent key={index} line={line} viewMode="unified" />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Legend */}
      <div className="flex items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30" />
          <span>Ajouté</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30" />
          <span>Supprimé</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/30" />
          <span>Modifié</span>
        </div>
      </div>
    </div>
  );
}

export default VersionDiffViewer;
