"use client";

import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Printer, QrCode } from "lucide-react";
import type { HardwareAsset } from "@/lib/api/it-assets";

interface AssetQrLabelProps {
  asset: HardwareAsset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssetQrLabel({ asset, open, onOpenChange }: AssetQrLabelProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const qrValue = JSON.stringify({
    id: asset.id,
    name: asset.name,
    serial: asset.serial_number ?? "",
  });

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank", "width=400,height=500");
    if (!win) return;
    win.document.write(`
      <html><head><title>Asset QR - ${asset.name}</title>
      <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}
      .label{border:2px solid #000;padding:16px;text-align:center;width:280px}
      h2{font-size:14px;margin:8px 0 4px}p{font-size:11px;margin:2px 0;color:#555}
      </style></head><body>
      <div class="label">${content.innerHTML}</div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            QR Label — {asset.name}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div
            ref={printRef}
            className="border-2 border-border rounded-lg p-4 text-center"
          >
            <QRCodeSVG value={qrValue} size={180} level="M" />
            <h2 className="font-semibold mt-2 text-sm">{asset.name}</h2>
            {asset.serial_number && (
              <p className="text-xs text-muted-foreground">
                SN: {asset.serial_number}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {asset.type} · {asset.location ?? "No location"}
            </p>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              {asset.id.slice(0, 12)}…
            </p>
          </div>
          <Button onClick={handlePrint} className="w-full">
            <Printer className="h-4 w-4 mr-2" />
            Print Label
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
