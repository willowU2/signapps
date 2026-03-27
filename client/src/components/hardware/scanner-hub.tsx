"use client";

import { useEffect, useState } from "react";
import { Scan, Upload, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ScannerDevice {
  id: string;
  name: string;
  ip: string;
  status: "ready" | "scanning" | "offline";
  lastScans: {
    id: string;
    filename: string;
    timestamp: Date;
    pages: number;
  }[];
}

export default function ScannerHub() {
  const [scanners, setScanners] = useState<ScannerDevice[]>([
    {
      id: "1",
      name: "Reception Scanner",
      ip: "192.168.1.104",
      status: "ready",
      lastScans: [
        {
          id: "s1",
          filename: "contract_2026_03.pdf",
          timestamp: new Date(Date.now() - 2 * 3600000),
          pages: 8,
        },
        {
          id: "s2",
          filename: "invoice_march.pdf",
          timestamp: new Date(Date.now() - 5 * 3600000),
          pages: 3,
        },
      ],
    },
    {
      id: "2",
      name: "Archive Scanner",
      ip: "192.168.1.105",
      status: "ready",
      lastScans: [
        {
          id: "s3",
          filename: "historical_docs_batch1.pdf",
          timestamp: new Date(Date.now() - 1 * 24 * 3600000),
          pages: 45,
        },
      ],
    },
    {
      id: "3",
      name: "Secure Document Scanner",
      ip: "192.168.1.106",
      status: "offline",
      lastScans: [],
    },
  ]);

  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [previewFile, setPreviewFile] = useState<string | null>(null);

  const startScan = async (scannerId: string) => {
    setActiveScanId(scannerId);
    setScanProgress(0);

    // Simulate scanning progress
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setActiveScanId(null);
          return 100;
        }
        return prev + Math.random() * 30;
      });
    }, 500);
  };

  const sendToStorage = (filename: string) => {
    toast.info(`Sending ${filename} to cloud storage...`);
  };

  const showPreview = (filename: string) => {
    setPreviewFile(filename);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ready":
        return "bg-green-50 border-green-300 text-green-900";
      case "scanning":
        return "bg-blue-50 border-blue-300 text-blue-900";
      case "offline":
        return "bg-gray-50 border-gray-300 text-gray-900";
      default:
        return "bg-gray-50 border-gray-300";
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Scan className="w-6 h-6" />
          Scanner Hub
        </h2>
        <span className="text-sm text-gray-600">
          {scanners.filter((s) => s.status === "ready").length}/{scanners.length} Ready
        </span>
      </div>

      <div className="space-y-4">
        {scanners.map((scanner) => (
          <div key={scanner.id} className={`p-4 rounded-lg border-2 ${getStatusColor(scanner.status)}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-lg">{scanner.name}</h3>
                <p className="text-xs font-mono opacity-75">{scanner.ip}</p>
              </div>
              <span className="text-xs font-bold px-2 py-1 bg-white rounded uppercase">
                {scanner.status}
              </span>
            </div>

            {activeScanId === scanner.id && (
              <div className="mb-3 p-2 bg-white rounded">
                <div className="flex justify-between text-xs mb-1">
                  <span>Scanning...</span>
                  <span>{Math.round(scanProgress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              size="sm"
              onClick={() => startScan(scanner.id)}
              disabled={scanner.status !== "ready" || activeScanId === scanner.id}
              className="w-full mb-3 gap-2"
            >
              <Scan className="w-4 h-4" />
              {activeScanId === scanner.id ? "Scanning" : "Start Scan"}
            </Button>

            {scanner.lastScans.length > 0 && (
              <div className="space-y-2 bg-white bg-opacity-50 p-2 rounded">
                <p className="text-xs font-medium">Recent Scans</p>
                {scanner.lastScans.slice(0, 2).map((scan) => (
                  <div key={scan.id} className="flex items-center justify-between text-xs p-1 bg-white rounded">
                    <div>
                      <p className="font-mono">{scan.filename}</p>
                      <p className="opacity-75">{scan.pages} pages</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => showPreview(scan.filename)}
                        className="h-6 w-6 p-0"
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => sendToStorage(scan.filename)}
                        className="h-6 w-6 p-0"
                      >
                        <Upload className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {previewFile && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm">
            <span className="font-medium">Preview:</span> {previewFile}
          </p>
          <p className="text-xs text-gray-600 mt-1">Document preview would display here</p>
        </div>
      )}
    </div>
  );
}
