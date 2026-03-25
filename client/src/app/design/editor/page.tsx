"use client"

import dynamic from "next/dynamic"
import { EditorLayout } from "@/components/layout/editor-layout"
import { Palette } from "lucide-react"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useDesignStore } from "@/stores/design-store"

const DesignEditor = dynamic(
    () => import("@/components/design/design-editor"),
    { ssr: false }
)

function DesignEditorContent() {
    const searchParams = useSearchParams()
    const id = searchParams.get('id') || ''
    const { currentDesign, loadDesign } = useDesignStore()
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (id && (!currentDesign || currentDesign.id !== id)) {
            loadDesign(id)
        }
        // Small delay to ensure store hydration
        const timer = setTimeout(() => setLoading(false), 100)
        return () => clearTimeout(timer)
    }, [id, loadDesign, currentDesign])

    const designName = currentDesign?.name || 'Design sans titre'

    return (
        <EditorLayout
            documentId={id}
            documentName={designName}
            icon={<Palette className="w-5 h-5 text-violet-600" />}
        >
            <div className="flex flex-col h-full relative">
                {loading && (
                    <div className="absolute inset-0 z-50 bg-background/80 dark:bg-black/80 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
                    </div>
                )}
                <div className="flex-1 overflow-hidden relative">
                    {!loading && <DesignEditor />}
                </div>
            </div>
        </EditorLayout>
    )
}

export default function DesignEditorPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
            </div>
        }>
            <DesignEditorContent />
        </Suspense>
    )
}
