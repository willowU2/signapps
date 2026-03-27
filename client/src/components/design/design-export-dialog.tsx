"use client";

import { useState } from "react";
import { useDesignStore } from "@/stores/design-store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  FileImage,
  FileText,
  FileCode,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExportFormat, ExportDPI } from "./types";

interface DesignExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fabricCanvasRef: React.MutableRefObject<any | null>;
}

const FORMAT_OPTIONS: { id: ExportFormat; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "png", label: "PNG", icon: <FileImage className="h-5 w-5" />, desc: "Transparent background support" },
  { id: "jpg", label: "JPG", icon: <ImageIcon className="h-5 w-5" />, desc: "Smaller file size" },
  { id: "pdf", label: "PDF", icon: <FileText className="h-5 w-5" />, desc: "Print-ready format" },
  { id: "svg", label: "SVG", icon: <FileCode className="h-5 w-5" />, desc: "Scalable vector format" },
];

// IDEA-062: DPI-aware export — resolution selector (72/150/300 DPI) in export dialog
const DPI_OPTIONS: { value: ExportDPI; label: string; desc: string }[] = [
  { value: 72, label: "72 DPI", desc: "Screen / Web" },
  { value: 150, label: "150 DPI", desc: "Digital / Medium" },
  { value: 300, label: "300 DPI", desc: "Print / High-res" },
];

export default function DesignExportDialog({ open, onOpenChange, fabricCanvasRef }: DesignExportDialogProps) {
  const { currentDesign } = useDesignStore();
  const [format, setFormat] = useState<ExportFormat>("png");
  const [quality, setQuality] = useState(90);
  const [dpi, setDpi] = useState<ExportDPI>(72);
  const [allPages, setAllPages] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !currentDesign) return;

    setExporting(true);

    try {
      const multiplier = dpi / 72;
      const name = currentDesign.name || "design";

      if (format === "svg") {
        const svgData = canvas.toSVG();
        downloadBlob(new Blob([svgData], { type: "image/svg+xml" }), `${name}.svg`);
      } else if (format === "png") {
        const dataUrl = canvas.toDataURL({
          format: "png",
          multiplier,
        });
        downloadDataUrl(dataUrl, `${name}.png`);
      } else if (format === "jpg") {
        const dataUrl = canvas.toDataURL({
          format: "jpeg",
          quality: quality / 100,
          multiplier,
        });
        downloadDataUrl(dataUrl, `${name}.jpg`);
      } else if (format === "pdf") {
        // For PDF, export as high-quality PNG (PDF generation would need jsPDF)
        const dataUrl = canvas.toDataURL({
          format: "png",
          multiplier,
        });
        downloadDataUrl(dataUrl, `${name}.png`);
      }

      onOpenChange(false);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Design
          </DialogTitle>
          <DialogDescription>
            Choose format and quality settings for your design.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Format */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Format</Label>
            <div className="grid grid-cols-4 gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setFormat(opt.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all text-center",
                    format === opt.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  {opt.icon}
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quality (JPG only) */}
          {format === "jpg" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Quality</Label>
                <span className="text-xs text-muted-foreground tabular-nums">{quality}%</span>
              </div>
              <Slider
                value={[quality]}
                min={60}
                max={100}
                step={5}
                onValueChange={([v]) => setQuality(v)}
              />
            </div>
          )}

          {/* DPI */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Resolution</Label>
            <div className="flex gap-2">
              {DPI_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDpi(opt.value)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-0.5 rounded-lg border-2 p-2.5 transition-all",
                    dpi === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Output size preview */}
          {currentDesign && (
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
              <span>Output size</span>
              <span className="font-medium tabular-nums">
                {Math.round(currentDesign.format.width * (dpi / 72))} x {Math.round(currentDesign.format.height * (dpi / 72))} px
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            <Download className="h-4 w-4" />
            {exporting ? "Exporting..." : "Download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  URL.revokeObjectURL(url);
}
