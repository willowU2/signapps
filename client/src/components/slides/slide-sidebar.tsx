"use client"

import { cn } from "@/lib/utils"

export function SlideSidebar() {
    // Mock slides
    return (
        <div className="flex flex-col gap-4 p-4">
            {[1, 2, 3].map((i) => (
                <div key={i} className={cn(
                    "aspect-video bg-white border rounded shadow-sm hover:ring-2 ring-primary cursor-pointer flex items-center justify-center text-xs text-muted-foreground relative",
                    i === 1 && "ring-2 ring-blue-500"
                )}>
                    {/* Slide Thumbnail Placeholder */}
                    Slide {i}
                    <div className="absolute left-2 bottom-1 text-[10px] text-gray-400">{i}</div>
                </div>
            ))}
        </div>
    )
}
