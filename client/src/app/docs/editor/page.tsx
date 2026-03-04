"use client"

import { Suspense } from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { EditorLayout } from '@/components/layout/editor-layout';
import { FileText } from 'lucide-react';

const Editor = dynamic(
    () => import('@/components/docs/editor'),
    { ssr: false }
)

function EditorContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get('id') || 'new';

    return (
        <EditorLayout documentId={id} icon={<FileText className="w-5 h-5 text-blue-600" />}>
            <Editor documentId={id} className="h-full" />
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
