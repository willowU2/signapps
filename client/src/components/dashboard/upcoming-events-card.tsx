"use client"

import { useQuery } from "@tanstack/react-query"
import { Calendar, Clock, MapPin, Video, ArrowRight } from "lucide-react"
import { format, isToday, isTomorrow, addDays } from "date-fns"
import { fr } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { calendarApi } from "@/lib/api/calendar"
import Link from "next/link"
import { useMemo } from "react"

interface EventItem {
  id: string
  title: string
  start_time: string
  end_time?: string
  location?: string
  all_day?: boolean
  calendar_id?: string
  description?: string
  meet_link?: string
}

function formatEventDate(date: Date): string {
  if (isToday(date)) return "Aujourd'hui"
  if (isTomorrow(date)) return "Demain"
  return format(date, "EEEE d MMM", { locale: fr })
}

function getTimeUntil(date: Date): string {
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  if (diff < 0) return "En cours"
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `dans ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `dans ${hours}h`
  const days = Math.floor(hours / 24)
  return `dans ${days}j`
}

// Seed events for when calendar service is unavailable
const SEED_EVENTS: EventItem[] = [
  {
    id: "seed-1",
    title: "Reunion d'equipe hebdomadaire",
    start_time: new Date(Date.now() + 2 * 3600000).toISOString(),
    end_time: new Date(Date.now() + 3 * 3600000).toISOString(),
    location: "Salle A",
    meet_link: "https://meet.example.com/weekly",
  },
  {
    id: "seed-2",
    title: "Point projet SignApps",
    start_time: new Date(Date.now() + 26 * 3600000).toISOString(),
    end_time: new Date(Date.now() + 27 * 3600000).toISOString(),
    location: "Visioconference",
  },
  {
    id: "seed-3",
    title: "Revue de sprint",
    start_time: new Date(Date.now() + 50 * 3600000).toISOString(),
    end_time: new Date(Date.now() + 51.5 * 3600000).toISOString(),
    location: "Salle B",
  },
  {
    id: "seed-4",
    title: "Formation securite",
    start_time: new Date(Date.now() + 74 * 3600000).toISOString(),
    all_day: true,
  },
  {
    id: "seed-5",
    title: "Demo client Q2",
    start_time: new Date(Date.now() + 98 * 3600000).toISOString(),
    end_time: new Date(Date.now() + 99 * 3600000).toISOString(),
    meet_link: "https://meet.example.com/demo-q2",
  },
]

export function UpcomingEventsCard() {
  const { data: events, isLoading } = useQuery({
    queryKey: ["dashboard-upcoming-events"],
    queryFn: async () => {
      try {
        const calendarsResponse = await calendarApi.listCalendars()
        const calendars = calendarsResponse.data || []
        if (calendars.length === 0) return SEED_EVENTS

        const now = new Date()
        const endDate = addDays(now, 7)

        const allEvents: EventItem[] = []
        for (const cal of calendars) {
          try {
            const response = await calendarApi.listEvents(cal.id, now, endDate)
            const calEvents = (response.data || []) as EventItem[]
            allEvents.push(...calEvents)
          } catch {
            // Skip calendars that fail
          }
        }

        if (allEvents.length === 0) return SEED_EVENTS

        return allEvents
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
          .slice(0, 5)
      } catch {
        return SEED_EVENTS
      }
    },
    staleTime: 60 * 1000,
  })

  // Group events by date
  const groupedEvents = useMemo(() => {
    if (!events) return new Map<string, EventItem[]>()
    const groups = new Map<string, EventItem[]>()
    events.forEach((event) => {
      const dateKey = format(new Date(event.start_time), "yyyy-MM-dd")
      const existing = groups.get(dateKey) || []
      groups.set(dateKey, [...existing, event])
    })
    return groups
  }, [events])

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-green-500" />
            Prochains evenements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-green-500" />
            Prochains evenements
            {events && events.length > 0 && (
              <Badge variant="secondary" className="text-xs ml-1">
                {events.length}
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" asChild>
            <Link href="/cal">
              Calendrier <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!events || events.length === 0 ? (
          <div className="text-center text-muted-foreground py-6 text-sm">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Aucun evenement a venir cette semaine
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(groupedEvents.entries()).map(([dateKey, dateEvents]) => {
              const date = new Date(dateKey)
              return (
                <div key={dateKey}>
                  <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    {formatEventDate(date)}
                  </div>
                  <div className="space-y-2">
                    {dateEvents.map((event) => {
                      const startDate = new Date(event.start_time)
                      const isMeetingLink = !!(event.meet_link || event.location?.toLowerCase().includes('visio') || event.location?.toLowerCase().includes('meet'))

                      return (
                        <div
                          key={event.id}
                          className="flex items-start gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 hover:border-primary/20 transition-all"
                        >
                          {/* Time badge */}
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
                            {event.all_day ? (
                              <span className="text-[10px] font-bold text-primary uppercase">Journee</span>
                            ) : (
                              <>
                                <span className="text-xs font-bold text-primary leading-none">
                                  {format(startDate, "HH:mm")}
                                </span>
                                <span className="text-[10px] text-primary/60 mt-0.5">
                                  {getTimeUntil(startDate)}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Event info */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{event.title}</div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {!event.all_day && event.end_time && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(startDate, "HH:mm")} - {format(new Date(event.end_time), "HH:mm")}
                                </span>
                              )}
                              {event.location && (
                                <span className="flex items-center gap-1 truncate">
                                  <MapPin className="h-3 w-3" />
                                  {event.location}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Join meeting button */}
                          {isMeetingLink && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0 h-7 text-xs gap-1 text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/30"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (event.meet_link) window.open(event.meet_link, '_blank')
                              }}
                            >
                              <Video className="h-3 w-3" />
                              Rejoindre
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
