'use client';

import {
    HardDrive
} from 'lucide-react';
// ... rest of the content will be re-generated in full
import {
    Users,
    Clock,
    Star,
    Trash2,
    Cloud,
    Plus,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

import { DriveView } from './types';

interface DriveSidebarProps {
    currentView: DriveView;
    onViewChange: (view: DriveView) => void;
    quota?: {
        used: number;
        total: number;
    };
    className?: string;
    onNewClick?: () => void;
}

export function DriveSidebar({
    currentView,
    onViewChange,
    quota,
    className,
    onNewClick
}: DriveSidebarProps) {
    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const usagePercent = quota && quota.total > 0 ? Math.min(100, Math.round((quota.used / quota.total) * 100)) : 0;

    return (
        <div className={cn("w-64 flex flex-col h-full bg-background border-r pr-4 py-4 gap-6", className)}>
            <div className="px-2">
                <Button
                    className="w-full justify-start gap-2 shadow-md hover:shadow-lg transition-all"
                    size="lg"
                    onClick={onNewClick}
                >
                    <Plus className="h-5 w-5" />
                    <span className="font-semibold">New</span>
                </Button>
            </div>

            <div className="flex-1 space-y-1">
                <nav className="space-y-1">
                    <SidebarItem
                        icon={HardDrive}
                        label="My Drive"
                        isActive={currentView === 'my-drive'}
                        onClick={() => onViewChange('my-drive')}
                    />
                    <SidebarItem
                        icon={Users}
                        label="Shared with me"
                        isActive={currentView === 'shared'}
                        onClick={() => onViewChange('shared')}
                    />
                    <SidebarItem
                        icon={Clock}
                        label="Recent"
                        isActive={currentView === 'recent'}
                        onClick={() => onViewChange('recent')}
                    />
                </nav>

                <Separator className="my-4 mx-2" />

                <nav className="space-y-1">
                    <SidebarItem
                        icon={Trash2}
                        label="Trash"
                        isActive={currentView === 'trash'}
                        onClick={() => onViewChange('trash')}
                    />
                </nav>
            </div>

            <div className="px-2 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Cloud className="h-4 w-4" />
                    <span>Storage</span>
                </div>
                {quota ? (
                    <div className="space-y-1">
                        <Progress value={usagePercent} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                            {formatSize(quota.used)} of {formatSize(quota.total)} used
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading usage...
                    </div>
                )}
                <Button variant="outline" size="sm" className="w-full mt-2 text-xs">
                    Get more storage
                </Button>
            </div>
        </div>
    );
}

interface SidebarItemProps {
    icon: React.ElementType;
    label: string;
    isActive?: boolean;
    onClick: () => void;
}

function SidebarItem({ icon: Icon, label, isActive, onClick }: SidebarItemProps) {
    return (
        <Button
            variant={isActive ? 'secondary' : 'ghost'}
            className={cn(
                "w-full justify-start gap-3 px-4 font-normal rounded-r-full mr-2",
                isActive && "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60"
            )}
            onClick={onClick}
        >
            <Icon className={cn("h-4 w-4", isActive ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground")} />
            {label}
        </Button>
    );
}
