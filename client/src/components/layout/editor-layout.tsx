'use client';

import { GlobalHeader } from './global-header';
import { usePathname } from 'next/navigation';
import { WorkspaceShell } from './workspace-shell';

interface EditorLayoutProps {
    documentId: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
}

export function EditorLayout({ documentId, icon, children }: EditorLayoutProps) {
    const pathname = usePathname();

    // Determine if we are in a fullscreen editor route
    const isFullscreenEditor = pathname.includes('/docs/editor') || 
                               pathname.includes('/sheets/editor') || 
                               pathname.includes('/slides/editor');

    return (
        <WorkspaceShell
            className="bg-background relative"
            header={<GlobalHeader />}
        >
            <main className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0">
                    {children}
                </div>
            </main>
        </WorkspaceShell>
    );
}
