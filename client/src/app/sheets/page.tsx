"use client"

import dynamic from "next/dynamic"
import { EditorLayout } from "@/components/layout/editor-layout"
import { Table } from "lucide-react"

const Spreadsheet = dynamic(
    () => import("@/components/sheets/spreadsheet").then(m => ({ default: m.Spreadsheet })),
    { ssr: false }
)

export default function SheetsPage() {
    return (
        <EditorLayout documentId="new-spreadsheet" icon={<Table className="w-5 h-5 text-green-600" />}>
            <div className="flex flex-col h-full">
                <div className="flex-1 overflow-hidden relative">
                    <Spreadsheet />
                </div>
            </div>
        </EditorLayout>
    )
}
