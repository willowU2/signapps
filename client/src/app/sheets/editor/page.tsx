"use client"

import dynamic from "next/dynamic"
import { EditorLayout } from "@/components/layout/editor-layout"
import { Table } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

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
import { fetchAndParseDocument } from "@/lib/file-parsers"
import { toast } from "sonner"

function SheetsContent() {
    const searchParams = useSearchParams()
    const id = searchParams.get('id') || 'new-spreadsheet'
    const name = searchParams.get('name') || ''

    const [initialData, setInitialData] = useState<any>(undefined)
    const [loading, setLoading] = useState(id !== 'new-spreadsheet' && name !== '')

    useEffect(() => {
        if (id !== 'new-spreadsheet' && name) {
            const targetKey = `${id}.xlsx`
            fetchAndParseDocument('drive', targetKey, targetKey)
                .catch(() => fetchAndParseDocument('drive', name, name))
                .then(res => {
                    if (res && res.type === 'spreadsheet' && 'data' in res && res.data) {
                        const sheets = Object.keys(res.data)
                        if (sheets.length > 0) {
                            setInitialData(res.data[sheets[0]])
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
                {loading && (
                    <div className="absolute inset-0 z-50 bg-background/80 dark:bg-black/80 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                    </div>
                )}
                <div className="flex-1 overflow-hidden relative">
                    {!loading && <Spreadsheet documentId={id} documentName={name || 'document.xlsx'} initialData={initialData} />}
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
