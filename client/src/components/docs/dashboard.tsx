'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface DocMeta {
    id: string;
    title: string;
    type: 'text' | 'sheet' | 'slide' | 'board';
    lastOpened: number;
}

export default function DocsDashboard() {
    const router = useRouter();

    useEffect(() => {
        const saved = localStorage.getItem('signapps_recent_docs');
        let mostRecentId = null;
        if (saved) {
            try {
                const docs: DocMeta[] = JSON.parse(saved);
                if (docs && docs.length > 0) {
                    docs.sort((a, b) => b.lastOpened - a.lastOpened);
                    mostRecentId = docs[0].id;
                }
            } catch (e) {
                console.error("Failed to parse recent docs", e);
            }
        }

        if (mostRecentId) {
            router.replace(`/docs/editor/${mostRecentId}`);
        } else {
            const id = crypto.randomUUID();
            const newDoc: DocMeta = {
                id,
                title: 'Untitled document',
                type: 'text',
                lastOpened: Date.now()
            };
            localStorage.setItem('signapps_recent_docs', JSON.stringify([newDoc]));
            router.replace(`/docs/editor/${id}`);
        }
    }, [router]);

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 h-full bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Opening Document Editor...</p>
        </div>
    );
}

