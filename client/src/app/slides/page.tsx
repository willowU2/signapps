"use client"

import dynamic from "next/dynamic"
import { AppLayout } from "@/components/layout/app-layout"

const SlidesContent = dynamic(
    () => import("@/components/slides/slides-content").then(m => ({ default: m.SlidesContent })),
    { ssr: false }
)

export default function SlidesPage() {
    return (
        <AppLayout>
            <SlidesContent />
        </AppLayout>
    )
}
