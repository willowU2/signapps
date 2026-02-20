"use client"

import { AppLayout } from "@/components/layout/app-layout"
import { Spreadsheet } from "@/components/sheets/spreadsheet"

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
