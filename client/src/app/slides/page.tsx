"use client"

import { AppLayout } from "@/components/layout/app-layout"
import { SlideEditor } from "@/components/slides/slide-editor"
import { SlideSidebar } from "@/components/slides/slide-sidebar"

export default function SlidesPage() {
    return (
        <AppLayout>
            <div className="flex flex-col h-[calc(100vh-4rem)]">
                {/* Toolbar / Header */}
                <div className="flex items-center justify-between px-4 py-2 border-b">
                    <div>
                        <h1 className="text-lg font-semibold">Untitled Presentation</h1>
                        <div className="text-xs text-muted-foreground">File • Edit • View • Insert • Format • Slide • Arrange • Tools • Help</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="bg-yellow-600 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-yellow-700">Present</button>
                        <button className="bg-green-600 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-green-700">Share</button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar (Slides List) */}
                    <div className="w-48 border-r bg-muted/10 overflow-y-auto">
                        <SlideSidebar />
                    </div>

                    {/* Main Canvas Area */}
                    <div className="flex-1 bg-gray-100 flex items-center justify-center overflow-auto p-8">
                        <SlideEditor />
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}
