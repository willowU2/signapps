"use client"

import dynamic from "next/dynamic"
import { EditorLayout } from "@/components/layout/editor-layout"
import { Table, ArrowLeft } from "lucide-react"
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
            <div className="flex-1 p-4 space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full rounded" />
                ))}
            </div>
        </div>
    );
}

const Spreadsheet = dynamic(
    () => import("@/components/sheets/spreadsheet").then(m => ({ default: m.Spreadsheet })),
    { ssr: false }
)

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { usePageTitle } from "@/hooks/use-page-title"
import { fetchAndParseDocument } from "@/lib/file-parsers"
import type { SpreadsheetParseResult } from "@/lib/file-parsers"
import { toast } from "sonner"
import { trackDocVisit } from "@/components/ui/quick-switcher"

function SheetsContent() {
    const searchParams = useSearchParams()
    const id = searchParams.get('id') || 'new-spreadsheet'
    const name = searchParams.get('name') || ''
    usePageTitle(name || 'Classeur sans titre')

    // Track recent file visit
    useEffect(() => {
        if (id && id !== 'new-spreadsheet') {
            trackDocVisit({ id, name: name || 'Classeur sans titre', kind: 'sheet', href: `/sheets/editor?id=${id}&name=${encodeURIComponent(name)}` });
        }
    }, [id, name]);

    const [initialData, setInitialData] = useState<any>(undefined)
    const [initialColWidths, setInitialColWidths] = useState<Record<number, number> | undefined>(undefined)
    const [initialRowHeights, setInitialRowHeights] = useState<Record<number, number> | undefined>(undefined)
    const [loading, setLoading] = useState(id !== 'new-spreadsheet' && name !== '')

    useEffect(() => {
        // Check for template content first
        const templateKey = `sheet-template:${id}`
        const templateContent = typeof window !== 'undefined' ? localStorage.getItem(templateKey) : null
        if (templateContent) {
            try {
                const data = JSON.parse(templateContent)
                setInitialData(data)
                localStorage.removeItem(templateKey)
            } catch (e) {
                console.error('Failed to parse sheet template', e)
            }
            setLoading(false)
            return
        }

        if (id !== 'new-spreadsheet' && name) {
            const targetKey = `${id}.xlsx`
            fetchAndParseDocument('drive', targetKey, targetKey)
                .catch(() => fetchAndParseDocument('drive', name, name))
                .then(res => {
                    if (res && res.type === 'spreadsheet' && 'data' in res && res.data) {
                        const result = res as SpreadsheetParseResult
                        const sheetNames = Object.keys(result.data)
                        if (sheetNames.length > 0) {
                            const firstSheet = sheetNames[0]
                            setInitialData(result.data[firstSheet])
                            if (result.colWidths?.[firstSheet]) {
                                setInitialColWidths(result.colWidths[firstSheet])
                            }
                            if (result.rowHeights?.[firstSheet]) {
                                setInitialRowHeights(result.rowHeights[firstSheet])
                            }
                        }
                    }
                    setLoading(false)
                })
                .catch(err => {
                    console.error("Error loading spreadsheet", err)
                    toast.error("Erreur de chargement du fichier: " + err.message)
                    setLoading(false)
                })
        } else {
            setLoading(false)
        }
    }, [id, name])

    return (
        <EditorLayout documentId={id} documentName={name || 'Sans titre'} icon={<Table className="w-5 h-5 text-green-600" />}>
            <div className="flex flex-col h-full relative">
                <div className="px-4 pt-3 pb-1 border-b bg-background/50 shrink-0">
                    <Link href="/sheets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-4 w-4" /> Classeurs
                    </Link>
                </div>
                {loading && (
                    <div className="absolute inset-0 z-50 bg-background/80 dark:bg-black/80 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                    </div>
                )}
                <div className="flex-1 overflow-hidden relative">
                    {!loading && <Spreadsheet documentId={id} documentName={name || 'document.xlsx'} initialData={initialData} initialColWidths={initialColWidths} initialRowHeights={initialRowHeights} />}
                </div>
            </div>
        </EditorLayout>
    )
}

export default function SheetsPage() {
    return (
        <Suspense fallback={<EditorSkeleton />}>
            <SheetsContent />
        </Suspense>
    )
}
