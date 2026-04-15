"use client";

import { useState } from "react";
import { Wind } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AirQualityReading {
  id: string;
  room: string;
  co2: number;
  voc: number;
  humidity: number;
  status: "good" | "moderate" | "poor";
}

export default function AirQuality() {
  const [readings] = useState<AirQualityReading[]>([
    { id: "1", room: "Lobby", co2: 450, voc: 80, humidity: 45, status: "good" },
    {
      id: "2",
      room: "Office A",
      co2: 650,
      voc: 150,
      humidity: 52,
      status: "moderate",
    },
    {
      id: "3",
      room: "Meeting Room",
      co2: 1200,
      voc: 320,
      humidity: 60,
      status: "poor",
    },
    {
      id: "4",
      room: "Kitchen",
      co2: 520,
      voc: 200,
      humidity: 55,
      status: "moderate",
    },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "good":
        return "bg-green-500";
      case "moderate":
        return "bg-yellow-500";
      case "poor":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getGaugeColor = (
    value: number,
    threshold1: number,
    threshold2: number,
  ) => {
    if (value < threshold1) return "bg-green-500";
    if (value < threshold2) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Wind className="w-6 h-6" />
        Air Quality
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {readings.map((reading) => (
          <Card key={reading.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-lg">{reading.room}</h3>
              <Badge className={getStatusColor(reading.status)}>
                {reading.status.charAt(0).toUpperCase() +
                  reading.status.slice(1)}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">CO₂</p>
                <p className="font-semibold">{reading.co2} ppm</p>
                <div className="mt-2 h-1 bg-gray-200 rounded">
                  <div
                    className={`h-1 rounded ${getGaugeColor(reading.co2, 600, 1000)}`}
                    style={{
                      width: `${Math.min(100, (reading.co2 / 1200) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">VOC</p>
                <p className="font-semibold">{reading.voc} ppb</p>
                <div className="mt-2 h-1 bg-gray-200 rounded">
                  <div
                    className={`h-1 rounded ${getGaugeColor(reading.voc, 200, 400)}`}
                    style={{
                      width: `${Math.min(100, (reading.voc / 500) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Humidity</p>
                <p className="font-semibold">{reading.humidity}%</p>
                <div className="mt-2 h-1 bg-gray-200 rounded">
                  <div
                    className={`h-1 rounded ${getGaugeColor(reading.humidity, 40, 60)}`}
                    style={{ width: `${reading.humidity}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
