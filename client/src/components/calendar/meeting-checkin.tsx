'use client'

/**
 * MR3 — Meeting check-in
 *
 * 15 min before each meeting: notification banner for attendance confirmation.
 * Attendees can mark themselves Present / En retard / Absent.
 * Status is stored in event metadata via calendarApi and displayed in the event detail.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Bell,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  Loader2,
  CalendarCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { calendarApi } from '@/lib/api'
import type { Event } from '@/types/calendar'

// ─── Types ────────────────────────────────────────────────────────────────────

type AttendanceStatus = 'pending' | 'present' | 'late' | 'absent'

interface AttendeeStatus {
  id: string
  name: string
  email: string
  status: AttendanceStatus
}

interface CheckinEvent {
  event: Event
  attendees: AttendeeStatus[]
  myStatus: AttendanceStatus
  updating: boolean
  minutesUntilStart: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; color: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: 'En attente', color: 'text-muted-foreground', variant: 'outline' },
  present: { label: 'Présent', color: 'text-green-600', variant: 'default' },
  late: { label: 'En retard', color: 'text-yellow-600', variant: 'secondary' },
  absent: { label: 'Absent', color: 'text-destructive', variant: 'destructive' },
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function minutesUntil(isoTime: string): number {
  return Math.round((new Date(isoTime).getTime() - Date.now()) / 60000)
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MeetingCheckin() {
  const [checkins, setCheckins] = useState<CheckinEvent[]>([])
  const [loading, setLoading] = useState(true)

  const loadUpcoming = useCallback(async () => {
    try {
      const cals = await calendarApi.listCalendars()
      const allCals: any[] = cals.data ?? []
      if (!allCals.length) return

      const now = new Date()
      // Events starting in the next 15 min, or already started (< 5min ago)
      const windowStart = new Date(now.getTime() - 5 * 60 * 1000)
      const windowEnd = new Date(now.getTime() + 15 * 60 * 1000)

      const eventArrays = await Promise.all(
        allCals.map((cal) =>
          calendarApi.listEvents(cal.id, windowStart, windowEnd).then((r) => r.data ?? [])
        )
      )
      const events: Event[] = eventArrays.flat() as Event[]

      const enriched: CheckinEvent[] = await Promise.all(
        events.map(async (event) => {
          type AttendeeRaw = { user_id?: string; email?: string; rsvp_status?: string; id?: string; display_name?: string; name?: string }
          let attendeesRaw: AttendeeRaw[] = []
          try {
            const res = await calendarApi.listAttendees(event.id)
            attendeesRaw = (res.data as AttendeeRaw[]) ?? []
          } catch {}

          const meta: Record<string, AttendanceStatus> =
            (event.metadata?.checkin as Record<string, AttendanceStatus> | undefined) ?? {}

          const attendees: AttendeeStatus[] = attendeesRaw.map((a) => ({
            id: a.id ?? a.user_id ?? a.email,
            name: a.display_name ?? a.name ?? a.email ?? 'Inconnu',
            email: a.email ?? '',
            status: meta[a.id ?? a.user_id ?? a.email] ?? 'pending',
          }))

          return {
            event,
            attendees,
            myStatus: 'pending' as AttendanceStatus,
            updating: false,
            minutesUntilStart: minutesUntil(event.start_time),
          }
        })
      )

      setCheckins(enriched)
    } catch {
      toast.error('Impossible de charger les check-ins')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUpcoming()
    const interval = setInterval(loadUpcoming, 60 * 1000)
    return () => clearInterval(interval)
  }, [loadUpcoming])

  const handleMyStatus = async (eventId: string, status: AttendanceStatus) => {
    setCheckins((prev) =>
      prev.map((c) => (c.event.id === eventId ? { ...c, updating: true } : c))
    )
    try {
      const checkin = checkins.find((c) => c.event.id === eventId)
      if (!checkin) return

      const currentMeta = checkin.event.metadata ?? {}
      const currentCheckin = (currentMeta.checkin as Record<string, unknown> | undefined) ?? {}

      await calendarApi.put(`/events/${eventId}`, {
        metadata: {
          ...currentMeta,
          checkin: {
            ...currentCheckin,
            me: status,
          },
        },
      })

      setCheckins((prev) =>
        prev.map((c) =>
          c.event.id === eventId
            ? { ...c, myStatus: status, updating: false }
            : c
        )
      )
      toast.success(`Statut mis à jour: ${STATUS_CONFIG[status].label}`)
    } catch {
      toast.error('Échec de la mise à jour')
      setCheckins((prev) =>
        prev.map((c) => (c.event.id === eventId ? { ...c, updating: false } : c))
      )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!checkins.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
          <CalendarCheck className="w-10 h-10" />
          <p>Aucune réunion imminente</p>
          <p className="text-xs">Le check-in apparaît 15 min avant le début</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {checkins.map((c) => {
        const mins = c.minutesUntilStart
        const isNow = mins <= 0
        return (
          <Card
            key={c.event.id}
            className={`border-l-4 ${isNow ? 'border-l-green-500' : 'border-l-yellow-400'}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <Bell
                  className={`w-5 h-5 mt-0.5 shrink-0 ${isNow ? 'text-green-600 animate-bounce' : 'text-yellow-500'}`}
                />
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">{c.event.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {isNow
                      ? 'Réunion en cours'
                      : `Commence dans ${mins} minute${mins > 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* My attendance buttons */}
              <div>
                <p className="text-sm font-medium mb-2">Confirmez votre présence</p>
                <div className="flex gap-2 flex-wrap">
                  {(['present', 'late', 'absent'] as AttendanceStatus[]).map((s) => {
                    const cfg = STATUS_CONFIG[s]
                    const isActive = c.myStatus === s
                    return (
                      <Button
                        key={s}
                        size="sm"
                        variant={isActive ? cfg.variant : 'outline'}
                        disabled={c.updating}
                        onClick={() => handleMyStatus(c.event.id, s)}
                        className={isActive ? '' : cfg.color}
                      >
                        {s === 'present' && <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                        {s === 'late' && <Clock className="w-3.5 h-3.5 mr-1" />}
                        {s === 'absent' && <XCircle className="w-3.5 h-3.5 mr-1" />}
                        {cfg.label}
                      </Button>
                    )
                  })}
                  {c.updating && <Loader2 className="w-4 h-4 animate-spin self-center" />}
                </div>
              </div>

              {/* Attendee status list */}
              {c.attendees.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    Participants ({c.attendees.length})
                  </p>
                  <div className="space-y-2">
                    {c.attendees.map((att) => {
                      const cfg = STATUS_CONFIG[att.status]
                      return (
                        <div key={att.id} className="flex items-center gap-2">
                          <Avatar className="w-7 h-7">
                            <AvatarFallback className="text-xs">{initials(att.name)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm flex-1 truncate">{att.name}</span>
                          <Badge variant={cfg.variant} className="text-xs">
                            {cfg.label}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
