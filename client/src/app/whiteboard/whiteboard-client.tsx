'use client';

import dynamic from 'next/dynamic';
import { AppLayout } from '@/components/layout/app-layout';

const WhiteboardClientWrapper = dynamic(
    () => import('@/components/whiteboard/whiteboard-page').then(m => ({ default: m.WhiteboardPage })),
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
        ),
    }
);

export default function WhiteboardClient() {
    return (
        <AppLayout>
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden glass-panel rounded-2xl shadow-premium border border-border/50">
                <WhiteboardClientWrapper />
            </div>
        </AppLayout>
    );
}
