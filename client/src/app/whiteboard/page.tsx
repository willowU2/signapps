import { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { AppLayout } from '@/components/layout/app-layout';

export const metadata: Metadata = {
    title: 'Tableau blanc — SignApps',
    description: 'Tableau blanc collaboratif en temps réel',
};

// DW2: Client wrapper to avoid SSR issues with canvas / WebSocket
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

export default function WhiteboardPage() {
    return (
        <AppLayout>
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden glass-panel rounded-2xl shadow-premium border border-border/50">
                <WhiteboardClientWrapper />
            </div>
        </AppLayout>
    );
}
