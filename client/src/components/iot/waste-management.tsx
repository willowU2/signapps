"use client";

import { useState } from "react";
import { Trash2, Truck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Bin {
  id: string;
  lockerNumber: string;
  type: "paper" | "plastic" | "glass" | "organic";
  fillingLevel: number;
  lastEmptied: string;
  nextPickup: string;
}

export default function WasteManagement() {
  const [bins] = useState<Bin[]>([
    {
      id: "1",
      lockerNumber: "B-01",
      type: "paper",
      fillingLevel: 65,
      lastEmptied: "2024-03-20",
      nextPickup: "2024-03-25",
    },
    {
      id: "2",
      lockerNumber: "B-02",
      type: "plastic",
      fillingLevel: 45,
      lastEmptied: "2024-03-20",
      nextPickup: "2024-03-28",
    },
    {
      id: "3",
      lockerNumber: "B-03",
      type: "glass",
      fillingLevel: 85,
      lastEmptied: "2024-03-18",
      nextPickup: "2024-03-24",
    },
    {
      id: "4",
      lockerNumber: "B-04",
      type: "organic",
      fillingLevel: 72,
      lastEmptied: "2024-03-21",
      nextPickup: "2024-03-27",
    },
  ]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "paper":
        return "bg-orange-500";
      case "plastic":
        return "bg-blue-500";
      case "glass":
        return "bg-cyan-500";
      case "organic":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const getTypeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getFillingColor = (level: number) => {
    if (level > 80) return "bg-red-500";
    if (level > 60) return "bg-yellow-500";
    return "bg-green-500";
  };

  const pickupSchedule = [
    { day: "Monday", bins: ["B-01"] },
    { day: "Wednesday", bins: ["B-02", "B-04"] },
    { day: "Friday", bins: ["B-03"] },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Trash2 className="w-6 h-6" />
        Waste Management
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bins.map((bin) => (
          <Card key={bin.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-lg">{bin.lockerNumber}</h3>
                <Badge className={`${getTypeColor(bin.type)} text-white mt-1`}>
                  {getTypeLabel(bin.type)}
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Filling Level</span>
                  <span className="font-semibold">{bin.fillingLevel}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getFillingColor(bin.fillingLevel)}`}
                    style={{ width: `${bin.fillingLevel}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Last Emptied</p>
                  <p className="font-semibold text-xs">{bin.lastEmptied}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Next Pickup</p>
                  <p className="font-semibold text-xs">{bin.nextPickup}</p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Truck className="w-5 h-5" />
          Pickup Schedule
        </h3>
        <div className="space-y-3">
          {pickupSchedule.map((schedule, idx) => (
            <div key={idx} className="flex items-center justify-between border-b pb-3 last:border-b-0">
              <p className="font-medium text-sm">{schedule.day}</p>
              <div className="flex gap-2">
                {schedule.bins.map((binNum) => (
                  <Badge key={binNum} className="bg-blue-500 text-white">
                    {binNum}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
