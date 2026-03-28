'use client';

import { useMemo } from 'react';
import { Plus, Minus, Equal, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useVersionsStore } from '@/stores/versions-store';
import type { VersionDiff as VersionDiffType, DiffLine } from '@/lib/office/versions/types';

// ============================================================================
// Types
// ============================================================================

export interface VersionDiffProps {
  /** Pre-computed diff to display (if not using store) */
  diff?: VersionDiffType;
  /** Callback to go back to version list */
  onBack?: () => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function VersionDiff({ diff: externalDiff, onBack, className }: VersionDiffProps) {
  const storeDiff = useVersionsStore((s) => s.comparisonResult);
  const isComparing = useVersionsStore((s) => s.isComparing);
  const clearComparison = useVersionsStore((s) => s.clearComparison);

  const diff = externalDiff || storeDiff;

  if (isComparing) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!diff) {
    return (
      <div className={cn('flex items-center justify-center h-full text-muted-foreground', className)}>
        <p className="text-sm">Selectionnez deux versions pour comparer</p>
      </div>
    );
  }

  const handleBack = () => {
    clearComparison();
    onBack?.();
  };

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground font-medium">
              v{diff.sourceVersionNumber}
            </span>
            <span className="text-muted-foreground/40">&rarr;</span>
            <span className="font-medium">v{diff.targetVersionNumber}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {diff.stats.linesAdded > 0 && (
            <Badge
              variant="secondary"
              className="bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 gap-1 text-xs"
            >
              <Plus className="h-3 w-3" />
              {diff.stats.linesAdded}
            </Badge>
          )}
          {diff.stats.linesRetiré > 0 && (
            <Badge
              variant="secondary"
              className="bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 gap-1 text-xs"
            >
              <Minus className="h-3 w-3" />
              {diff.stats.linesRetiré}
            </Badge>
          )}
          {diff.stats.linesModified > 0 && (
            <Badge
              variant="secondary"
              className="bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 gap-1 text-xs"
            >
              ~{diff.stats.linesModified}
            </Badge>
          )}
          {diff.stats.linesAdded === 0 &&
            diff.stats.linesRetiré === 0 &&
            diff.stats.linesModified === 0 && (
              <Badge variant="secondary" className="gap-1 text-xs text-muted-foreground">
                <Equal className="h-3 w-3" />
                Identiques
              </Badge>
            )}
        </div>
      </div>

      {/* Word/char stats */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-b text-[10px] text-muted-foreground bg-muted/10">
        <span>+{diff.stats.wordsAdded} / -{diff.stats.wordsRetiré} mots</span>
        <span>+{diff.stats.charsAdded} / -{diff.stats.charsRetiré} caracteres</span>
      </div>

      {/* Diff table */}
      <ScrollArea className="flex-1">
        <table className="w-full border-collapse font-mono text-xs">
          <tbody>
            {diff.lines.map((line, idx) => (
              <DiffRow key={idx} line={line} />
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// DiffRow sub-component
// ============================================================================

interface DiffRowProps {
  line: DiffLine;
}

function DiffRow({ line }: DiffRowProps) {
  const isAdd = line.type === 'added';
  const isRemove = line.type === 'removed';
  const isModified = line.type === 'modified';

  return (
    <tr
      className={cn(
        'leading-5',
        isAdd && 'bg-green-50 dark:bg-green-950/40',
        isRemove && 'bg-red-50 dark:bg-red-950/40',
        isModified && 'bg-amber-50 dark:bg-amber-950/40'
      )}
    >
      {/* Source line number */}
      <td
        className={cn(
          'select-none w-10 px-2 text-right text-muted-foreground/50 border-r border-border/40',
          isAdd && 'text-transparent'
        )}
      >
        {line.sourceLineNumber ?? ''}
      </td>

      {/* Target line number */}
      <td
        className={cn(
          'select-none w-10 px-2 text-right text-muted-foreground/50 border-r border-border/40',
          isRemove && 'text-transparent'
        )}
      >
        {line.targetLineNumber ?? ''}
      </td>

      {/* Change marker */}
      <td
        className={cn(
          'select-none w-6 text-center border-r border-border/40',
          isAdd && 'text-green-600 dark:text-green-400',
          isRemove && 'text-red-600 dark:text-red-400',
          isModified && 'text-amber-600 dark:text-amber-400',
          !isAdd && !isRemove && !isModified && 'text-muted-foreground/30'
        )}
      >
        {isAdd ? '+' : isRemove ? '-' : isModified ? '~' : ' '}
      </td>

      {/* Content */}
      <td
        className={cn(
          'px-3 py-0 whitespace-pre-wrap break-all',
          isAdd && 'text-green-800 dark:text-green-300',
          isRemove && 'text-red-800 dark:text-red-300',
          isModified && 'text-amber-800 dark:text-amber-300',
          !isAdd && !isRemove && !isModified && 'text-muted-foreground'
        )}
      >
        {line.inlineChanges
          ? renderInlineChanges(line.content, line.inlineChanges)
          : line.content || '\u00A0'}
      </td>
    </tr>
  );
}

// ============================================================================
// Inline change rendering
// ============================================================================

function renderInlineChanges(
  content: string,
  changes: DiffLine['inlineChanges']
): React.ReactNode {
  if (!changes || changes.length === 0) {
    return content || '\u00A0';
  }

  const parts: React.ReactNode[] = [];
  let lastEnd = 0;

  for (const change of changes) {
    // Text before the change
    if (change.start > lastEnd) {
      parts.push(content.slice(lastEnd, change.start));
    }

    // The changed text
    parts.push(
      <span
        key={`${change.start}-${change.end}`}
        className={cn(
          'px-0.5 rounded-sm',
          change.type === 'added' && 'bg-green-200 dark:bg-green-800',
          change.type === 'removed' && 'bg-red-200 dark:bg-red-800 line-through'
        )}
      >
        {change.text}
      </span>
    );

    lastEnd = change.end;
  }

  // Remaining text
  if (lastEnd < content.length) {
    parts.push(content.slice(lastEnd));
  }

  return <>{parts}</>;
}

export default VersionDiff;
