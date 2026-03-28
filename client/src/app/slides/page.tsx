import { Metadata } from 'next';
import SlidesDashboard from '@/components/slides/dashboard';
import { AppLayout } from '@/components/layout/app-layout';

export const metadata: Metadata = {
    title: 'Présentations — SignApps',
    description: 'Présentations collaboratives',
};

export default function SlidesPage() {
    return (
        <AppLayout>
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden glass-panel rounded-2xl shadow-premium border border-border/50">
                <SlidesDashboard />
            </div>
        </AppLayout>
    );
}
