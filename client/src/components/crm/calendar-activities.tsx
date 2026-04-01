"use client"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Calendar, Check, RefreshCw } from "lucide-react"
import { calendarApi } from "@/lib/api/calendar"
import { activitiesApi, dealsApi, type Deal } from "@/lib/api/crm"
import { useEffect } from "react"
import { format, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "sonner"

interface Props {
  dealId?: string
}

export function CalendarActivities({ dealId }: Props) {
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set())
  const [dealLinks, setDealLinks] = useState<Record<string, string>>({})
  const [deals, setDeals] = useState<Deal[]>([])
  useEffect(() => { dealsApi.list().then(setDeals) }, [])

  const { data: calendars = [], isLoading: calendarsLoading } = useQuery({
    queryKey: ["crm-calendars"],
    queryFn: () => calendarApi.listCalendars().then(r => r.data ?? []),
    staleTime: 120000,
  })

  const { data: events = [], isLoading: eventsLoading, refetch } = useQuery({
    queryKey: ["crm-events", calendars.map((c: any) => c.id)],
    queryFn: async () => {
      const now = new Date()
      const end = new Date(now.getTime() + 30 * 86400000)
      const all: any[] = []
      // Fetch from up to 3 calendars
      for (const cal of calendars.slice(0, 3)) {
        try {
          const r = await calendarApi.listEvents(cal.id, now, end)
          const evs = r.data ?? []
          evs.forEach((e: any) => { e._calendarName = cal.name })
          all.push(...evs)
        } catch {
          // ignore calendar errors
        }
      }
      return all.sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )
    },
    enabled: calendars.length > 0,
    staleTime: 60000,
  })

  const logEvent = (event: any) => {
    const targetDealId = dealId ?? dealLinks[event.id]
    activitiesApi.create({
      dealId: targetDealId,
      type: "meeting",
      content: [event.title, event.description].filter(Boolean).join("\n"),
      date: event.start_time,
      calendarEventId: event.id,
    })
    setLoggedIds(s => new Set(s).add(event.id))
    toast.success(`Réunion "${event.title}" enregistrée comme activité.`)
  }

  const isLoading = calendarsLoading || eventsLoading

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Réunions à venir (30 jours)
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetch()}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>

      <CardContent className="space-y-2">
        {isLoading && (
          <p className="text-sm text-muted-foreground text-center py-4 animate-pulse">
            Chargement de l'agenda…
          </p>
        )}

        {!isLoading && calendars.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun agenda configuré. Ajoutez des agendas dans l'application Calendrier.
          </p>
        )}

        {!isLoading && calendars.length > 0 && events.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune réunion dans les 30 prochains jours.
          </p>
        )}

        {events.slice(0, 12).map((event: any) => (
          <div
            key={event.id}
            className="flex items-center justify-between gap-2 p-3 border rounded-md hover:bg-muted/30 transition-colors"
          >
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="text-sm font-medium truncate">{event.title}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{format(parseISO(event.start_time), "d MMM yyyy, HH:mm", { locale: fr })}</span>
                {event._calendarName && (
                  <Badge variant="outline" className="text-[10px] py-0">{event._calendarName}</Badge>
                )}
              </div>
            </div>

            {!dealId && (
              <Select
                value={dealLinks[event.id] ?? ""}
                onValueChange={v => setDealLinks(m => ({ ...m, [event.id]: v }))}
              >
                <SelectTrigger className="h-7 w-40 text-xs">
                  <SelectValue placeholder="Lier à un deal…" />
                </SelectTrigger>
                <SelectContent>
                  {deals.map((d: Deal) => (
                    <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {loggedIds.has(event.id) ? (
              <div className="flex items-center gap-1 text-emerald-600 text-xs shrink-0">
                <Check className="h-3.5 w-3.5" />
                <span>Enregistré</span>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs shrink-0"
                onClick={() => logEvent(event)}
                disabled={!dealId && !dealLinks[event.id]}
              >
                Enregistrer
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
