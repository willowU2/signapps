import { Metadata } from 'next';
import SheetsDashboard from '@/components/sheets/dashboard';
import { AppLayout } from '@/components/layout/app-layout';

export const metadata: Metadata = {
    title: 'Classeurs — SignApps',
    description: 'Feuilles de calcul collaboratives',
};

export default function SheetsPage() {
    return (
        <AppLayout>
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden glass-panel rounded-2xl shadow-premium border border-border/50">
                <SheetsDashboard />
            </div>
        </AppLayout>
    );
}
