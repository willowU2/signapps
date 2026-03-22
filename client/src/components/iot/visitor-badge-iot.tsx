"use client";

import { useState } from "react";
import { User, Lock, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface VisitorBadge {
  id: string;
  visitorName: string;
  accessZones: string[];
  expiryTime: number;
  isActive: boolean;
  issueDate: string;
}

export default function VisitorBadgeIoT() {
  const [badges, setBadges] = useState<VisitorBadge[]>([
    {
      id: "1",
      visitorName: "John Smith",
      accessZones: ["Lobby", "Meeting Room A", "Office Floor 2"],
      expiryTime: 3600,
      isActive: true,
      issueDate: "2024-03-22 09:00",
    },
    {
      id: "2",
      visitorName: "Sarah Johnson",
      accessZones: ["Lobby", "Kitchen", "Meeting Room B"],
      expiryTime: 7200,
      isActive: true,
      issueDate: "2024-03-22 08:30",
    },
    {
      id: "3",
      visitorName: "Mike Davis",
      accessZones: ["Lobby", "Server Room"],
      expiryTime: 1800,
      isActive: true,
      issueDate: "2024-03-22 10:15",
    },
    {
      id: "4",
      visitorName: "Emma Wilson",
      accessZones: ["Lobby"],
      expiryTime: 0,
      isActive: false,
      issueDate: "2024-03-21 14:30",
    },
  ]);

  const deactivateBadge = (id: string) => {
    setBadges((prevBadges) =>
      prevBadges.map((badge) =>
        badge.id === id ? { ...badge, isActive: false, expiryTime: 0 } : badge
      )
    );
  };

  const formatExpiryTime = (seconds: number) => {
    if (seconds <= 0) return "Expired";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Lock className="w-6 h-6" />
        NFC Visitor Badges
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {badges.map((badge) => (
          <Card key={badge.id} className={`p-4 ${!badge.isActive ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-2">
                <User className="w-5 h-5 mt-1 text-gray-500" />
                <div>
                  <h3 className="font-semibold text-lg">{badge.visitorName}</h3>
                  <p className="text-xs text-gray-600">{badge.issueDate}</p>
                </div>
              </div>
              <Badge className={badge.isActive ? "bg-green-500" : "bg-gray-500"}>
                {badge.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Zap className="w-4 h-4" />
                  Access Zones
                </p>
                <div className="space-y-1">
                  {badge.accessZones.map((zone, idx) => (
                    <div key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                      • {zone}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Expires in</span>
                  <span className={`font-semibold ${!badge.isActive ? "text-red-600" : ""}`}>
                    {formatExpiryTime(badge.expiryTime)}
                  </span>
                </div>
              </div>

              {badge.isActive && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="w-full"
                  onClick={() => deactivateBadge(badge.id)}
                >
                  Deactivate
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
