"use client"

import dynamic from "next/dynamic"
import { EditorLayout } from "@/components/layout/editor-layout"
import { Presentation, ArrowLeft } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"

function EditorSkeleton() {
    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-2 border-b">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-8 rounded" />
                ))}
                <Skeleton className="h-8 w-24 rounded ml-2" />
            </div>
            <div className="flex-1 flex items-center justify-center p-8">
                <Skeleton className="w-full max-w-3xl aspect-video rounded-lg" />
            </div>
        </div>
    );
}

const SlidesContent = dynamic(
    () => import("@/components/slides/slides-content").then(m => ({ default: m.SlidesContent })),
    { ssr: false }
)

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { usePageTitle } from "@/hooks/use-page-title"
import { fetchAndParseDocument } from "@/lib/file-parsers"
import { toast } from "sonner"

function SlidesEditorContent() {
    const searchParams = useSearchParams()
    const id = searchParams.get('id') || 'new-presentation'
    const name = searchParams.get('name') || ''
    usePageTitle(name || 'Présentation sans titre')

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
                <div className="px-4 pt-3 pb-1 border-b bg-background/50 shrink-0">
                    <Link href="/slides" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-4 w-4" /> Présentations
                    </Link>
                </div>
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
        <Suspense fallback={<EditorSkeleton />}>
            <SlidesEditorContent />
        </Suspense>
    )
}
