"use client";

import { useState } from "react";
import { Thermometer, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RoomTemperature {
  id: string;
  name: string;
  current: number;
  min: number;
  max: number;
  status: "alert" | "ok";
}

export default function TemperatureSensors() {
  const [rooms] = useState<RoomTemperature[]>([
    { id: "1", name: "Lobby", current: 22, min: 18, max: 25, status: "ok" },
    { id: "2", name: "Office A", current: 20, min: 18, max: 25, status: "ok" },
    { id: "3", name: "Meeting Room", current: 29, min: 18, max: 25, status: "alert" },
    { id: "4", name: "Server Room", current: 16, min: 18, max: 25, status: "alert" },
  ]);

  const getStatusBadge = (temp: number) => {
    if (temp > 28) return <Badge className="bg-red-500">Too Hot</Badge>;
    if (temp < 18) return <Badge className="bg-blue-500">Too Cold</Badge>;
    return <Badge className="bg-green-500">Normal</Badge>;
  };

  const getGaugeStyle = (temp: number) => {
    const percentage = ((temp - 10) / 30) * 100;
    return Math.min(100, Math.max(0, percentage));
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Thermometer className="w-6 h-6" />
        Temperature Sensors
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rooms.map((room) => (
          <Card key={room.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold">{room.name}</h3>
                <p className="text-2xl font-bold">{room.current}°C</p>
              </div>
              {room.status === "alert" && (
                <AlertTriangle className="w-5 h-5 text-red-500" />
              )}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Min: {room.min}°C</span>
                <span>Max: {room.max}°C</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 via-green-500 to-red-500 h-2 rounded-full transition-all"
                  style={{ width: `${getGaugeStyle(room.current)}%` }}
                />
              </div>
              <div className="flex justify-center pt-2">
                {getStatusBadge(room.current)}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">History: Chart placeholder</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
