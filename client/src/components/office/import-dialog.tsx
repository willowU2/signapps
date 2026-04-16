"use client";

import { useState, useRef } from "react";
import { Upload, FileText, X, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportResult {
  format: string;
  row_count: number;
  columns: string[];
  rows: string[][];
  contacts: Array<{
    name: string;
    email?: string;
    phone?: string;
    organization?: string;
  }>;
  events: Array<{
    summary: string;
    dtstart?: string;
    dtend?: string;
    location?: string;
  }>;
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the parsed result when import succeeds */
  onImport?: (result: ImportResult) => void;
}

const ACCEPTED = ".csv,.json,.vcf,.vcard,.ics,.ical";
const FORMAT_LABELS: Record<string, string> = {
  csv: "CSV",
  json: "JSON",
  vcf: "vCard",
  ics: "iCal",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportDialog({
  open,
  onOpenChange,
  onImport,
}: ImportDialogProps) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setLoading(false);
  };

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/office/data/import", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data: ImportResult = await res.json();
      setResult(data);
      onImport?.(data);
      toast.success(
        `Importé ${data.row_count} entrée(s) — format ${FORMAT_LABELS[data.format] ?? data.format}`,
      );
    } catch (err) {
      toast.error(
        `Erreur import: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importer des données
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={[
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              dragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50",
            ].join(" ")}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) =>
                e.target.files?.[0] && handleFile(e.target.files[0])
              }
            />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm font-medium">
                <FileText className="h-5 w-5 text-primary" />
                {file.name}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    reset();
                  }}
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Glissez un fichier ou cliquez pour sélectionner
                </p>
                <p className="text-xs text-muted-foreground/70">
                  CSV, JSON, vCard (.vcf), iCal (.ics)
                </p>
              </div>
            )}
          </div>

          {/* Result preview */}
          {result && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Import réussi</span>
                <Badge variant="secondary">
                  {FORMAT_LABELS[result.format] ?? result.format}
                </Badge>
                <Badge variant="outline">{result.row_count} lignes</Badge>
              </div>
              {result.columns.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Colonnes : {result.columns.slice(0, 6).join(", ")}
                  {result.columns.length > 6 &&
                    ` +${result.columns.length - 6}`}
                </p>
              )}
              {result.contacts.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {result.contacts.length} contact(s) parsé(s)
                </p>
              )}
              {result.events.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {result.events.length} événement(s) parsé(s)
                </p>
              )}
            </div>
          )}

          {!result && file && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Le format sera détecté automatiquement
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || loading || !!result}
          >
            {loading ? "Import…" : result ? "Importé" : "Importer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
