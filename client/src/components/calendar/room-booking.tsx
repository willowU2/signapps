'use client'

/**
 * MR1 — Room booking with floor plan
 *
 * Loads floor plans from calendarApi, renders rooms as clickable SVG areas,
 * shows availability (green/yellow/red), and creates a calendar event on booking.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar, Clock, Users, MapPin, Loader2, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { calendarApi } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FloorPlanArea {
  id: string
  x: number
  y: number
  width: number
  height: number
  label: string
}

interface FloorPlan {
  id: string
  name: string
  floor: string
  svg_viewbox?: string
  areas: FloorPlanArea[]
}

interface RoomEvent {
  id: string
  title: string
  start: string
  end: string
}

type RoomStatus = 'free' | 'booked' | 'partial'

interface RoomAvailability {
  room_id: string
  status: RoomStatus
  events: RoomEvent[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<RoomStatus, string> = {
  free: '#22c55e',
  booked: '#ef4444',
  partial: '#f59e0b',
}

const STATUS_LABEL: Record<RoomStatus, string> = {
  free: 'Disponible',
  booked: 'Occupée',
  partial: 'Partielle',
}

function statusBadgeVariant(s: RoomStatus): 'default' | 'destructive' | 'secondary' {
  if (s === 'free') return 'default'
  if (s === 'booked') return 'destructive'
  return 'secondary'
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RoomBooking() {
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<FloorPlan | null>(null)
  const [availability, setAvailability] = useState<Record<string, RoomAvailability>>({})
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [loadingAvail, setLoadingAvail] = useState(false)

  // Booking dialog state
  const [bookingRoom, setBookingRoom] = useState<FloorPlanArea | null>(null)
  const [bookingTitle, setBookingTitle] = useState('')
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().split('T')[0])
  const [bookingStart, setBookingStart] = useState('09:00')
  const [bookingEnd, setBookingEnd] = useState('10:00')
  const [bookingLoading, setBookingLoading] = useState(false)

  // Load floor plans
  useEffect(() => {
    calendarApi
      .get<FloorPlan[]>('/floor-plans')
      .then((res) => {
        const plans: FloorPlan[] = res.data ?? []
        setFloorPlans(plans)
        if (plans.length > 0) setSelectedPlan(plans[0])
      })
      .catch(() => toast.error('Impossible de charger les plans'))
      .finally(() => setLoadingPlans(false))
  }, [])

  // Refresh availability for the current floor plan
  const refreshAvailability = useCallback(
    async (plan: FloorPlan) => {
      if (!plan.areas?.length) return
      setLoadingAvail(true)
      try {
        const now = new Date()
        const endOfDay = new Date(now)
        endOfDay.setHours(23, 59, 59, 999)

        const roomIds = plan.areas.map((a) => a.id)
        const results: Record<string, RoomAvailability> = {}

        await Promise.all(
          roomIds.map(async (rid) => {
            try {
              const res = await calendarApi.get<RoomEvent[]>('/events', {
                params: {
                  resource_id: rid,
                  start: now.toISOString(),
                  end: endOfDay.toISOString(),
                },
              })
              const events: RoomEvent[] = res.data ?? []
              let status: RoomStatus = 'free'
              if (events.length > 0) {
                const nowMs = now.getTime()
                const isCurrentlyBooked = events.some(
                  (e) => new Date(e.start).getTime() <= nowMs && new Date(e.end).getTime() >= nowMs
                )
                status = isCurrentlyBooked ? 'booked' : 'partial'
              }
              results[rid] = { room_id: rid, status, events }
            } catch {
              results[rid] = { room_id: rid, status: 'free', events: [] }
            }
          })
        )
        setAvailability(results)
      } finally {
        setLoadingAvail(false)
      }
    },
    []
  )

  useEffect(() => {
    if (selectedPlan) refreshAvailability(selectedPlan)
  }, [selectedPlan, refreshAvailability])

  const handleRoomClick = (area: FloorPlanArea) => {
    setBookingRoom(area)
    setBookingTitle('')
    setBookingDate(new Date().toISOString().split('T')[0])
    setBookingStart('09:00')
    setBookingEnd('10:00')
  }

  const handleBook = async () => {
    if (!bookingRoom || !bookingTitle.trim()) {
      toast.error('Veuillez saisir un titre')
      return
    }
    setBookingLoading(true)
    try {
      // Find or use the first calendar
      const cals = await calendarApi.listCalendars()
      const calendarId = (cals.data as Array<{ id: string }>)?.[0]?.id
      if (!calendarId) throw new Error('Aucun calendrier disponible')

      const startDt = new Date(`${bookingDate}T${bookingStart}:00`)
      const endDt = new Date(`${bookingDate}T${bookingEnd}:00`)

      await calendarApi.createEvent(calendarId, {
        title: bookingTitle,
        start_time: startDt.toISOString(),
        end_time: endDt.toISOString(),
        location: bookingRoom.label,
        description: `Réservation salle: ${bookingRoom.label}`,
      })

      toast.success(`Salle "${bookingRoom.label}" réservée`)
      setBookingRoom(null)
      if (selectedPlan) refreshAvailability(selectedPlan)
    } catch {
      toast.error('Échec de la réservation')
    } finally {
      setBookingLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loadingPlans) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (floorPlans.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <Building2 className="w-10 h-10" />
          <p>Aucun plan de salle disponible</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Floor selector */}
      <div className="flex items-center gap-3">
        <MapPin className="w-5 h-5 text-primary shrink-0" />
        <Select
          value={selectedPlan?.id ?? ''}
          onValueChange={(id) => {
            const plan = floorPlans.find((p) => p.id === id)
            if (plan) setSelectedPlan(plan)
          }}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Choisir un étage" />
          </SelectTrigger>
          <SelectContent>
            {floorPlans.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} — {p.floor}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Legend */}
        <div className="flex items-center gap-4 ml-auto text-sm">
          {(['free', 'partial', 'booked'] as RoomStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: STATUS_COLOR[s] }}
              />
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </div>

      {/* Floor plan SVG */}
      {selectedPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {selectedPlan.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAvail && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                Chargement disponibilité…
              </div>
            )}

            {selectedPlan.areas?.length > 0 ? (
              <svg
                viewBox={selectedPlan.svg_viewbox ?? '0 0 800 600'}
                className="w-full border rounded-lg bg-muted/20"
                style={{ maxHeight: 500 }}
              >
                {/* Background grid */}
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {selectedPlan.areas.map((area) => {
                  const avail = availability[area.id]
                  const status = avail?.status ?? 'free'
                  const color = STATUS_COLOR[status]
                  return (
                    <g
                      key={area.id}
                      onClick={() => handleRoomClick(area)}
                      className="cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label={`${area.label} — ${STATUS_LABEL[status]}`}
                      onKeyDown={(e) => e.key === 'Enter' && handleRoomClick(area)}
                    >
                      <rect
                        x={area.x}
                        y={area.y}
                        width={area.width}
                        height={area.height}
                        rx={4}
                        fill={color}
                        fillOpacity={0.25}
                        stroke={color}
                        strokeWidth={2}
                        className="transition-all hover:fill-opacity-40"
                      />
                      <text
                        x={area.x + area.width / 2}
                        y={area.y + area.height / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={12}
                        fontWeight={600}
                        fill={color}
                      >
                        {area.label}
                      </text>
                      {avail?.events?.length ? (
                        <text
                          x={area.x + area.width / 2}
                          y={area.y + area.height / 2 + 16}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={9}
                          fill={color}
                        >
                          {avail.events.length} réunion{avail.events.length > 1 ? 's' : ''}
                        </text>
                      ) : null}
                    </g>
                  )
                })}
              </svg>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune salle définie pour ce plan
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Room list */}
      {selectedPlan && selectedPlan.areas?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {selectedPlan.areas.map((area) => {
            const avail = availability[area.id]
            const status = avail?.status ?? 'free'
            return (
              <Card
                key={area.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleRoomClick(area)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{area.label}</p>
                    {avail?.events?.length ? (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {avail.events[0].title}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">Libre</p>
                    )}
                  </div>
                  <Badge variant={statusBadgeVariant(status)}>{STATUS_LABEL[status]}</Badge>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Booking dialog */}
      <Dialog open={!!bookingRoom} onOpenChange={(o) => !o && setBookingRoom(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Réserver — {bookingRoom?.label}
            </DialogTitle>
          </DialogHeader>

          {bookingRoom && (
            <>
              {/* Current events */}
              {availability[bookingRoom.id]?.events?.length ? (
                <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Réunions du jour
                  </p>
                  {availability[bookingRoom.id].events.map((ev) => (
                    <div key={ev.id} className="text-xs flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {new Date(ev.start).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {new Date(ev.end).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
                      <span className="truncate">{ev.title}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border p-3 text-sm text-green-600 bg-green-50 dark:bg-green-950/20">
                  Salle libre pour aujourd'hui
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Titre de la réunion</Label>
                  <Input
                    placeholder="Ex: Réunion équipe produit"
                    value={bookingTitle}
                    onChange={(e) => setBookingTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Début</Label>
                    <Input
                      type="time"
                      value={bookingStart}
                      onChange={(e) => setBookingStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Fin</Label>
                    <Input
                      type="time"
                      value={bookingEnd}
                      onChange={(e) => setBookingEnd(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingRoom(null)}>
              Annuler
            </Button>
            <Button onClick={handleBook} disabled={bookingLoading || !bookingTitle.trim()}>
              {bookingLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Réserver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
