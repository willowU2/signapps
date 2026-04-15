"use client";

// CT3: LinkedIn CSV import — parse LinkedIn export and import into contacts

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { contactsApi, type Contact } from "@/lib/api/contacts";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Import,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";

// ── LinkedIn CSV column names ─────────────────────────────────────────────────

// LinkedIn exports these standard headers (may vary by locale/version):
const LINKEDIN_HEADER_ALIASES: Record<string, string> = {
  "first name": "first_name",
  firstname: "first_name",
  "last name": "last_name",
  lastname: "last_name",
  "email address": "email",
  email: "email",
  company: "organization",
  organization: "organization",
  position: "job_title",
  "job title": "job_title",
  "connected on": "connected_on",
};

// ── CSV parsing ───────────────────────────────────────────────────────────────

interface ParsedRow {
  first_name: string;
  last_name: string;
  email: string;
  organization: string;
  job_title: string;
  connected_on: string;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  return { headers, rows };
}

function mapToContacts(headers: string[], rows: string[][]): ParsedRow[] {
  const mapping: Record<number, string> = {};
  headers.forEach((h, i) => {
    const canonical = LINKEDIN_HEADER_ALIASES[h.toLowerCase().trim()];
    if (canonical) mapping[i] = canonical;
  });

  return rows
    .map((row) => {
      const entry: Partial<ParsedRow> = {};
      Object.entries(mapping).forEach(([idxStr, field]) => {
        const val = row[Number(idxStr)] ?? "";
        (entry as Record<string, string>)[field] = val;
      });
      return {
        first_name: entry.first_name ?? "",
        last_name: entry.last_name ?? "",
        email: entry.email ?? "",
        organization: entry.organization ?? "",
        job_title: entry.job_title ?? "",
        connected_on: entry.connected_on ?? "",
      };
    })
    .filter((r) => r.first_name || r.last_name || r.email);
}

// ── Column mapping editor ─────────────────────────────────────────────────────

const TARGET_FIELDS = [
  { value: "first_name", label: "Prénom" },
  { value: "last_name", label: "Nom" },
  { value: "email", label: "Email" },
  { value: "organization", label: "Entreprise" },
  { value: "job_title", label: "Poste" },
  { value: "ignore", label: "— Ignorer —" },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
}

interface LinkedInImportProps {
  onImported?: (count: number) => void;
}

