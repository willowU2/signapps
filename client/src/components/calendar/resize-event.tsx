"use client"

// IDEA-044: Resize event duration — drag bottom edge of event block to change end time

import { useRef, useCallback, useEffect } from "react"
import { addMinutes, differenceInMinutes, parseISO } from "date-fns"
import { GripHorizontal } from "lucide-react"
import { Event } from "@/types/calendar"

export interface ResizeResult {
    event: Event
    newEndTime: Date
}

interface ResizeHandleProps {
    event: Event
    hourHeight?: number // px per hour
    onResizeCommit: (result: ResizeResult) => void
    containerRef: React.RefObject<HTMLElement>
}

export function ResizeHandle({ event, hourHeight = 60, onResizeCommit, containerRef }: ResizeHandleProps) {
    const isResizing = useRef(false)
    const startY = useRef(0)
    const originalEnd = useRef(new Date(event.end_time))
    const previewRef = useRef<HTMLDivElement | null>(null)

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        isResizing.current = true
        startY.current = e.clientY
        originalEnd.current = new Date(event.end_time)
        document.body.style.cursor = "ns-resize"
        document.body.style.userSelect = "none"
    }, [event.end_time])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing.current) return
        const deltaY = e.clientY - startY.current
        const pxPerMin = hourHeight / 60
        const deltaMin = Math.round(deltaY / pxPerMin / 15) * 15 // snap 15 min
        const newEnd = addMinutes(originalEnd.current, deltaMin)
        const startTime = new Date(event.start_time)
        // Enforce minimum 15 min duration
        const minEnd = addMinutes(startTime, 15)
        const clampedEnd = newEnd < minEnd ? minEnd : newEnd

        // Visual feedback: update the parent block height via CSS variable
        if (containerRef.current) {
            const durationMin = differenceInMinutes(clampedEnd, startTime)
            const newHeight = (durationMin / 60) * hourHeight
            containerRef.current.style.height = `${Math.max(newHeight, hourHeight / 4)}px`
        }
    }, [event.start_time, hourHeight, containerRef])

    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (!isResizing.current) return
        isResizing.current = false
        document.body.style.cursor = ""
        document.body.style.userSelect = ""

        const deltaY = e.clientY - startY.current
        const pxPerMin = hourHeight / 60
        const deltaMin = Math.round(deltaY / pxPerMin / 15) * 15
        const newEnd = addMinutes(originalEnd.current, deltaMin)
        const startTime = new Date(event.start_time)
        const minEnd = addMinutes(startTime, 15)
        const clampedEnd = newEnd < minEnd ? minEnd : newEnd

        onResizeCommit({ event, newEndTime: clampedEnd })
    }, [event, hourHeight, onResizeCommit])

    useEffect(() => {
        document.addEventListener("mousemove", handleMouseMove)
        document.addEventListener("mouseup", handleMouseUp)
        return () => {
            document.removeEventListener("mousemove", handleMouseMove)
            document.removeEventListener("mouseup", handleMouseUp)
        }
    }, [handleMouseMove, handleMouseUp])

    return (
        <div
            className="absolute bottom-0 left-0 right-0 h-3 flex items-center justify-center cursor-ns-resize group/resize z-30 rounded-b"
            onMouseDown={handleMouseDown}
            title="Drag to resize"
        >
            <div className="w-8 h-1.5 rounded-full bg-white/50 group-hover/resize:bg-white/90 transition-colors">
                <GripHorizontal className="h-1.5 w-1.5 text-inherit opacity-0 group-hover/resize:opacity-60" />
            </div>
        </div>
    )
}

// Wrapper hook to use with useEvents
export function useEventResize(updateEvent: (id: string, data: { end_time: string }) => Promise<Event>) {
    const handleResizeCommit = useCallback(async ({ event, newEndTime }: ResizeResult) => {
        try {
            await updateEvent(event.id, { end_time: newEndTime.toISOString() })
        } catch {
            // Revert handled by parent re-render
        }
    }, [updateEvent])

    return { handleResizeCommit }
}
