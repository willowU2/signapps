'use client';

import { useUIStore } from '@/lib/store';
import { Sidebar } from './sidebar';
import { GlobalHeader } from './global-header';
import { CommandBar } from './command-bar';
import { RightSidebar } from './right-sidebar';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

interface EditorLayoutProps {
    documentId: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
}

export function EditorLayout({ documentId, icon, children }: EditorLayoutProps) {
    const { sidebarCollapsed, rightSidebarOpen } = useUIStore();
    const pathname = usePathname();

    // Determine if we are in a fullscreen editor route
    const isFullscreenEditor = pathname.includes('/docs/editor') || 
                               pathname.includes('/sheets/editor') || 
                               pathname.includes('/slides/editor');

    return (
        <div className="min-h-screen bg-background overflow-hidden relative">
            <div
                className={cn(
                    'flex flex-col transition-all duration-300 h-screen',
                    sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60',
                    // Allocate space for the right sidebar: always 16 (icon bar) + 80 (panel if open)
                    rightSidebarOpen ? 'pr-[24rem]' : 'pr-16'
                )}
            >
                <GlobalHeader />
                {/* Ensure main area takes up remaining height without scrolling page body */}
                <main className="flex-1 overflow-hidden relative">
                    <div className="absolute inset-0">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
