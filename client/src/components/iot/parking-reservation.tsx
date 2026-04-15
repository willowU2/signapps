"use client";

import { useState } from "react";
import { Car, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ParkingSpot {
  id: string;
  spotNumber: string;
  status: "free" | "reserved" | "ev-charging";
  reservedBy?: string;
  reservedUntil?: string;
}

export default function ParkingReservation() {
  const [spots, setSpots] = useState<ParkingSpot[]>([
    { id: "1", spotNumber: "A-01", status: "free" },
    {
      id: "2",
      spotNumber: "A-02",
      status: "reserved",
      reservedBy: "John Smith",
      reservedUntil: "12:30",
    },
    { id: "3", spotNumber: "A-03", status: "ev-charging" },
    { id: "4", spotNumber: "A-04", status: "free" },
    {
      id: "5",
      spotNumber: "B-01",
      status: "reserved",
      reservedBy: "Sarah Johnson",
      reservedUntil: "14:00",
    },
    { id: "6", spotNumber: "B-02", status: "free" },
    { id: "7", spotNumber: "B-03", status: "ev-charging" },
    {
      id: "8",
      spotNumber: "B-04",
      status: "reserved",
      reservedBy: "Mike Davis",
      reservedUntil: "13:15",
    },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "free":
        return "bg-green-100 border-green-300 text-green-700";
      case "reserved":
        return "bg-blue-100 border-blue-300 text-blue-700";
      case "ev-charging":
        return "bg-yellow-100 border-yellow-300 text-yellow-700";
      default:
        return "bg-muted border-border text-muted-foreground";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "free":
        return <Badge className="bg-green-500">Free</Badge>;
      case "reserved":
        return <Badge className="bg-blue-500">Reserved</Badge>;
      case "ev-charging":
        return (
          <Badge className="bg-yellow-500 text-foreground">EV Charging</Badge>
        );
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const bookHalfDay = (id: string) => {
    setSpots((prevSpots) =>
      prevSpots.map((spot) => {
        if (spot.id === id && spot.status === "free") {
          return {
            ...spot,
            status: "reserved",
            reservedBy: "You",
            reservedUntil: "14:00",
          };
        }
        return spot;
      }),
    );
  };

  const cancelReservation = (id: string) => {
    setSpots((prevSpots) =>
      prevSpots.map((spot) =>
        spot.id === id && spot.status === "reserved"
          ? { id: spot.id, spotNumber: spot.spotNumber, status: "free" }
          : spot,
      ),
    );
  };

  const freeSpots = spots.filter((s) => s.status === "free").length;
  const reservedSpots = spots.filter((s) => s.status === "reserved").length;
  const evSpots = spots.filter((s) => s.status === "ev-charging").length;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Car className="w-6 h-6" />
        Parking Reservation
      </h2>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-3 bg-green-50">
          <p className="text-xs text-muted-foreground">Free</p>
          <p className="text-2xl font-bold text-green-600">{freeSpots}</p>
        </Card>
        <Card className="p-3 bg-blue-50">
          <p className="text-xs text-muted-foreground">Reserved</p>
          <p className="text-2xl font-bold text-blue-600">{reservedSpots}</p>
        </Card>
        <Card className="p-3 bg-yellow-50">
          <p className="text-xs text-muted-foreground">EV Charging</p>
          <p className="text-2xl font-bold text-yellow-600">{evSpots}</p>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-4">Parking Map</h3>
        <div className="grid grid-cols-4 gap-3">
          {spots.map((spot) => (
            <div key={spot.id} className="flex flex-col gap-2">
              <button
                className={`border-2 p-4 rounded-lg font-semibold text-center transition-all cursor-pointer ${getStatusColor(
                  spot.status,
                )}`}
              >
                <div className="flex flex-col items-center gap-1">
                  {spot.status === "ev-charging" && <Zap className="w-4 h-4" />}
                  {spot.spotNumber}
                </div>
              </button>
              <div className="text-xs">
                {spot.status === "reserved" ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-blue-700">
                      {spot.reservedBy}
                    </p>
                    <p className="text-muted-foreground">
                      Until {spot.reservedUntil}
                    </p>
                    {spot.reservedBy === "You" && (
                      <Button
                        size="xs"
                        variant="destructive"
                        className="w-full text-xs"
                        onClick={() => cancelReservation(spot.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                ) : spot.status === "free" ? (
                  <Button
                    size="xs"
                    className="w-full text-xs bg-green-600 hover:bg-green-700"
                    onClick={() => bookHalfDay(spot.id)}
                  >
                    Book Half-Day
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
