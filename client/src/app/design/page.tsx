import { Metadata } from 'next';
import DesignDashboard from '@/components/design/design-dashboard';
import { AppLayout } from '@/components/layout/app-layout';

export const metadata: Metadata = {
    title: 'Design — SignApps',
    description: 'Design tool - Create stunning visuals',
};

export default function DesignPage() {
    return (
        <AppLayout>
            <div className="flex-1 flex flex-col h-[calc(100vh-8rem)] overflow-hidden glass-panel rounded-2xl shadow-premium border border-border/50">
                <DesignDashboard />
            </div>
        </AppLayout>
    );
}
