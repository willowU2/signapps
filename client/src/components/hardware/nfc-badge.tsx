"use client";

import { useEffect, useState } from "react";
import { Smartphone, User, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BadgeScan {
  id: string;
  badgeId: string;
  employeeName: string;
  timestamp: Date;
  location: string;
}

interface ReaderStatus {
  connected: boolean;
  lastSeen: Date;
  scansToday: number;
}

export function NfcBadge() {
  const [status, setStatus] = useState<ReaderStatus>({
    connected: false,
    lastSeen: new Date(),
    scansToday: 0,
  });
  const [lastScan, setLastScan] = useState<BadgeScan | null>(null);
  const [employee, setEmployee] = useState<{ id: string; name: string; department: string } | null>(null);
  const [eventLog, setEventLog] = useState<BadgeScan[]>([]);

  useEffect(() => {
    setStatus({ connected: true, lastSeen: new Date(), scansToday: 12 });
    setLastScan({
      id: "scan-001",
      badgeId: "NFC-2024-001",
      employeeName: "John Doe",
      timestamp: new Date(Date.now() - 5 * 60000),
      location: "Main Entrance",
    });
    setEmployee({ id: "emp-001", name: "John Doe", department: "Engineering" });
    setEventLog([
      { id: "1", badgeId: "NFC-2024-001", employeeName: "John Doe", timestamp: new Date(Date.now() - 5 * 60000), location: "Main Entrance" },
      { id: "2", badgeId: "NFC-2024-002", employeeName: "Jane Smith", timestamp: new Date(Date.now() - 15 * 60000), location: "Office" },
      { id: "3", badgeId: "NFC-2024-001", employeeName: "John Doe", timestamp: new Date(Date.now() - 25 * 60000), location: "Main Entrance" },
    ]);
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 bg-green-50">
          <div className="flex items-center space-x-2 mb-2">
            <Smartphone className="w-5 h-5 text-green-600" />
            <span className="font-semibold">Reader Status</span>
          </div>
          <p className="text-2xl font-bold text-green-700">Connecté</p>
          <p className="text-sm text-muted-foreground">Last seen: {status.lastSeen.toLocaleTimeString()}</p>
        </div>

        <div className="border rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="font-semibold">Scans Today</span>
          </div>
          <p className="text-2xl font-bold text-blue-700">{status.scansToday}</p>
        </div>

        <div className="border rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <User className="w-5 h-5 text-purple-600" />
            <span className="font-semibold">Last Badge</span>
          </div>
          <p className="text-lg font-bold text-purple-700">{lastScan?.badgeId || "—"}</p>
        </div>
      </div>

      {employee && (
        <div className="border rounded-lg p-4 bg-blue-50">
          <h3 className="font-semibold mb-3">Employee Lookup</h3>
          <div className="space-y-2">
            <p><span className="font-medium">Name:</span> {employee.name}</p>
            <p><span className="font-medium">Department:</span> {employee.department}</p>
            <p><span className="font-medium">Last Scan:</span> {lastScan?.timestamp.toLocaleString()}</p>
            <p><span className="font-medium">Location:</span> {lastScan?.location}</p>
          </div>
        </div>
      )}

      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-3">Event Log</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {eventLog.map((event) => (
            <div key={event.id} className="flex justify-between items-center p-2 bg-muted rounded">
              <div>
                <p className="font-medium">{event.employeeName}</p>
                <p className="text-sm text-muted-foreground">{event.location}</p>
              </div>
              <span className="text-sm text-muted-foreground">{event.timestamp.toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
