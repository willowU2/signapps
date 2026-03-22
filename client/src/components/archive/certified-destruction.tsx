"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Download, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ItemForDestruction {
  id: string;
  name: string;
  size: number;
  archivedDate: Date;
}

interface DestructionCertificate {
  certificateId: string;
  issueDate: Date;
  itemCount: number;
  totalSize: number;
  status: "pending" | "completed";
}

export function CertifiedDestruction() {
  const [items, setItems] = useState<ItemForDestruction[]>([]);
  const [certificate, setCertificate] = useState<DestructionCertificate | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setItems([
      { id: "d1", name: "Temp_Cache_2022.tmp", size: 5.2, archivedDate: new Date(Date.now() - 365 * 24 * 3600000) },
      { id: "d2", name: "LogArchive_Old.zip", size: 12.8, archivedDate: new Date(Date.now() - 300 * 24 * 3600000) },
      { id: "d3", name: "BackupFile_2021.bak", size: 34.5, archivedDate: new Date(Date.now() - 400 * 24 * 3600000) },
    ]);
  }, []);

  const formatSize = (mb: number) => {
    if (mb > 1024) return (mb / 1024).toFixed(1) + " GB";
    return mb.toFixed(1) + " MB";
  };

  const totalSize = items.reduce((sum, item) => sum + item.size, 0);

  const handleDestroy = () => {
    if (confirmed) {
      setCertificate({
        certificateId: `CERT-${Date.now()}`,
        issueDate: new Date(),
        itemCount: items.length,
        totalSize,
        status: "completed",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-2 border-red-400 rounded-lg p-4 bg-red-50">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 mb-1">Permanent Destruction</h3>
            <p className="text-sm text-red-800">
              This action will permanently delete the selected items. This cannot be undone. A certified destruction certificate will be generated.
            </p>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-3">Items to Destroy</h3>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-gray-600">
                  {formatSize(item.size)} • Archived: {item.archivedDate.toLocaleDateString()}
                </p>
              </div>
              <span className="text-sm font-medium text-gray-700">{formatSize(item.size)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-gray-100 rounded font-semibold text-right">
          Total: {formatSize(totalSize)}
        </div>
      </div>

      {certificate && certificate.status === "completed" && (
        <div className="border-2 border-green-400 rounded-lg p-4 bg-green-50">
          <div className="flex items-start space-x-3 mb-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-900">Destruction Completed</h3>
              <p className="text-sm text-green-800 mt-1">
                Certificate ID: <span className="font-mono">{certificate.certificateId}</span>
              </p>
            </div>
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Download Certificate
          </Button>
        </div>
      )}

      {!certificate && (
        <>
          <div className="border rounded-lg p-4">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm">
                I understand that destroying these files is <strong>permanent</strong> and cannot be undone.
                A destruction certificate will be issued for compliance purposes.
              </span>
            </label>
          </div>

          <div className="border rounded-lg p-4 bg-yellow-50">
            <h3 className="font-semibold mb-2">Destruction Certificate Preview</h3>
            <div className="bg-white border rounded p-4 text-sm space-y-1 font-mono">
              <p>Certificate ID: CERT-PENDING</p>
              <p>Item Count: {items.length}</p>
              <p>Total Size: {formatSize(totalSize)}</p>
              <p>Issue Date: {new Date().toLocaleString()}</p>
              <p>Status: PENDING CONFIRMATION</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleDestroy} disabled={!confirmed} variant="destructive">
              Confirm Destruction
            </Button>
            <Button variant="outline">Cancel</Button>
          </div>
        </>
      )}
    </div>
  );
}
