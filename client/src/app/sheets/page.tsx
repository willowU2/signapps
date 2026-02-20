"use client"

import { AppLayout } from "@/components/layout/app-layout"
import { Spreadsheet } from "@/components/sheets/spreadsheet"

export default function SheetsPage() {
    return (
        <AppLayout>
            <div className="flex flex-col h-[calc(100vh-4rem)]">
                <div className="flex items-center justify-between px-4 py-2 border-b">
                    <div>
                        <h1 className="text-lg font-semibold">Untitled Spreadsheet</h1>
                        <div className="text-xs text-muted-foreground">File • Edit • View • Insert • Format • Data • Tools • Extensions • Help</div>
                    </div>
                    {/* Share Button placeholder */}
                    <div className="flex items-center gap-2">
                        <button className="bg-green-600 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-green-700">Share</button>
                    </div>
                </div>
                <div className="flex-1 overflow-hidden relative">
                    <Spreadsheet />
                </div>
            </div>
        </AppLayout>
    )
}
