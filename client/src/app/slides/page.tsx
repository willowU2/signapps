"use client"

import dynamic from "next/dynamic"
import { EditorLayout } from "@/components/layout/editor-layout"
import { Presentation } from "lucide-react"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { fetchAndParseDocument, SlidesFileFormat } from "@/lib/file-parsers"
import { toast } from "sonner"

const SlidesContent = dynamic(
    () => import("@/components/slides/slides-content").then(m => ({ default: m.SlidesContent })),
    { ssr: false }
)

function SlidesPageContent() {
    const searchParams = useSearchParams()
    const id = searchParams.get('id') || 'new-presentation'
    const name = searchParams.get('name') || ''

    const [initialData, setInitialData] = useState<SlidesFileFormat | undefined>(undefined)
    const [loading, setLoading] = useState(id !== 'new-presentation' && name !== '')

    useEffect(() => {
        if (id !== 'new-presentation' && name) {
            fetchAndParseDocument('drive', name, name)
                .then(res => {
                    if (res.type === 'slides' && 'data' in res && res.data) {
                        setInitialData(res.data as SlidesFileFormat)
                    }
                    setLoading(false)
                })
                .catch(err => {
                    console.error("Error loading slides", err)
                    toast.error("Erreur de chargement du fichier: " + err.message)
                    setLoading(false)
                })
        } else {
            setLoading(false)
        }
    }, [id, name])

    return (
        <EditorLayout
            documentId={id}
            documentName={name || 'Sans titre'}
            icon={<Presentation className="w-5 h-5 text-yellow-500" />}
        >
            <div className="h-full overflow-hidden relative">
                {loading && (
                    <div className="absolute inset-0 z-50 bg-white/80 dark:bg-black/80 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
                    </div>
                )}
                {!loading && (
                    <SlidesContent
                        documentId={id}
                        documentName={name}
                        initialData={initialData}
                    />
                )}
            </div>
        </EditorLayout>
    )
}

export default function SlidesPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div></div>}>
            <SlidesPageContent />
        </Suspense>
    )
}
