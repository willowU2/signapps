"use client"

// IDEA-045: Multi-day event display — events spanning multiple days show as bars across days

import { useMemo } from "react"
import { isSameDay, startOfDay, endOfDay, areIntervalsOverlapping, differenceInDays, isWithinInterval } from "date-fns"
import { Event } from "@/types/calendar"
import { cn } from "@/lib/utils"

interface MultiDayEventBar {
    event: Event
    weekDays: Date[]
    startIdx: number
    span: number
    row: number
}

function isMultiDay(event: Event): boolean {
    const start = new Date(event.start_time)
    const end = new Date(event.end_time)
    return !isSameDay(start, end) || event.is_all_day
}

function computeBars(events: Event[], weekDays: Date[]): MultiDayEventBar[] {
    const multiDay = events.filter(isMultiDay)
    const rows: MultiDayEventBar[] = []
    const rowSlots: Array<Array<boolean>> = []

    for (const event of multiDay) {
        const evStart = startOfDay(new Date(event.start_time))
        const evEnd = endOfDay(new Date(event.end_time))

        // Find first weekDay index that overlaps
        let startIdx = 0
        for (let i = 0; i < weekDays.length; i++) {
            const day = weekDays[i]
            if (isWithinInterval(day, { start: evStart, end: evEnd }) ||
                isSameDay(day, evStart)) {
                startIdx = i
                break
            }
        }

        // Calculate span (how many weekDays the event covers)
        let span = 0
        for (let i = startIdx; i < weekDays.length; i++) {
            if (areIntervalsOverlapping(
                { start: evStart, end: evEnd },
                { start: startOfDay(weekDays[i]), end: endOfDay(weekDays[i]) }
            )) {
                span++
            } else {
                break
            }
        }
        if (span === 0) continue

        // Find a row with space
        let row = 0
        while (true) {
            if (!rowSlots[row]) rowSlots[row] = new Array(7).fill(false)
            let fits = true
            for (let i = startIdx; i < startIdx + span; i++) {
                if (rowSlots[row][i]) { fits = false; break }
            }
            if (fits) {
                for (let i = startIdx; i < startIdx + span; i++) rowSlots[row][i] = true
                break
            }
            row++
        }

        rows.push({ event, weekDays, startIdx, span, row })
    }

    return rows
}

const EVENT_COLORS = [
    "bg-blue-500 text-white",
    "bg-green-500 text-white",
    "bg-purple-500 text-white",
    "bg-amber-500 text-white",
    "bg-rose-500 text-white",
    "bg-cyan-500 text-white",
]

interface MultiDayEventBarsProps {
    events: Event[]
    weekDays: Date[]
    onEventClick: (eventId: string) => void
    selectedEventId?: string | null
    maxRows?: number
}

export function MultiDayEventBars({
    events,
    weekDays,
    onEventClick,
    selectedEventId,
    maxRows = 3,
}: MultiDayEventBarsProps) {
    const bars = useMemo(() => computeBars(events, weekDays), [events, weekDays])

    const visibleBars = bars.filter((b) => b.row < maxRows)
    const totalCols = weekDays.length

    // Height: each row is 22px
    const ROW_HEIGHT = 22
    const totalHeight = maxRows * ROW_HEIGHT

    return (
        <div className="relative w-full" style={{ height: totalHeight }}>
            {visibleBars.map((bar) => {
                const colorClass = EVENT_COLORS[bar.event.id.charCodeAt(0) % EVENT_COLORS.length]
                const isSelected = selectedEventId === bar.event.id
                const leftPct = (bar.startIdx / totalCols) * 100
                const widthPct = (bar.span / totalCols) * 100

                return (
                    <div
                        key={`${bar.event.id}-${bar.row}`}
                        className={cn(
                            "absolute flex items-center px-1.5 text-[11px] font-medium rounded-sm cursor-pointer truncate transition-all",
                            colorClass,
                            isSelected && "ring-2 ring-white ring-offset-1 opacity-100",
                            !isSelected && "opacity-90 hover:opacity-100"
                        )}
                        style={{
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                            top: bar.row * ROW_HEIGHT,
                            height: ROW_HEIGHT - 2,
                        }}
                        onClick={(e) => { e.stopPropagation(); onEventClick(bar.event.id) }}
                        title={bar.event.title}
                    >
                        {bar.startIdx === 0 || bar.span === totalCols ? bar.event.title : bar.event.title}
                    </div>
                )
            })}
        </div>
    )
}

export { computeBars, isMultiDay }
