'use client';

import {
    HardDrive,
    Users,
    Clock,
    Star,
    Trash2,
    Cloud,
    Plus,
    Loader2,
    Home
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
        <div className={cn("w-[256px] flex flex-col h-full bg-background dark:bg-[#1a1a1a] pb-4 gap-2", className)}>
            <div className="px-4 py-3">
                <Button
                    className="w-auto h-14 px-4 rounded-2xl bg-background hover:bg-[#f8f9fa] shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] dark:bg-[#1a1a1a] dark:hover:bg-[#303134] dark:shadow-[0_1px_2px_0_rgba(0,0,0,0.6),0_1px_3px_1px_rgba(0,0,0,0.3)] transition-all flex items-center gap-3 text-[#3c4043] dark:text-[#e8eaed]"
                    onClick={onNewClick}
                >
                    <svg width="24" height="24" viewBox="0 0 36 36"><path fill="#34A853" d="M16 16v14h4V20z"/><path fill="#4285F4" d="M30 16H20l-4 4h14z"/><path fill="#FBBC05" d="M6 16v4h10l4-4z"/><path fill="#EA4335" d="M20 16V2h-4v14z"/><path fill="none" d="M0 0h36v36H0z"/></svg>
                    <span className="font-medium text-[14px]">Nouveau</span>
                </Button>
            </div>

            <div className="flex-1 space-y-0.5 overflow-y-auto w-full">
                <nav className="space-y-0.5">
                    <SidebarItem
                        icon={Home}
                        label="Accueil"
                        isActive={currentView === 'home'}
                        onClick={() => onViewChange('home')}
                    />
                    <SidebarItem
                        icon={HardDrive}
                        label="Mon Drive"
                        isActive={currentView === 'my-drive'}
                        onClick={() => onViewChange('my-drive')}
                    />
                    <SidebarItem
                        icon={Users}
                        label="Partagés avec moi"
                        isActive={currentView === 'shared'}
                        onClick={() => onViewChange('shared')}
                    />
                    <SidebarItem
                        icon={Clock}
                        label="Récents"
                        isActive={currentView === 'recent'}
                        onClick={() => onViewChange('recent')}
                    />
                    <SidebarItem
                        icon={Star}
                        label="Suivis"
                        isActive={currentView === 'starred'}
                        onClick={() => onViewChange('starred')}
                    />
                </nav>

                <div className="py-2">
                    <Separator className="mx-4 bg-[#dadce0] dark:bg-[#3c4043]" />
                </div>

                <nav className="space-y-0.5">
                    <SidebarItem
                        icon={Trash2}
                        label="Corbeille"
                        isActive={currentView === 'trash'}
                        onClick={() => onViewChange('trash')}
                    />
                </nav>
            </div>

            <div className="px-5 space-y-3 pt-4 border-t border-[#dadce0] dark:border-[#3c4043]">
                <div className="flex items-center gap-3 text-[14px] text-[#202124] dark:text-[#e8eaed]">
                    <Cloud className="h-5 w-5 text-[#5f6368] dark:text-[#9aa0a6]" />
                    <span>Espace de stockage</span>
                </div>
                {quota ? (
                    <div className="space-y-1">
                        <Progress value={usagePercent} className="h-1.5 bg-[#dadce0] dark:bg-[#3c4043] [&>div]:bg-[#1a73e8] dark:[&>div]:bg-[#8ab4f8]" />
                        <div className="text-[13px] text-[#5f6368] dark:text-[#9aa0a6] mt-2">
                            {formatSize(quota.used)} utilisés sur {formatSize(quota.total)}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Chargement...
                    </div>
                )}
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
        <button
            className={cn(
                "w-full flex items-center gap-4 px-5 py-[9px] text-[14px] font-medium transition-colors hover:bg-[#f1f3f4] dark:hover:bg-[#303134] rounded-r-full mr-4 relative",
                isActive ? "bg-[#c2e7ff] text-[#001d35] hover:bg-[#c2e7ff] dark:bg-[#004a77] dark:text-[#c2e7ff] dark:hover:bg-[#004a77]" : "text-[#444746] dark:text-[#e8eaed]"
            )}
            onClick={onClick}
        >
            <Icon className={cn(
                "h-[20px] w-[20px] shrink-0", 
                isActive ? "text-[#001d35] dark:text-[#c2e7ff]" : "text-[#444746] dark:text-[#e8eaed]"
            )} />
            <span className="truncate">{label}</span>
        </button>
    );
}