export function LinkedInImport({ onImported }: LinkedInImportProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<Record<number, string>>({});
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState("");

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Veuillez sélectionner un fichier CSV.");
      return;
    }
    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0) {
        toast.error("Fichier CSV vide ou invalide.");
        return;
      }
      setCsvHeaders(headers);
      setCsvRows(rows);

      // Auto-map columns
      const autoMap: Record<number, string> = {};
      headers.forEach((h, i) => {
        const canonical = LINKEDIN_HEADER_ALIASES[h.toLowerCase().trim()];
        autoMap[i] = canonical ?? "ignore";
      });
      setColumnMap(autoMap);

      // Build preview from auto-mapped data
      const mapped = mapFromColumnMap(headers, rows, autoMap);
      setPreview(mapped);
    };
    reader.readAsText(file);
  };

  const mapFromColumnMap = (
    headers: string[],
    rows: string[][],
    map: Record<number, string>,
  ): ParsedRow[] => {
    return rows
      .map((row) => {
        const entry: Record<string, string> = {};
        headers.forEach((_h, i) => {
          const field = map[i];
          if (field && field !== "ignore") entry[field] = row[i] ?? "";
        });
        return {
          first_name: entry.first_name ?? "",
          last_name: entry.last_name ?? "",
          email: entry.email ?? "",
          organization: entry.organization ?? "",
          job_title: entry.job_title ?? "",
          connected_on: entry.connected_on ?? "",
        };
      })
      .filter((r) => r.first_name || r.last_name || r.email);
  };

  const updateColumnMap = (colIdx: number, field: string) => {
    const next = { ...columnMap, [colIdx]: field };
    setColumnMap(next);
    setPreview(mapFromColumnMap(csvHeaders, csvRows, next));
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    // Fetch existing contacts to detect duplicates by email
    let existingEmails = new Set<string>();
    try {
      const res = await contactsApi.list();
      existingEmails = new Set(
        (res.data ?? [])
          .map((c: Contact) => c.email?.toLowerCase())
          .filter((e): e is string => !!e),
      );
    } catch {
      // non-fatal, continue without dedup
    }

    for (const row of preview) {
      if (row.email && existingEmails.has(row.email.toLowerCase())) {
        skipped++;
        continue;
      }
      try {
        await contactsApi.create({
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email || undefined,
          organization: row.organization || undefined,
          job_title: row.job_title || undefined,
        });
        imported++;
        if (row.email) existingEmails.add(row.email.toLowerCase());
      } catch {
        failed++;
      }
    }

    setImporting(false);
    setResult({ imported, skipped, failed });
    onImported?.(imported);

    if (imported > 0) {
      toast.success(
        `${imported} contact${imported > 1 ? "s" : ""} importé${imported > 1 ? "s" : ""}.`,
      );
    }
    if (skipped > 0) {
      toast.info(
        `${skipped} doublon${skipped > 1 ? "s" : ""} ignoré${skipped > 1 ? "s" : ""}.`,
      );
    }
    if (failed > 0) {
      toast.error(`${failed} erreur${failed > 1 ? "s" : ""} lors de l'import.`);
    }
  };

  const reset = () => {
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMap({});
    setPreview([]);
    setResult(null);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {csvHeaders.length === 0 ? (
        <div
          className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Importer un export LinkedIn</p>
          <p className="text-xs text-muted-foreground mt-1">
            Glissez-déposez votre fichier CSV ou cliquez pour sélectionner
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Format:{" "}
            <span className="font-mono">
              First Name, Last Name, Email Address, Company, Position, Connected
              On
            </span>
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {fileName}
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  {csvRows.length} ligne{csvRows.length > 1 ? "s" : ""} ·{" "}
                  {preview.length} contact{preview.length > 1 ? "s" : ""} à
                  importer
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={reset}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Column mapping */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Correspondance des colonnes
              </p>
              <div className="grid grid-cols-2 gap-2">
                {csvHeaders.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className="font-mono text-muted-foreground truncate max-w-[100px]"
                      title={h}
                    >
                      {h}
                    </span>
                    <span className="text-muted-foreground shrink-0">→</span>
                    <Select
                      value={columnMap[i] ?? "ignore"}
                      onValueChange={(v) => updateColumnMap(i, v)}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TARGET_FIELDS.map((f) => (
                          <SelectItem
                            key={f.value}
                            value={f.value}
                            className="text-xs"
                          >
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview table */}
            {preview.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Aperçu ({Math.min(preview.length, 5)} sur {preview.length})
                </p>
                <ScrollArea className="max-h-40">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1 pr-2 font-medium text-muted-foreground">
                          Nom
                        </th>
                        <th className="text-left py-1 pr-2 font-medium text-muted-foreground">
                          Email
                        </th>
                        <th className="text-left py-1 font-medium text-muted-foreground">
                          Entreprise
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1 pr-2">
                            {row.first_name} {row.last_name}
                          </td>
                          <td className="py-1 pr-2 text-muted-foreground">
                            {row.email || "—"}
                          </td>
                          <td className="py-1 text-muted-foreground">
                            {row.organization || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="flex items-center gap-3 text-sm">
                {result.imported > 0 && (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" /> {result.imported}{" "}
                    importés
                  </span>
                )}
                {result.skipped > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {result.skipped} doublons ignorés
                  </Badge>
                )}
                {result.failed > 0 && (
                  <span className="flex items-center gap-1 text-destructive text-xs">
                    <AlertCircle className="h-3 w-3" /> {result.failed} erreurs
                  </span>
                )}
              </div>
            )}

            {/* Actions */}
            {!result && (
              <Button
                onClick={handleImport}
                disabled={importing || preview.length === 0}
                className="gap-2"
                size="sm"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Import className="h-4 w-4" />
                )}
                {importing
                  ? "Import en cours…"
                  : `Importer ${preview.length} contact${preview.length > 1 ? "s" : ""}`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
