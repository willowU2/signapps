import { Metadata } from 'next';
import DocsDashboard from '@/components/docs/dashboard';
import { AppLayout } from '@/components/layout/app-layout';

export const metadata: Metadata = {
    description: 'Collaborative documents, sheets, slides, and boards',
};

export default function DocsPage() {
    return (
        <AppLayout>
            <div className="flex-1 flex flex-col h-[calc(100vh-8rem)] overflow-hidden glass-panel rounded-2xl shadow-premium border border-border/50">
                <DocsDashboard />
            </div>
        </AppLayout>
    );
}
