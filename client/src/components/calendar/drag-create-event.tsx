"use client"

// IDEA-043: Click+drag to create event — mousedown+drag on calendar grid creates new event

import { useRef, useState, useCallback, useEffect } from "react"
import { format, addMinutes, startOfDay } from "date-fns"

export interface DragSelection {
    day: Date
    startMinutes: number
    endMinutes: number
}

interface DragCreateLayerProps {
    day: Date
    hourHeight?: number // px per hour, default 60
    onCreateEvent: (selection: DragSelection) => void
}

function minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    const date = new Date()
    date.setHours(h, m, 0, 0)
    return format(date, "HH:mm")
}

export function DragCreateLayer({ day, hourHeight = 60, onCreateEvent }: DragCreateLayerProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [dragging, setDragging] = useState(false)
    const [startY, setStartY] = useState(0)
    const [currentY, setCurrentY] = useState(0)
    const isDown = useRef(false)

    const yToMinutes = useCallback((y: number) => {
        const pxPerMinute = hourHeight / 60
        const raw = Math.round(y / pxPerMinute / 15) * 15 // snap to 15 min
        return Math.max(0, Math.min(1440, raw))
    }, [hourHeight])

    const getRect = () => containerRef.current?.getBoundingClientRect()

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return
        e.preventDefault()
        const rect = getRect()
        if (!rect) return
        const relY = e.clientY - rect.top
        isDown.current = true
        setStartY(relY)
        setCurrentY(relY)
        setDragging(false)
    }, [])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDown.current) return
        const rect = getRect()
        if (!rect) return
        const relY = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
        setCurrentY(relY)
        setDragging(true)
    }, [])

    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (!isDown.current) return
        isDown.current = false
        const rect = getRect()
        if (!rect || !dragging) { setDragging(false); return }
        const relY = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
        const startMin = yToMinutes(Math.min(startY, relY))
        const endMin = yToMinutes(Math.max(startY, relY))
        const duration = endMin - startMin
        if (duration >= 15) {
            onCreateEvent({ day, startMinutes: startMin, endMinutes: Math.max(startMin + 30, endMin) })
        }
        setDragging(false)
    }, [day, dragging, startY, yToMinutes, onCreateEvent])

    useEffect(() => {
        document.addEventListener("mousemove", handleMouseMove)
        document.addEventListener("mouseup", handleMouseUp)
        return () => {
            document.removeEventListener("mousemove", handleMouseMove)
            document.removeEventListener("mouseup", handleMouseUp)
        }
    }, [handleMouseMove, handleMouseUp])

    // Calculate selection box position
    const top = Math.min(startY, currentY)
    const height = Math.abs(currentY - startY)
    const startMin = yToMinutes(Math.min(startY, currentY))
    const endMin = yToMinutes(Math.max(startY, currentY))

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 z-20 cursor-crosshair select-none"
            onMouseDown={handleMouseDown}
        >
            {dragging && height > 8 && (
                <div
                    className="absolute left-0.5 right-0.5 bg-blue-400/30 border-2 border-blue-500 rounded pointer-events-none"
                    style={{ top, height }}
                >
                    <div className="absolute top-0.5 left-1 text-[10px] font-bold text-blue-700 bg-white/90 rounded px-1">
                        {minutesToTime(startMin)} – {minutesToTime(endMin)}
                    </div>
                </div>
            )}
        </div>
    )
}

// Hook that converts DragSelection to EventForm props
export function useDragCreate(onOpenForm: (startTime: Date, endTime: Date) => void) {
    const handleCreate = useCallback((selection: DragSelection) => {
        const base = startOfDay(selection.day)
        const startTime = addMinutes(base, selection.startMinutes)
        const endTime = addMinutes(base, selection.endMinutes)
        onOpenForm(startTime, endTime)
    }, [onOpenForm])

    return { handleCreate }
}
