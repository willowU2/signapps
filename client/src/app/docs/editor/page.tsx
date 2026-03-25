"use client"

import { Suspense } from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { EditorLayout } from '@/components/layout/editor-layout';
import { FileText } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { EntityLinks } from '@/components/crosslinks/EntityLinks';

const Editor = dynamic(
    () => import('@/components/docs/editor'),
    { ssr: false }
)

function EditorContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get('id') || 'new';
    const name = searchParams.get('name') || '';
    const { user } = useAuthStore();
    const userName = user ? user.display_name || user.username || user.email : undefined;

    return (
        <EditorLayout documentId={id} documentName={name || 'Sans titre'} icon={<FileText className="w-5 h-5 text-blue-600" />}>
            <Editor documentId={id} documentName={name || undefined} className="h-full" bucket={name ? 'drive' : undefined} fileName={name || undefined} userName={userName} />
            {id !== 'new' && (
                <div className="border-t p-4 bg-background/50">
                    <EntityLinks entityType="document" entityId={id} />
                </div>
            )}
        </EditorLayout>
    );
}

export default function EditorPage() {
    return (
        <Suspense fallback={<div>Loading Editor...</div>}>
            <EditorContent />
        </Suspense>
    );
}
