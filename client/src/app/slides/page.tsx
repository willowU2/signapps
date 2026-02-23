"use client"

import dynamic from "next/dynamic"
import { EditorLayout } from "@/components/layout/editor-layout"
import { Presentation } from "lucide-react"

const SlidesContent = dynamic(
    () => import("@/components/slides/slides-content").then(m => ({ default: m.SlidesContent })),
    { ssr: false }
)

export default function SlidesPage() {
    return (
        <EditorLayout documentId="new-presentation" icon={<Presentation className="w-5 h-5 text-yellow-500" />}>
            <div className="h-full overflow-hidden">
                <SlidesContent />
            </div>
        </EditorLayout>
    )
}
