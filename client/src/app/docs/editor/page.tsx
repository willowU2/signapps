"use client"

import { Suspense, useEffect } from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { EditorLayout } from '@/components/layout/editor-layout';
import { FileText, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { EntityLinks } from '@/components/crosslinks/EntityLinks';
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { usePageTitle } from "@/hooks/use-page-title";
import { trackDocVisit } from '@/components/ui/quick-switcher';
import { DocShareSocial } from '@/components/interop/DocShareSocial';
import { AiDocActions } from '@/components/interop/AiDocSummarize';
import { LinkedEntitiesPanel } from '@/components/interop/linked-entities-panel';
import { CrossModuleComments } from '@/components/interop/cross-module-comments';
import { SmartSuggestions } from '@/components/interop/smart-suggestions';
import { AiDocTranslate } from '@/components/interop/AiDocTranslate';
import { DocAutoSaveDrive, DocExportDrive } from '@/components/interop/DocAutoSaveDrive';
import { DocCollabIndicator } from '@/components/interop/DocCollabIndicator';

function EditorSkeleton() {
    return (
        <div className="flex flex-col h-full">
            {/* Toolbar skeleton */}
            <div className="flex items-center gap-2 px-4 py-2 border-b">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-8 rounded" />
                ))}
                <Skeleton className="h-8 w-24 rounded ml-2" />
            </div>
            {/* Content area skeleton */}
            <div className="flex-1 p-8 space-y-4">
                <Skeleton className="h-8 w-1/2 rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-5/6 rounded" />
                <Skeleton className="h-4 w-4/6 rounded" />
                <Skeleton className="h-4 w-full rounded mt-4" />
                <Skeleton className="h-4 w-3/4 rounded" />
            </div>
        </div>
    );
}

const Editor = dynamic(
    () => import('@/components/docs/editor'),
    { ssr: false }
)

function EditorContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get('id') || 'new';
    const name = searchParams.get('name') || '';
    usePageTitle(name || 'Document sans titre');
    const { user } = useAuthStore();
    const userName = user ? user.display_name || user.username || user.email : undefined;

    // Track recent file visit
    useEffect(() => {
        if (id && id !== 'new') {
            trackDocVisit({ id, name: name || 'Document sans titre', kind: 'text', href: `/docs/editor?id=${id}&name=${encodeURIComponent(name)}` });
        }
    }, [id, name]);

    const getDocText = () => {
        const el = document.querySelector('.ProseMirror') as HTMLElement | null;
        return el ? (el.innerText || el.textContent || '') : '';
    };

    return (
        <EditorLayout documentId={id} documentName={name || 'Sans titre'} icon={<FileText className="w-5 h-5 text-blue-600" />}>
            <div className="flex flex-col h-full">
                <div className="px-4 pt-3 pb-1 border-b bg-background/50 shrink-0 flex items-center justify-between gap-2 flex-wrap">
                    <Link href="/docs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-4 w-4" /> Documents
                    </Link>
                    {id !== 'new' && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <DocCollabIndicator docId={id} currentUserId={user?.id} />
                            <DocShareSocial docId={id} docName={name || 'Document'} />
                            <AiDocTranslate getText={getDocText} />
                            <DocAutoSaveDrive docId={id} docName={name || 'Document'} getContent={getDocText} />
                            <DocExportDrive docName={name || 'Document'} getContent={getDocText} />
                            <AiDocActions docTitle={name || 'Document'} getText={getDocText} />
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-hidden">
                    <Editor documentId={id} documentName={name || undefined} className="h-full" bucket={name ? 'drive' : undefined} fileName={name || undefined} userName={userName} />
                </div>
                {id !== 'new' && (
                    <div className="border-t p-4 bg-background/50 space-y-4">
                        <EntityLinks entityType="document" entityId={id} />
                        {/* Idea 28: Linked entities panel */}
                        <LinkedEntitiesPanel entityType="document" entityId={id} />
                        {/* Idea 29: Smart suggestions */}
                        <SmartSuggestions entityType="document" entityId={id} entityTitle={name || 'Document'} />
                        {/* Idea 43: Cross-module comments */}
                        <CrossModuleComments entityType="document" entityId={id} compact />
                    </div>
                )}
            </div>
        </EditorLayout>
    );
}

export default function EditorPage() {
    return (
        <Suspense fallback={<EditorSkeleton />}>
            <EditorContent />
        </Suspense>
    );
}
