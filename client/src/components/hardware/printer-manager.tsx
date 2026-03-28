"use client";

import { useEffect, useState } from "react";
import { Printer, Circle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PrinterDevice {
  id: string;
  name: string;
  ip: string;
  status: "online" | "offline" | "error";
  queueCount: number;
  model: string;
  lastUsed?: Date;
}

export default function PrinterManager() {
  const [printers, setPrinters] = useState<PrinterDevice[]>([
    {
      id: "1",
      name: "Office Printer 1",
      ip: "192.168.1.100",
      status: "online",
      queueCount: 3,
      model: "HP LaserJet Pro",
      lastUsed: new Date(Date.now() - 15 * 60000),
    },
    {
      id: "2",
      name: "Conference Room Printer",
      ip: "192.168.1.101",
      status: "online",
      queueCount: 0,
      model: "Xerox VersaLink",
      lastUsed: new Date(Date.now() - 2 * 3600000),
    },
    {
      id: "3",
      name: "Color Printer",
      ip: "192.168.1.102",
      status: "offline",
      queueCount: 2,
      model: "Canon imagePRESS",
      lastUsed: new Date(Date.now() - 24 * 3600000),
    },
    {
      id: "4",
      name: "Basement Scanner-Printer",
      ip: "192.168.1.103",
      status: "error",
      queueCount: 1,
      model: "Ricoh MP C5503",
      lastUsed: new Date(Date.now() - 5 * 24 * 3600000),
    },
  ]);

  const [testingPrinterId, setTestingPrinterId] = useState<string | null>(null);

  const testPrint = async (printerId: string) => {
    setTestingPrinterId(printerId);
    // Simulate test print
    setTimeout(() => {
      setTestingPrinterId(null);
      toast.success("Page de test envoyée à l'imprimante");
    }, 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "text-green-600 bg-green-50 border-green-200";
      case "offline":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "error":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "offline":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const formatLastUsed = (date?: Date) => {
    if (!date) return "Never used";
    const hours = Math.floor((Date.now() - date.getTime()) / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Printer className="w-6 h-6" />
          Printer Manager
        </h2>
        <span className="text-sm text-gray-600">
          {printers.filter((p) => p.status === "online").length}/{printers.length} Online
        </span>
      </div>

      <div className="space-y-2">
        {printers.map((printer) => (
          <div key={printer.id} className={`p-3 rounded-lg border-2 ${getStatusColor(printer.status)}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-start gap-3 flex-1">
                <div className={`w-3 h-3 rounded-full mt-1.5 ${getStatusIcon(printer.status)}`} />
                <div className="flex-1">
                  <h3 className="font-bold">{printer.name}</h3>
                  <p className="text-xs opacity-75">{printer.model}</p>
                  <p className="text-xs font-mono opacity-75">{printer.ip}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold capitalize">{printer.status}</p>
                <p className="text-xs opacity-75">Queue: {printer.queueCount}</p>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs mb-2">
              <span className="opacity-75">Last used: {formatLastUsed(printer.lastUsed)}</span>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => testPrint(printer.id)}
              disabled={printer.status !== "online" || testingPrinterId === printer.id}
              className="w-full"
            >
              {testingPrinterId === printer.id ? "Sending..." : "Test Print"}
            </Button>
          </div>
        ))}
      </div>

      {printers.some((p) => p.status === "error") && (
        <div className="p-3 bg-red-50 rounded-lg border border-red-200 flex gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <p className="font-medium">Printer Issues Detected</p>
            <p className="text-xs mt-1">Check configuration or contact IT support</p>
          </div>
        </div>
      )}
    </div>
  );
}
