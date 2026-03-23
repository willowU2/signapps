"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Car } from "lucide-react";

interface Trip {
  id: string;
  from: string;
  to: string;
  date: string;
  seatsAvailable: number;
  co2Saved: number;
}

export default function Carpooling() {
  const [trips] = useState<Trip[]>([
    {
      id: "1",
      from: "Central Office",
      to: "Tech Park",
      date: "Today 8:00 AM",
      seatsAvailable: 2,
      co2Saved: 12.5,
    },
    {
      id: "2",
      from: "Downtown Station",
      to: "HQ Building",
      date: "Today 5:30 PM",
      seatsAvailable: 1,
      co2Saved: 8.3,
    },
    {
      id: "3",
      from: "Airport",
      to: "Central Office",
      date: "Tomorrow 9:00 AM",
      seatsAvailable: 3,
      co2Saved: 15.7,
    },
  ]);

  const [registered, setRegistered] = useState<string[]>([]);

  const handleRegister = (id: string) => {
    setRegistered((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Car className="w-6 h-6 text-green-600" />
        <h2 className="text-2xl font-bold">Carpooling</h2>
      </div>

      <div className="grid gap-3">
        {trips.map((trip) => (
          <div
            key={trip.id}
            className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex gap-2 items-center mb-2">
                  <span className="font-semibold">{trip.from}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-semibold">{trip.to}</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{trip.date}</p>
                <div className="flex gap-4 text-sm">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                    {trip.seatsAvailable} seats
                  </span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                    {trip.co2Saved} kg CO₂ saved
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant={registered.includes(trip.id) ? "default" : "outline"}
                onClick={() => handleRegister(trip.id)}
                className="mt-1"
              >
                {registered.includes(trip.id) ? "✓ Joined" : "Join Ride"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {registered.length > 0 && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm">
          <p className="text-green-900">
            <strong>{registered.length}</strong> ride(s) joined ✓
          </p>
        </div>
      )}
    </div>
  );
}
