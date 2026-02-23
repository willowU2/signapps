"use client"

import { use } from "react"
import dynamic from "next/dynamic"
import { EditorLayout } from '@/components/layout/editor-layout';
import { FileText } from 'lucide-react';

const Editor = dynamic(
    () => import('@/components/docs/editor'),
    { ssr: false }
)

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function EditorPage({ params }: PageProps) {
    const { id } = use(params);

    return (
        <EditorLayout documentId={id} icon={<FileText className="w-5 h-5 text-blue-600" />}>
            <Editor documentId={id} className="h-full" />
        </EditorLayout>
    );
}
