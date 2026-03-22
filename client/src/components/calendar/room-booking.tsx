'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Users, MapPin, CheckCircle2, Loader2 } from 'lucide-react'

interface TimeSlot {
  time: string
  available: boolean
}

interface Room {
  id: string
  name: string
  capacity: number
  location: string
  amenities: string[]
  availability: 'available' | 'booked' | 'maintenance'
  nextAvailable?: string
  todaySlots: TimeSlot[]
}

export function RoomBooking() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlots, setSelectedSlots] = useState<Record<string, string | null>>({})
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null)

  useEffect(() => {
    // Mock data - replace with API call
    const mockRooms: Room[] = [
      {
        id: '1',
        name: 'Conference Room A',
        capacity: 12,
        location: 'Building 1, Floor 2',
        amenities: ['Projector', 'Whiteboard', 'Video Conference'],
        availability: 'available',
        todaySlots: [
          { time: '09:00', available: true },
          { time: '10:00', available: false },
          { time: '11:00', available: true },
          { time: '14:00', available: true },
          { time: '15:00', available: false },
          { time: '16:00', available: true },
        ],
      },
      {
        id: '2',
        name: 'Meeting Room B',
        capacity: 6,
        location: 'Building 1, Floor 1',
        amenities: ['Display Screen', 'Whiteboard'],
        availability: 'available',
        todaySlots: [
          { time: '09:00', available: false },
          { time: '10:00', available: true },
          { time: '11:00', available: true },
          { time: '14:00', available: false },
          { time: '15:00', available: true },
          { time: '16:00', available: true },
        ],
      },
      {
        id: '3',
        name: 'Boardroom',
        capacity: 20,
        location: 'Building 2, Floor 3',
        amenities: ['Full AV Setup', 'Catering', 'Virtual Meeting Support'],
        availability: 'booked',
        nextAvailable: 'Tomorrow at 10:00 AM',
        todaySlots: [],
      },
      {
        id: '4',
        name: 'Huddle Space',
        capacity: 4,
        location: 'Building 1, Floor 2',
        amenities: ['Smart TV', 'Whiteboard'],
        availability: 'maintenance',
        todaySlots: [],
      },
    ]

    setRooms(mockRooms)
    setLoading(false)

    const initialSlots: Record<string, string | null> = {}
    mockRooms.forEach((room) => {
      initialSlots[room.id] = null
    })
    setSelectedSlots(initialSlots)
  }, [])

  const getAvailabilityBadge = (availability: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      available: 'default',
      booked: 'secondary',
      maintenance: 'destructive',
    }
    return (
      <Badge variant={variants[availability] || 'default'} className="capitalize">
        {availability}
      </Badge>
    )
  }

  const handleSlotSelect = (roomId: string, time: string) => {
    setSelectedSlots((prev) => ({
      ...prev,
      [roomId]: prev[roomId] === time ? null : time,
    }))
  }

  const handleBookRoom = (roomId: string) => {
    const selectedTime = selectedSlots[roomId]
    if (selectedTime) {
      alert(`Booked: Room ${roomId} at ${selectedTime}`)
      setSelectedSlots((prev) => ({ ...prev, [roomId]: null }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {rooms.map((room) => (
        <Card key={room.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  <CardTitle>{room.name}</CardTitle>
                  {getAvailabilityBadge(room.availability)}
                </div>
                <CardDescription>{room.location}</CardDescription>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-sm font-medium">
                  <Users className="w-4 h-4" />
                  {room.capacity} people
                </div>
              </div>
            </div>

            {/* Amenities */}
            {room.amenities.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {room.amenities.map((amenity) => (
                  <Badge key={amenity} variant="outline" className="text-xs">
                    {amenity}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>

          <CardContent>
            {/* Status Message */}
            {room.availability === 'maintenance' && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg mb-4">
                <p className="text-sm text-destructive font-medium">This room is under maintenance</p>
              </div>
            )}

            {room.availability === 'booked' && room.nextAvailable && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Next available:</strong> {room.nextAvailable}
                </p>
              </div>
            )}

            {/* Time Slots */}
            {room.todaySlots.length > 0 && (
              <>
                <div className="mb-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Available Times Today
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {room.todaySlots.map((slot) => (
                      <button
                        key={slot.time}
                        onClick={() => slot.available && handleSlotSelect(room.id, slot.time)}
                        disabled={!slot.available}
                        className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                          selectedSlots[room.id] === slot.time
                            ? 'bg-primary text-primary-foreground border-primary'
                            : slot.available
                              ? 'border-input hover:bg-muted cursor-pointer'
                              : 'opacity-50 cursor-not-allowed bg-muted text-muted-foreground'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3" />
                          {slot.time}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Book Button */}
                <Button
                  onClick={() => handleBookRoom(room.id)}
                  disabled={!selectedSlots[room.id]}
                  className="w-full"
                >
                  {selectedSlots[room.id] ? `Book for ${selectedSlots[room.id]}` : 'Select Time Slot'}
                </Button>
              </>
            )}

            {room.availability !== 'available' && room.todaySlots.length === 0 && (
              <Button variant="outline" className="w-full" disabled>
                Not Available Today
              </Button>
            )}

            {/* Expand/Collapse Additional Info */}
            {expandedRoom === room.id && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <div className="text-sm">
                  <p className="font-medium mb-2">Booking Details:</p>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li>• Bookings are available 30 days in advance</li>
                    <li>• Minimum booking duration is 30 minutes</li>
                    <li>• Please notify support if you need to cancel</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
