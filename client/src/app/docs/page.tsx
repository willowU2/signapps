import { Metadata } from 'next';
import DocsDashboard from '@/components/docs/dashboard';

export const metadata: Metadata = {
    title: 'Google Docs Clone - SignApps',
    description: 'Collaborative documents, sheets, slides, and boards',
};

export default function DocsPage() {
    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-gray-950">
            <DocsDashboard />
        </div>
    );
}
