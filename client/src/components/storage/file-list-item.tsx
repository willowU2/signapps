'use client';

import {
    FileText,
    Image as ImageIcon,
    File,
    FileArchive,
    FileCode,
    MoreVertical,
    Folder
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { FileItem, DriveView } from './types';

interface FileListItemProps {
    item: FileItem;
    selected?: boolean;
    onSelect?: () => void;
    onNavigate?: () => void;
    onPreview?: () => void;
    onAction?: (action: string, item: FileItem) => void;
    viewMode?: DriveView;
}

export function FileListItem({
    item,
    selected,
    onSelect,
    onNavigate,
    onPreview,
    onAction,
    viewMode
}: FileListItemProps) {

    const getIcon = () => {
        if (item.type === 'folder') return <Folder className="h-5 w-5 text-blue-500" />;

        // Simple extension check
        const ext = item.name.split('.').pop()?.toLowerCase();

        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
            return <ImageIcon className="h-5 w-5 text-purple-500" />;
        }
        if (['pdf'].includes(ext || '')) {
            return <FileText className="h-5 w-5 text-red-500" />;
        }
        if (['zip', 'rar', 'tar', 'gz'].includes(ext || '')) {
            return <FileArchive className="h-5 w-5 text-yellow-500" />;
        }
        if (['js', 'ts', 'tsx', 'jsx', 'bg', 'py', 'rs'].includes(ext || '')) {
            return <FileCode className="h-5 w-5 text-blue-400" />;
        }

        return <File className="h-5 w-5 text-gray-400" />;
    };

    const formatSize = (bytes?: number) => {
        if (bytes === undefined) return '-';
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div
            className={cn(
                "group flex items-center gap-4 p-2 rounded-lg transition-colors hover:bg-muted/50 cursor-pointer border border-transparent",
                selected && "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
            )}
            onClick={onSelect}
            onDoubleClick={() => {
                if (item.type === 'folder') {
                    onNavigate?.();
                } else {
                    onPreview?.();
                }
            }}
        >
            {/* Icon */}
            <div className="shrink-0">
                {getIcon()}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
                <span className="font-medium text-sm truncate block">
                    {item.name}
                </span>
            </div>

            {/* Date */}
            <div className="w-32 hidden sm:block text-xs text-muted-foreground">
                {item.lastModified ? new Date(item.lastModified).toLocaleDateString() : '-'}
            </div>

            {/* Size */}
            <div className="w-20 hidden sm:block text-xs text-muted-foreground text-right">
                {item.type === 'folder' ? '-' : formatSize(item.size)}
            </div>

            {/* Actions */}
            <div className="shrink-0 ml-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                        >
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {viewMode === 'trash' ? (
                            <>
                                <DropdownMenuItem onClick={() => onAction?.('restore', item)}>
                                    Restore
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => onAction?.('delete-forever', item)}
                                >
                                    Delete Forever
                                </DropdownMenuItem>
                            </>
                        ) : (
                            <>
                                <DropdownMenuItem onClick={() => onAction?.('open', item)}>
                                    Open
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onAction?.('preview', item)}>
                                    Preview
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onAction?.('download', item)}>
                                    Download
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onAction?.('rename', item)}>
                                    Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onAction?.('move', item)}>
                                    Move to...
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onAction?.('permissions', item)}>
                                    Permissions
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onAction?.('manage-tags', item)}>
                                    Manage Tags
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onAction?.('version-history', item)}>
                                    Version History
                                </DropdownMenuItem>
                                {viewMode === 'starred' ? (
                                    <DropdownMenuItem onClick={() => onAction?.('unstar', item)}>
                                        Remove from Starred
                                    </DropdownMenuItem>
                                ) : (
                                    <DropdownMenuItem onClick={() => onAction?.('star', item)}>
                                        Add to Starred
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => onAction?.('share', item)}>
                                    Share
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => onAction?.('delete', item)}
                                >
                                    Delete
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
