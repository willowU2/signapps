"use client"

import dynamic from "next/dynamic"
import { EditorLayout } from "@/components/layout/editor-layout"
import { Presentation } from "lucide-react"

const SlidesContent = dynamic(
    () => import("@/components/slides/slides-content").then(m => ({ default: m.SlidesContent })),
    { ssr: false }
)

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { fetchAndParseDocument } from "@/lib/file-parsers"
import { toast } from "sonner"

function SlidesEditorContent() {
    const searchParams = useSearchParams()
    const id = searchParams.get('id') || 'new-presentation'
    const name = searchParams.get('name') || ''

    const [initialData, setInitialData] = useState<any>(undefined)
    const [loading, setLoading] = useState(id !== 'new-presentation' && name !== '')

    useEffect(() => {
        if (id !== 'new-presentation' && name) {
            const targetKey = `${id}.signslides`
            fetchAndParseDocument('drive', targetKey, targetKey)
                .catch(() => fetchAndParseDocument('drive', name, name))
                .then(res => {
                    // For raw json (like .signslides), our parser might return { type: 'json', data: {...} } or 'slides' depending on implementation
                    if (res && 'data' in res && res.data) {
                        // Pass along the parsed JSON data directly to SlidesContent
                        setInitialData(res.data)
                    }
                    setLoading(false)
                })
                .catch(err => {
                    console.error("Error loading presentation", err)
                    toast.error("Erreur de chargement du fichier: " + err.message)
                    setLoading(false)
                })
        } else {
            setLoading(false)
        }
    }, [id, name])

    return (
        <EditorLayout documentId={id} documentName={name || 'Sans titre'} icon={<Presentation className="w-5 h-5 text-yellow-600" />}>
            <div className="flex flex-col h-full relative">
                {loading && (
                    <div className="absolute inset-0 z-50 bg-background/80 dark:bg-black/80 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600"></div>
                    </div>
                )}
                <div className="flex-1 overflow-hidden relative">
                    {!loading && <SlidesContent documentId={id} documentName={name || 'presentation.signslides'} initialData={initialData} />}
                </div>
            </div>
        </EditorLayout>
    )
}

export default function SlidesEditorPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SlidesEditorContent />
        </Suspense>
    )
}
