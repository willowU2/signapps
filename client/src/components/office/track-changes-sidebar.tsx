'use client';

/**
 * TrackChangesSidebar
 *
 * Enhanced track changes panel with filtering, grouping, and accept/reject actions.
 */

import React, { useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  GitCommit,
  Check,
  X,
  CheckCheck,
  XCircle,
  Plus,
  Minus,
  Type,
  Filter,
  User,
  Clock,
  ChevronDown,
  ChevronRight,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================================
// Types
// ============================================================================

export type ChangeType = 'insertion' | 'deletion' | 'format' | 'replacement';

export interface TrackChange {
  id: string;
  type: ChangeType;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
  // Content
  originalText?: string;
  newText?: string;
  formatChange?: string; // e.g., "Bold", "Italic", "Heading 1"
  // Position in document
  position: { from: number; to: number };
  // Status
  status: 'pending' | 'accepted' | 'rejected';
}

type FilterType = 'all' | 'insertion' | 'deletion' | 'format';
type FilterStatus = 'all' | 'pending' | 'accepted' | 'rejected';
type GroupBy = 'none' | 'author' | 'type' | 'date';

interface TrackChangesSidebarProps {
  changes: TrackChange[];
  currentUserId: string;
  onAccept: (changeId: string) => void;
  onReject: (changeId: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onChangeClick?: (change: TrackChange) => void;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getChangeIcon(type: ChangeType) {
  switch (type) {
    case 'insertion':
      return <Plus className="h-3.5 w-3.5 text-green-600" />;
    case 'deletion':
      return <Minus className="h-3.5 w-3.5 text-red-600" />;
    case 'format':
      return <Type className="h-3.5 w-3.5 text-blue-600" />;
    case 'replacement':
      return <GitCommit className="h-3.5 w-3.5 text-amber-600" />;
  }
}

function getChangeLabel(type: ChangeType): string {
  switch (type) {
    case 'insertion':
      return 'Insertion';
    case 'deletion':
      return 'Suppression';
    case 'format':
      return 'Formatage';
    case 'replacement':
      return 'Remplacement';
  }
}

function getChangeColor(type: ChangeType): string {
  switch (type) {
    case 'insertion':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'deletion':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'format':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'replacement':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
  }
}

function groupChangesByKey(
  changes: TrackChange[],
  groupBy: GroupBy
): Map<string, TrackChange[]> {
  const groups = new Map<string, TrackChange[]>();

  if (groupBy === 'none') {
    groups.set('all', changes);
    return groups;
  }

  for (const change of changes) {
    let key: string;

    switch (groupBy) {
      case 'author':
        key = change.authorName;
        break;
      case 'type':
        key = getChangeLabel(change.type);
        break;
      case 'date':
        key = new Date(change.createdAt).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        break;
      default:
        key = 'all';
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(change);
  }

  return groups;
}

// ============================================================================
// Change Item Component
// ============================================================================

interface ChangeItemProps {
  change: TrackChange;
  onAccept: () => void;
  onReject: () => void;
  onClick?: () => void;
}

function ChangeItem({ change, onAccept, onReject, onClick }: ChangeItemProps) {
  const isPending = change.status === 'pending';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className={cn(
        'group rounded-lg border p-3 transition-all cursor-pointer',
        isPending
          ? 'bg-card hover:border-primary/50'
          : change.status === 'accepted'
            ? 'bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-900/30'
            : 'bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-900/30'
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">{getChangeIcon(change.type)}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className={cn('text-xs', getChangeColor(change.type))}>
              {getChangeLabel(change.type)}
            </Badge>
            {change.formatChange && (
              <Badge variant="outline" className="text-xs">
                {change.formatChange}
              </Badge>
            )}
            {!isPending && (
              <Badge
                variant="secondary"
                className={cn(
                  'text-xs ml-auto',
                  change.status === 'accepted'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                )}
              >
                {change.status === 'accepted' ? (
                  <>
                    <CheckCheck className="mr-1 h-3 w-3" />
                    Accepté
                  </>
                ) : (
                  <>
                    <XCircle className="mr-1 h-3 w-3" />
                    Rejeté
                  </>
                )}
              </Badge>
            )}
          </div>

          {/* Author and time */}
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            <Avatar className="h-4 w-4">
              <AvatarImage src={change.authorAvatar} />
              <AvatarFallback className="text-[8px]">
                {change.authorName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span>{change.authorName}</span>
            <span>·</span>
            <span>
              {formatDistanceToNow(new Date(change.createdAt), {
                addSuffix: true,
                locale: fr,
              })}
            </span>
          </div>

          {/* Content preview */}
          <div className="mt-2 text-sm">
            {change.type === 'deletion' && change.originalText && (
              <div className="flex items-start gap-1">
                <Minus className="h-3.5 w-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                <span className="line-through text-red-600/80 break-words">
                  {change.originalText.length > 100
                    ? `${change.originalText.slice(0, 100)}...`
                    : change.originalText}
                </span>
              </div>
            )}
            {change.type === 'insertion' && change.newText && (
              <div className="flex items-start gap-1">
                <Plus className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-green-600/80 break-words">
                  {change.newText.length > 100
                    ? `${change.newText.slice(0, 100)}...`
                    : change.newText}
                </span>
              </div>
            )}
            {change.type === 'replacement' && (
              <div className="space-y-1">
                {change.originalText && (
                  <div className="flex items-start gap-1">
                    <Minus className="h-3.5 w-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                    <span className="line-through text-red-600/80 break-words">
                      {change.originalText.length > 50
                        ? `${change.originalText.slice(0, 50)}...`
                        : change.originalText}
                    </span>
                  </div>
                )}
                {change.newText && (
                  <div className="flex items-start gap-1">
                    <Plus className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-green-600/80 break-words">
                      {change.newText.length > 50
                        ? `${change.newText.slice(0, 50)}...`
                        : change.newText}
                    </span>
                  </div>
                )}
              </div>
            )}
            {change.type === 'format' && change.formatChange && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Type className="h-3.5 w-3.5" />
                <span>Appliqué : {change.formatChange}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {isPending && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAccept();
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Accepter</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReject();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rejeter</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Group Header Component
// ============================================================================

interface GroupHeaderProps {
  title: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function GroupHeader({ title, count, isExpanded, onToggle }: GroupHeaderProps) {
  return (
    <button
      className="flex items-center gap-2 w-full py-2 px-1 text-sm font-medium hover:bg-muted/50 rounded transition-colors"
      onClick={onToggle}
    >
      {isExpanded ? (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
      <span>{title}</span>
      <Badge variant="secondary" className="ml-auto">
        {count}
      </Badge>
    </button>
  );
}

// ============================================================================
// Main Sidebar Component
// ============================================================================

export function TrackChangesSidebar({
  changes,
  currentUserId,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
  onChangeClick,
  className,
}: TrackChangesSidebarProps) {
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['all']));

  // Filter changes
  const filteredChanges = useMemo(() => {
    let result = [...changes];

    // Filter by type
    if (filterType !== 'all') {
      result = result.filter((c) => c.type === filterType);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter((c) => c.status === filterStatus);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.authorName.toLowerCase().includes(query) ||
          c.originalText?.toLowerCase().includes(query) ||
          c.newText?.toLowerCase().includes(query)
      );
    }

    // Sort by position in document
    result.sort((a, b) => a.position.from - b.position.from);

    return result;
  }, [changes, filterType, filterStatus, searchQuery]);

  // Group changes
  const groupedChanges = useMemo(
    () => groupChangesByKey(filteredChanges, groupBy),
    [filteredChanges, groupBy]
  );

  // Stats
  const pendingCount = changes.filter((c) => c.status === 'pending').length;
  const insertionCount = changes.filter((c) => c.type === 'insertion').length;
  const deletionCount = changes.filter((c) => c.type === 'deletion').length;

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <GitCommit className="h-5 w-5" />
          <h2 className="font-semibold">Suivi des modifications</h2>
          {pendingCount > 0 && (
            <Badge variant="default" className="bg-amber-500">
              {pendingCount}
            </Badge>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 border-b px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Plus className="h-3 w-3 text-green-600" />
          <span>{insertionCount} insertions</span>
        </div>
        <div className="flex items-center gap-1">
          <Minus className="h-3 w-3 text-red-600" />
          <span>{deletionCount} suppressions</span>
        </div>
      </div>

      {/* Bulk Actions */}
      {pendingCount > 0 && (
        <div className="flex gap-2 border-b p-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={onAcceptAll}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Tout accepter
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={onRejectAll}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Tout rejeter
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3 border-b p-3">
        <Input
          placeholder="Rechercher..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8"
        />

        <div className="flex gap-2">
          <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
            <SelectTrigger className="h-8 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="insertion">Insertions</SelectItem>
              <SelectItem value="deletion">Suppressions</SelectItem>
              <SelectItem value="format">Formatage</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
            <SelectTrigger className="h-8 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous ({changes.length})</SelectItem>
              <SelectItem value="pending">En attente ({pendingCount})</SelectItem>
              <SelectItem value="accepted">
                Acceptés ({changes.filter((c) => c.status === 'accepted').length})
              </SelectItem>
              <SelectItem value="rejected">
                Rejetés ({changes.filter((c) => c.status === 'rejected').length})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Grouper par..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sans groupement</SelectItem>
            <SelectItem value="author">Par auteur</SelectItem>
            <SelectItem value="type">Par type</SelectItem>
            <SelectItem value="date">Par date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Changes List */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          <AnimatePresence mode="popLayout">
            {filteredChanges.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <GitCommit className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">Aucune modification</p>
              </div>
            ) : groupBy === 'none' ? (
              <div className="space-y-2">
                {filteredChanges.map((change) => (
                  <ChangeItem
                    key={change.id}
                    change={change}
                    onAccept={() => onAccept(change.id)}
                    onReject={() => onReject(change.id)}
                    onClick={() => onChangeClick?.(change)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {Array.from(groupedChanges.entries()).map(([groupKey, groupChanges]) => (
                  <div key={groupKey}>
                    <GroupHeader
                      title={groupKey}
                      count={groupChanges.length}
                      isExpanded={expandedGroups.has(groupKey)}
                      onToggle={() => toggleGroup(groupKey)}
                    />
                    <AnimatePresence>
                      {expandedGroups.has(groupKey) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-2 pl-6 pb-2"
                        >
                          {groupChanges.map((change) => (
                            <ChangeItem
                              key={change.id}
                              change={change}
                              onAccept={() => onAccept(change.id)}
                              onReject={() => onReject(change.id)}
                              onClick={() => onChangeClick?.(change)}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}

export default TrackChangesSidebar;
