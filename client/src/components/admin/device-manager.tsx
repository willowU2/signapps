"use client";

import { useState } from "react";
import { Smartphone, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Device {
  id: string;
  name: string;
  browser: string;
  lastSeen: Date;
  ip: string;
  trusted: boolean;
}

export function DeviceManager() {
  const [devices, setDevices] = useState<Device[]>([
    {
      id: "1",
      name: "MacBook Pro",
      browser: "Chrome 124.0",
      lastSeen: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
      ip: "192.168.1.100",
      trusted: true,
    },
    {
      id: "2",
      name: "iPhone 15",
      browser: "Safari iOS 17.2",
      lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      ip: "203.0.113.42",
      trusted: true,
    },
    {
      id: "3",
      name: "Windows Desktop",
      browser: "Firefox 123.0",
      lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      ip: "198.51.100.15",
      trusted: true,
    },
    {
      id: "4",
      name: "Android Phone",
      browser: "Chrome Mobile 124.0",
      lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
      ip: "192.0.2.88",
      trusted: false,
    },
  ]);

  const revokeDevice = (id: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== id));
  };

  const formatLastSeen = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: diffDays > 365 ? "numeric" : undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Trusted Devices</h2>
        </div>
        <div className="text-sm text-muted-foreground">
          {devices.filter((d) => d.trusted).length} of {devices.length} active
        </div>
      </div>

      {/* Devices List */}
      <div className="space-y-3">
        {devices.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted p-8 text-center text-muted-foreground">
            No devices registered yet
          </div>
        ) : (
          devices.map((device) => (
            <div
              key={device.id}
              className="rounded-lg border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Device Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">
                      {device.name}
                    </h3>
                    {device.trusted && (
                      <Badge variant="default" className="bg-green-600">
                        Trusted
                      </Badge>
                    )}
                    {!device.trusted && (
                      <Badge
                        variant="outline"
                        className="text-amber-600 border-amber-300"
                      >
                        Unverified
                      </Badge>
                    )}
                  </div>

                  {/* Browser Info */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Browser</p>
                      <p className="font-mono text-foreground">
                        {device.browser}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">IP Address</p>
                      <p className="font-mono text-foreground">{device.ip}</p>
                    </div>
                    <div className="flex items-end gap-1">
                      <Clock className="h-4 w-4 text-gray-400 mb-0.5" />
                      <div>
                        <p className="text-muted-foreground">Last Seen</p>
                        <p className="font-medium text-foreground">
                          {formatLastSeen(device.lastSeen)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => revokeDevice(device.id)}
                  className="gap-2 mt-2 sm:mt-0"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Revoke</span>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Information Note */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-900">
          <strong>Tip:</strong> Revoked devices will be logged out immediately
          and will need to re-authenticate at next login.
        </p>
      </div>
    </div>
  );
}
