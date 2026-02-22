"use client"

import dynamic from "next/dynamic"
import { AppLayout } from "@/components/layout/app-layout"

const Spreadsheet = dynamic(
    () => import("@/components/sheets/spreadsheet").then(m => ({ default: m.Spreadsheet })),
    { ssr: false }
)

export default function SheetsPage() {
    return (
        <AppLayout>
            <div className="flex flex-col h-[calc(100vh-4rem)]">
                <div className="flex-1 overflow-hidden relative">
                    <Spreadsheet />
                </div>
            </div>
        </AppLayout>
    )
}
