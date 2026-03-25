"use client";

import { useState } from "react";
import { Download, FileText, FileSpreadsheet, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportFormat = "csv" | "json" | "xlsx" | "pdf";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Column headers to export */
  columns: string[];
  /** Row data to export */
  rows: string[][];
  /** Default filename (without extension) */
  defaultFilename?: string;
  /** Title shown in PDF header */
  title?: string;
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: React.ReactNode }[] = [
  { value: "csv", label: "CSV", icon: <FileText className="h-4 w-4" /> },
  { value: "json", label: "JSON", icon: <FileText className="h-4 w-4" /> },
  { value: "xlsx", label: "Excel (XLSX)", icon: <FileSpreadsheet className="h-4 w-4" /> },
  { value: "pdf", label: "PDF", icon: <FileImage className="h-4 w-4" /> },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ExportDialog({
  open,
  onOpenChange,
  columns,
  rows,
  defaultFilename = "export",
  title,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [filename, setFilename] = useState(defaultFilename);
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (columns.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/office/data/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, columns, rows, filename, title }),
      });

      if (!res.ok) {
        throw new Error(await res.text() || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.${format}`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Export ${format.toUpperCase()} téléchargé`);
      onOpenChange(false);
    } catch (err) {
      toast.error(`Erreur export: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exporter les données
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Summary */}
          <p className="text-sm text-muted-foreground">
            {rows.length} ligne(s) · {columns.length} colonne(s)
          </p>

          {/* Format picker */}
          <div className="space-y-1.5">
            <Label>Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      {opt.icon}
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filename */}
          <div className="space-y-1.5">
            <Label htmlFor="export-filename">Nom du fichier</Label>
            <div className="flex items-center gap-2">
              <Input
                id="export-filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="export"
              />
              <span className="text-sm text-muted-foreground">.{format}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? "Export…" : "Télécharger"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
