"use client"

// IDEA-048: Printable weekly agenda — print-friendly weekly view with event details

import { useCallback } from "react"
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Event } from "@/types/calendar"

interface PrintableAgendaProps {
    events: Event[]
    currentDate: Date
    calendarName?: string
}

function buildPrintHtml(events: Event[], weekStart: Date, weekEnd: Date, calendarName: string): string {
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

    const dayRows = weekDays.map((day) => {
        const dayEvents = events
            .filter((e) => isSameDay(new Date(e.start_time), day))
            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

        const eventsHtml = dayEvents.length === 0
            ? `<div style="color:#999;font-size:12px;font-style:italic;padding:4px 0;">No events</div>`
            : dayEvents.map((e) => {
                const start = new Date(e.start_time)
                const end = new Date(e.end_time)
                const timeStr = e.is_all_day ? "All day" : `${format(start, "HH:mm")} – ${format(end, "HH:mm")}`
                return `
                    <div style="border-left:3px solid #1a73e8;padding:4px 8px;margin:4px 0;background:#f8fbff;">
                        <div style="font-size:13px;font-weight:600;color:#1f1f1f;">${e.title}</div>
                        <div style="font-size:11px;color:#555;margin-top:1px;">${timeStr}</div>
                        ${e.location ? `<div style="font-size:11px;color:#777;margin-top:1px;">📍 ${e.location}</div>` : ""}
                        ${e.description ? `<div style="font-size:11px;color:#777;margin-top:2px;">${e.description}</div>` : ""}
                    </div>`
            }).join("")

        const isToday = isSameDay(day, new Date())
        return `
            <tr style="vertical-align:top;">
                <td style="width:120px;padding:8px 12px 8px 0;border-top:1px solid #e0e0e0;${isToday ? "background:#e8f4fd;" : ""}">
                    <div style="font-size:14px;font-weight:700;color:${isToday ? "#1a73e8" : "#3c4043"};">
                        ${format(day, "EEEE")}
                    </div>
                    <div style="font-size:24px;font-weight:300;color:${isToday ? "#1a73e8" : "#3c4043"};">
                        ${format(day, "d")}
                    </div>
                    <div style="font-size:11px;color:#999;">${format(day, "MMMM yyyy")}</div>
                </td>
                <td style="padding:8px 0 8px 12px;border-top:1px solid #e0e0e0;border-left:1px solid #e0e0e0;">${eventsHtml}</td>
            </tr>`
    }).join("")

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Weekly Agenda — ${format(weekStart, "MMM d")} to ${format(weekEnd, "MMM d, yyyy")}</title>
    <style>
        @media print {
            @page { margin: 1.5cm; size: A4 portrait; }
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
        body { font-family: Arial, sans-serif; color: #1f1f1f; background: #fff; margin: 0; padding: 20px; }
        h1 { font-size: 20px; font-weight: 300; color: #1a73e8; margin: 0 0 4px; }
        h2 { font-size: 13px; color: #5f6368; font-weight: 400; margin: 0 0 20px; }
        table { width: 100%; border-collapse: collapse; }
        .footer { margin-top: 24px; font-size: 10px; color: #999; border-top: 1px solid #e0e0e0; padding-top: 8px; }
    </style>
</head>
<body>
    <h1>${calendarName}</h1>
    <h2>Week of ${format(weekStart, "MMMM d")} – ${format(weekEnd, "MMMM d, yyyy")}</h2>
    <table>
        <tbody>${dayRows}</tbody>
    </table>
    <div class="footer">Generated on ${format(new Date(), "MMMM d, yyyy 'at' HH:mm")} — SignApps Calendar</div>
</body>
</html>`
}

export function PrintableAgendaButton({ events, currentDate, calendarName = "My Calendar" }: PrintableAgendaProps) {
    const handlePrint = useCallback(() => {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
        const html = buildPrintHtml(events, weekStart, weekEnd, calendarName)

        const win = window.open("", "_blank", "width=800,height=600")
        if (!win) { alert("Please allow popups to print."); return }
        win.document.write(html)
        win.document.close()
        win.onload = () => {
            win.focus()
            win.print()
        }
    }, [events, currentDate, calendarName])

    return (
        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            Print week
        </Button>
    )
}

// Standalone component for embedding in view
interface WeeklyAgendaViewProps {
    events: Event[]
    currentDate: Date
    calendarName?: string
}

export function WeeklyAgendaPrintPreview({ events, currentDate, calendarName = "My Calendar" }: WeeklyAgendaViewProps) {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

    return (
        <div className="space-y-0 print:block">
            <div className="hidden print:flex items-baseline gap-3 mb-4">
                <h1 className="text-2xl font-light text-blue-600">{calendarName}</h1>
                <p className="text-sm text-muted-foreground">
                    {format(weekStart, "MMMM d")} – {format(weekEnd, "MMMM d, yyyy")}
                </p>
            </div>

            {weekDays.map((day) => {
                const dayEvents = events
                    .filter((e) => isSameDay(new Date(e.start_time), day))
                    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                const isToday = isSameDay(day, new Date())

                return (
                    <div key={day.toISOString()} className={`flex border-t border-border/50 py-3 gap-4 ${isToday ? "bg-blue-50/30" : ""}`}>
                        <div className="w-20 shrink-0">
                            <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? "text-blue-600" : "text-muted-foreground"}`}>
                                {format(day, "EEE")}
                            </p>
                            <p className={`text-2xl font-light leading-tight ${isToday ? "text-blue-600" : "text-foreground"}`}>
                                {format(day, "d")}
                            </p>
                        </div>
                        <div className="flex-1 space-y-1.5 pt-1">
                            {dayEvents.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">No events</p>
                            ) : dayEvents.map((e) => (
                                <div key={e.id} className="flex gap-2 text-sm border-l-2 border-blue-500 pl-2">
                                    <div className="shrink-0 text-xs text-muted-foreground w-24">
                                        {e.is_all_day ? "All day" : `${format(new Date(e.start_time), "HH:mm")} – ${format(new Date(e.end_time), "HH:mm")}`}
                                    </div>
                                    <div>
                                        <p className="font-medium text-[13px]">{e.title}</p>
                                        {e.location && <p className="text-xs text-muted-foreground">{e.location}</p>}
                                        {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
