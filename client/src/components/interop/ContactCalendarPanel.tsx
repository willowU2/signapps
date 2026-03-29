"use client"
// Feature 5: Contact → show calendar events with this person
// Feature 10: CRM activity → auto-log from calendar events
// Feature 23: CRM → show calendar availability for meeting scheduling

import { useState, useEffect } from "react"
import { Calendar, Plus, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { activitiesApi } from "@/lib/api/crm"
import { toast } from "sonner"
import Link from "next/link"

interface CalendarEvent {
  id: string
  title: string
  start: string
  end?: string
  attendees?: string[]
  location?: string
  meetLink?: string
}

interface Props {
  contactId: string
  contactEmail?: string
  contactName: string
  dealId?: string
  showScheduleButton?: boolean
}

function loadCalendarEvents(email?: string): CalendarEvent[] {
  if (typeof window === "undefined" || !email) return []
  try {
    const all = JSON.parse(localStorage.getItem("calendar:events") ?? "[]") as CalendarEvent[]
    return all.filter(e =>
      e.attendees?.some(a => a.toLowerCase().includes(email.toLowerCase()))
    )
  } catch {
    return []
  }
}

export function ContactCalendarPanel({ contactId, contactEmail, contactName, dealId, showScheduleButton }: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>([])

  useEffect(() => {
    setEvents(loadCalendarEvents(contactEmail))
  }, [contactEmail])

  const handleLogActivity = (event: CalendarEvent) => {
    if (!dealId && !contactId) return
    activitiesApi.create({
      dealId,
      contactId,
      type: "meeting",
      content: `Réunion : ${event.title} — ${new Date(event.start).toLocaleDateString("fr-FR")}`,
      date: event.start,
      calendarEventId: event.id,
    })
    toast.success("Activité enregistrée dans le CRM.")
  }

  const scheduleMeetingUrl = contactEmail
    ? `/calendar?invite=${encodeURIComponent(contactEmail)}&name=${encodeURIComponent(contactName)}`
    : "/calendar"

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <Calendar className="h-3 w-3" /> Événements ({events.length})
        </p>
        {showScheduleButton && (
          <Button size="sm" variant="outline" asChild className="h-7 text-xs">
            <Link href={scheduleMeetingUrl}>
              <Plus className="h-3 w-3 mr-1" /> Planifier réunion
            </Link>
          </Button>
        )}
      </div>

      {events.length === 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground italic">Aucun événement avec ce contact.</p>
          {showScheduleButton && (
            <Button size="sm" variant="outline" asChild className="h-7 text-xs w-full">
              <Link href={scheduleMeetingUrl}>
                <Video className="h-3 w-3 mr-1" /> Planifier une réunion
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {events.slice(0, 5).map((ev: CalendarEvent) => (
            <div key={ev.id} className="flex items-start justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{ev.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(ev.start).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                  {ev.location && ` · ${ev.location}`}
                </p>
              </div>
              {dealId && (
                <Button size="sm" variant="ghost" className="h-6 text-xs px-2 flex-shrink-0" onClick={() => handleLogActivity(ev)}>
                  Log CRM
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
