'use client';

import { useState } from 'react';
import {
    Eye,
    EyeOff,
    CheckCircle2,
    XCircle,
    ToggleLeft,
    ToggleRight,
    ChevronDown,
    User,
    Clock,
    PanelRightOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { TrackChange } from '@/components/docs/extensions/track-changes';

interface TrackChangesToolbarProps {
    enabled: boolean;
    showChanges: boolean;
    pendingChanges: TrackChange[];
    onToggleEnabled: () => void;
    onToggleShowChanges: () => void;
    onAcceptAll: () => void;
    onRejectAll: () => void;
    onAcceptChange: (changeId: string) => void;
    onRejectChange: (changeId: string) => void;
    onToggleSidebar?: () => void;
    className?: string;
}

export function TrackChangesToolbar({
    enabled,
    showChanges,
    pendingChanges,
    onToggleEnabled,
    onToggleShowChanges,
    onAcceptAll,
    onRejectAll,
    onAcceptChange,
    onRejectChange,
    onToggleSidebar,
    className,
}: TrackChangesToolbarProps) {
    const [isOpen, setIsOpen] = useState(false);

    const insertions = pendingChanges.filter((c) => c.type === 'insertion');
    const deletions = pendingChanges.filter((c) => c.type === 'deletion');

    return (
        <TooltipProvider>
            <div className={cn('flex items-center gap-1', className)}>
                {/* Toggle Track Changes */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={enabled ? 'default' : 'outline'}
                            size="sm"
                            onClick={onToggleEnabled}
                            className={cn(
                                'gap-1.5',
                                enabled && 'bg-orange-500 hover:bg-orange-600 text-white'
                            )}
                        >
                            {enabled ? (
                                <ToggleRight className="h-4 w-4" />
                            ) : (
                                <ToggleLeft className="h-4 w-4" />
                            )}
                            <span className="hidden sm:inline">
                                {enabled ? 'Suivi actif' : 'Suivi inactif'}
                            </span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{enabled ? 'Désactiver le suivi des modifications' : 'Activer le suivi des modifications'}</p>
                    </TooltipContent>
                </Tooltip>

                {/* Toggle Show/Hide Changes */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onToggleShowChanges}
                            className="gap-1"
                        >
                            {showChanges ? (
                                <Eye className="h-4 w-4" />
                            ) : (
                                <EyeOff className="h-4 w-4" />
                            )}
                            <span className="hidden md:inline">
                                {showChanges ? 'Masquer' : 'Afficher'}
                            </span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{showChanges ? 'Masquer les modifications' : 'Afficher les modifications'}</p>
                    </TooltipContent>
                </Tooltip>

                {/* Open Sidebar Button */}
                {onToggleSidebar && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onToggleSidebar}
                                className="gap-1"
                            >
                                <PanelRightOpen className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Ouvrir le panneau des modifications</p>
                        </TooltipContent>
                    </Tooltip>
                )}

                {/* Changes Count & Actions Dropdown */}
                {pendingChanges.length > 0 && (
                    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5">
                                <span className="flex items-center gap-1">
                                    <span className="text-green-600 dark:text-green-400">
                                        +{insertions.length}
                                    </span>
                                    <span className="text-red-600 dark:text-red-400">
                                        -{deletions.length}
                                    </span>
                                </span>
                                <ChevronDown className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-72">
                            <div className="px-2 py-1.5">
                                <p className="text-sm font-medium">
                                    {pendingChanges.length} modification{pendingChanges.length > 1 ? 's' : ''} en attente
                                </p>
                            </div>
                            <DropdownMenuSeparator />

                            {/* Recent Changes Preview */}
                            <div className="max-h-48 overflow-y-auto">
                                {pendingChanges.slice(0, 5).map((change) => (
                                    <div
                                        key={change.id}
                                        className="px-2 py-2 hover:bg-accent rounded-sm"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <User className="h-3 w-3" />
                                                <span>{change.author}</span>
                                                <Clock className="h-3 w-3 ml-1" />
                                                <span>
                                                    {new Date(change.timestamp).toLocaleTimeString([], {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    onClick={() => onAcceptChange(change.id)}
                                                >
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => onRejectChange(change.id)}
                                                >
                                                    <XCircle className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <p
                                            className={cn(
                                                'text-sm mt-1 truncate',
                                                change.type === 'insertion' &&
                                                    'text-green-700 dark:text-green-400',
                                                change.type === 'deletion' &&
                                                    'text-red-700 dark:text-red-400 line-through'
                                            )}
                                        >
                                            {change.type === 'insertion'
                                                ? change.newContent
                                                : change.originalContent}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {pendingChanges.length > 5 && (
                                <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
                                    +{pendingChanges.length - 5} autres modifications
                                </div>
                            )}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                                onClick={onAcceptAll}
                                className="text-green-600 focus:text-green-600"
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Accepter toutes les modifications
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={onRejectAll}
                                className="text-red-600 focus:text-red-600"
                            >
                                <XCircle className="h-4 w-4 mr-2" />
                                Rejeter toutes les modifications
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </TooltipProvider>
    );
}

export default TrackChangesToolbar;
