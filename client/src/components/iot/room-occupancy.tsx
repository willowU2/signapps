"use client";

import { useState, useEffect } from "react";
import { Users, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Room {
  id: string;
  name: string;
  occupied: boolean;
  occupants: number;
  maxCapacity: number;
  releaseTimer: number;
  totalVisits: number;
  avgDuration: number;
}

export default function RoomOccupancy() {
  const [rooms, setRooms] = useState<Room[]>([
    {
      id: "1",
      name: "Meeting Room A",
      occupied: true,
      occupants: 5,
      maxCapacity: 10,
      releaseTimer: 45,
      totalVisits: 12,
      avgDuration: 60,
    },
    {
      id: "2",
      name: "Meeting Room B",
      occupied: false,
      occupants: 0,
      maxCapacity: 8,
      releaseTimer: 0,
      totalVisits: 8,
      avgDuration: 45,
    },
    {
      id: "3",
      name: "Focus Room",
      occupied: true,
      occupants: 1,
      maxCapacity: 2,
      releaseTimer: 20,
      totalVisits: 15,
      avgDuration: 90,
    },
    {
      id: "4",
      name: "Collaboration Space",
      occupied: false,
      occupants: 0,
      maxCapacity: 20,
      releaseTimer: 0,
      totalVisits: 20,
      avgDuration: 30,
    },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRooms((prevRooms) =>
        prevRooms.map((room) => ({
          ...room,
          releaseTimer: room.occupied && room.releaseTimer > 0 ? room.releaseTimer - 1 : 0,
        }))
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRelease = (id: string) => {
    setRooms((prevRooms) =>
      prevRooms.map((room) =>
        room.id === id ? { ...room, occupied: false, occupants: 0, releaseTimer: 0 } : room
      )
    );
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Users className="w-6 h-6" />
        Room Occupancy
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rooms.map((room) => (
          <Card key={room.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-lg">{room.name}</h3>
                <Badge className={room.occupied ? "bg-blue-500" : "bg-gray-500"}>
                  {room.occupied ? "Occupied" : "Free"}
                </Badge>
              </div>
              {room.occupied && room.releaseTimer > 0 && (
                <div className="text-right">
                  <div className="flex items-center gap-1 text-sm text-yellow-600">
                    <Clock className="w-4 h-4" />
                    {formatTimer(room.releaseTimer)}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Occupancy</span>
                  <span className="font-semibold">
                    {room.occupants}/{room.maxCapacity}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${(room.occupants / room.maxCapacity) * 100}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Visits</p>
                  <p className="font-semibold">{room.totalVisits}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Avg Duration</p>
                  <p className="font-semibold">{room.avgDuration} min</p>
                </div>
              </div>
              {room.occupied && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="w-full"
                  onClick={() => handleRelease(room.id)}
                >
                  Release
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
