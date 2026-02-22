"use client"

import { use } from "react"
import dynamic from "next/dynamic"
import { EditorLayoutWrapper } from '@/components/docs/editor-layout-wrapper';

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
        <EditorLayoutWrapper documentId={id}>
            <Editor documentId={id} className="h-full" />
        </EditorLayoutWrapper>
    );
}
