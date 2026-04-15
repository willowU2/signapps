"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Thermometer, AlertTriangle, CheckCircle } from "lucide-react";

interface CCPPoint {
  id: string;
  name: string;
  minTemp: number;
  maxTemp: number;
  currentTemp: number;
  status: "ok" | "warning" | "critical";
  lastCheck: string;
}

export default function HACCPManager() {
  const [ccpPoints, setCCPPoints] = useState<CCPPoint[]>([
    {
      id: "1",
      name: "Cold Storage",
      minTemp: -18,
      maxTemp: -15,
      currentTemp: -17,
      status: "ok",
      lastCheck: "2 mins ago",
    },
    {
      id: "2",
      name: "Pasteurization Unit",
      minTemp: 72,
      maxTemp: 75,
      currentTemp: 73,
      status: "ok",
      lastCheck: "5 mins ago",
    },
    {
      id: "3",
      name: "Refrigerated Transport",
      minTemp: 2,
      maxTemp: 4,
      currentTemp: 5,
      status: "warning",
      lastCheck: "1 min ago",
    },
    {
      id: "4",
      name: "Cooking Station",
      minTemp: 75,
      maxTemp: 90,
      currentTemp: 85,
      status: "ok",
      lastCheck: "3 mins ago",
    },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ok":
        return "bg-emerald-100 text-emerald-800";
      case "warning":
        return "bg-amber-100 text-amber-800";
      case "critical":
        return "bg-red-100 text-red-800";
      default:
        return "bg-muted text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === "ok") return <CheckCircle className="w-4 h-4" />;
    if (status === "warning") return <AlertTriangle className="w-4 h-4" />;
    return <AlertTriangle className="w-4 h-4" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Thermometer className="w-5 h-5" />
          HACCP CCP Points
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {ccpPoints.map((point) => (
            <div
              key={point.id}
              className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted"
            >
              <div className="flex-1">
                <h3 className="font-medium text-sm text-foreground">
                  {point.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Range: {point.minTemp}°C to {point.maxTemp}°C | Current:{" "}
                  {point.currentTemp}°C
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  className={`${getStatusColor(point.status)} flex items-center gap-1`}
                >
                  {getStatusIcon(point.status)}
                  {point.status.toUpperCase()}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {point.lastCheck}
                </span>
              </div>
            </div>
          ))}
        </div>
        <Button className="w-full mt-4" size="sm" variant="outline">
          Download HACCP Report
        </Button>
      </CardContent>
    </Card>
  );
}
