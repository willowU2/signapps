"use client";

import { useState, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { usePageTitle } from "@/hooks/use-page-title";
import { toast } from "sonner";
import {
  Upload,
  Download,
  FileText,
  Users,
  CalendarDays,
  CheckSquare,
  HardDrive,
  Mail,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
  FileUp,
  FileDown,
  Package,
  X,
} from "lucide-react";
import { getClient, ServiceName } from "@/lib/api/factory";
import { storageApi } from "@/lib/api/storage";
import { calendarApi } from "@/lib/api/calendar";

// ─── Types ───────────────────────────────────────────────────────────────────

type WizardMode = "idle" | "import" | "export";
type ImportType = "contacts-csv" | "events-ics";
type ExportModule =
  | "contacts"
  | "events"
  | "tasks"
  | "files"
  | "documents"
  | "emails";

interface ImportPreview {
  fileName: string;
  fileSize: string;
  rowCount: number;
  columns?: string[];
  sampleRows?: string[][];
  errors?: string[];
}

interface ExportProgress {
  module: string;
  status: "pending" | "downloading" | "done" | "error";
  count?: number;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} Mo`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${bytes} o`;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === "," || char === ";") && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── Module icons ────────────────────────────────────────────────────────────

const MODULE_ICONS: Record<ExportModule, React.ReactNode> = {
  contacts: <Users className="h-5 w-5" />,
  events: <CalendarDays className="h-5 w-5" />,
  tasks: <CheckSquare className="h-5 w-5" />,
  files: <HardDrive className="h-5 w-5" />,
  documents: <FileText className="h-5 w-5" />,
  emails: <Mail className="h-5 w-5" />,
};

const MODULE_LABELS: Record<ExportModule, string> = {
  contacts: "Contacts",
  events: "Evenements",
  tasks: "Taches planifiees",
  files: "Fichiers",
  documents: "Documents",
  emails: "Emails",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ImportExportPage() {
  usePageTitle("Import / Export");

  const [mode, setMode] = useState<WizardMode>("idle");

  // Import state
  const [importType, setImportType] = useState<ImportType>("contacts-csv");
  const [importStep, setImportStep] = useState(0);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null
  );
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    errors: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export state
  const [exportStep, setExportStep] = useState(0);
  const [selectedModules, setSelectedModules] = useState<Set<ExportModule>>(
    new Set()
  );
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress[]>([]);

  // ── Import flow ────────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setImportFile(file);

      // Parse preview
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());

      if (importType === "contacts-csv") {
        const columns = parseCsvLine(lines[0] || "");
        const sampleRows = lines
          .slice(1, 6)
          .map((line) => parseCsvLine(line));
        const errors: string[] = [];

        // Validate columns
        const requiredCols = ["nom", "name", "email"];
        const hasRequired = columns.some((c) =>
          requiredCols.includes(c.toLowerCase())
        );
        if (!hasRequired) {
          errors.push(
            'Le fichier doit contenir au moins une colonne "Nom" ou "Email".'
          );
        }

        setImportPreview({
          fileName: file.name,
          fileSize: formatFileSize(file.size),
          rowCount: lines.length - 1,
          columns,
          sampleRows,
          errors: errors.length > 0 ? errors : undefined,
        });
      } else if (importType === "events-ics") {
        const eventCount = (text.match(/BEGIN:VEVENT/g) || []).length;
        const errors: string[] = [];
        if (!text.includes("BEGIN:VCALENDAR")) {
          errors.push(
            "Le fichier ne semble pas etre un fichier ICS valide."
          );
        }
        setImportPreview({
          fileName: file.name,
          fileSize: formatFileSize(file.size),
          rowCount: eventCount,
          errors: errors.length > 0 ? errors : undefined,
        });
      }

      setImportStep(1);
    },
    [importType]
  );

  const handleImportConfirm = useCallback(async () => {
    if (!importFile) return;
    setImporting(true);
    setImportStep(2);

    try {
      if (importType === "contacts-csv") {
        const text = await importFile.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const headers = parseCsvLine(lines[0] || "");

        const nameIdx = headers.findIndex(
          (h) =>
            h.toLowerCase() === "nom" ||
            h.toLowerCase() === "name" ||
            h.toLowerCase() === "prenom"
        );
        const emailIdx = headers.findIndex(
          (h) =>
            h.toLowerCase() === "email" ||
            h.toLowerCase() === "e-mail" ||
            h.toLowerCase() === "courriel"
        );
        const phoneIdx = headers.findIndex(
          (h) =>
            h.toLowerCase() === "telephone" ||
            h.toLowerCase() === "phone" ||
            h.toLowerCase() === "tel"
        );
        const companyIdx = headers.findIndex(
          (h) =>
            h.toLowerCase() === "entreprise" ||
            h.toLowerCase() === "company" ||
            h.toLowerCase() === "societe"
        );

        let success = 0;
        let errors = 0;
        const client = getClient(ServiceName.CONTACTS);

        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i]);
          const name = nameIdx >= 0 ? cols[nameIdx] : "";
          const email = emailIdx >= 0 ? cols[emailIdx] : "";
          if (!name && !email) {
            errors++;
            continue;
          }

          try {
            await client.post("/contacts", {
              id: crypto.randomUUID(),
              name: name || email.split("@")[0] || "Inconnu",
              email: email || "",
              phone: phoneIdx >= 0 ? cols[phoneIdx] : "",
              company: companyIdx >= 0 ? cols[companyIdx] : "",
              tags: [],
              favorite: false,
            });
            success++;
          } catch {
            errors++;
          }
        }

        setImportResult({ success, errors });
      } else if (importType === "events-ics") {
        // Upload ICS file to calendar service
        try {
          const calendarsRes = await calendarApi.listCalendars();
          const calendars = calendarsRes.data || [];
          let calendarId: string;

          if (calendars.length === 0) {
            const newCal = await calendarApi.createCalendar({
              name: "Import",
              color: "#3B82F6",
            });
            calendarId = (newCal.data as any)?.id;
          } else {
            calendarId = (calendars[0] as any)?.id;
          }

          // Parse ICS manually and create events
          const text = await importFile.text();
          const eventBlocks = text.split("BEGIN:VEVENT");
          let success = 0;
          let errors = 0;

          for (let i = 1; i < eventBlocks.length; i++) {
            const block = eventBlocks[i];
            const getField = (name: string) => {
              const match = block.match(new RegExp(`${name}[^:]*:(.+)`));
              return match ? match[1].trim() : "";
            };

            const summary = getField("SUMMARY");
            const dtstart = getField("DTSTART");
            const dtend = getField("DTEND");
            const description = getField("DESCRIPTION");
            const location = getField("LOCATION");

            if (!summary || !dtstart) {
              errors++;
              continue;
            }

            try {
              // Parse ICS date formats
              const parseIcsDate = (d: string) => {
                if (d.length === 8)
                  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00Z`;
                if (d.includes("T"))
                  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(9, 11)}:${d.slice(11, 13)}:${d.slice(13, 15)}Z`;
                return new Date().toISOString();
              };

              await calendarApi.createEvent(calendarId, {
                title: summary.replace(/\\n/g, " ").replace(/\\,/g, ","),
                description: description
                  .replace(/\\n/g, "\n")
                  .replace(/\\,/g, ","),
                location: location.replace(/\\,/g, ","),
                start_time: parseIcsDate(dtstart),
                end_time: dtend
                  ? parseIcsDate(dtend)
                  : parseIcsDate(dtstart),
                is_all_day: dtstart.length === 8,
              });
              success++;
            } catch {
              errors++;
            }
          }

          setImportResult({ success, errors });
        } catch {
          setImportResult({ success: 0, errors: 1 });
        }
      }
    } catch (err) {
      setImportResult({ success: 0, errors: 1 });
      toast.error("Erreur lors de l'import");
    } finally {
      setImporting(false);
    }
  }, [importFile, importType]);

  const resetImport = () => {
    setImportStep(0);
    setImportFile(null);
    setImportPreview(null);
    setImportResult(null);
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Export flow ────────────────────────────────────────────────────────────

  const toggleModule = (mod: ExportModule) => {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  };

  const selectAllModules = () => {
    setSelectedModules(
      new Set<ExportModule>([
        "contacts",
        "events",
        "tasks",
        "files",
        "documents",
        "emails",
      ])
    );
  };

  const handleExportStart = useCallback(async () => {
    if (selectedModules.size === 0) return;
    setExporting(true);
    setExportStep(1);

    const modules = Array.from(selectedModules);
    const progress: ExportProgress[] = modules.map((m) => ({
      module: m,
      status: "pending",
    }));
    setExportProgress([...progress]);

    const exportedFiles: { name: string; blob: Blob }[] = [];

    for (let i = 0; i < modules.length; i++) {
      const mod = modules[i];
      progress[i] = { ...progress[i], status: "downloading" };
      setExportProgress([...progress]);

      try {
        let data: string = "";
        let count = 0;

        switch (mod) {
          case "contacts": {
            try {
              const client = getClient(ServiceName.CONTACTS);
              const res = await client.get<any[]>("/contacts");
              const contacts = res.data || [];
              count = contacts.length;
              const header = "Nom,Email,Telephone,Entreprise,Tags";
              const rows = contacts.map(
                (c: any) =>
                  [
                    c.name || "",
                    c.email || "",
                    c.phone || "",
                    c.company || "",
                    (c.tags || []).join("; "),
                  ]
                    .map((v: string) => `"${v.replace(/"/g, '""')}"`)
                    .join(",")
              );
              data = [header, ...rows].join("\n");
              exportedFiles.push({
                name: "contacts.csv",
                blob: new Blob([data], {
                  type: "text/csv;charset=utf-8;",
                }),
              });
            } catch {
              throw new Error("Service contacts indisponible");
            }
            break;
          }
          case "events": {
            try {
              const calRes = await calendarApi.listCalendars();
              const calendars = calRes.data || [];
              if (calendars.length === 0) throw new Error("Aucun calendrier");

              const now = new Date();
              const start = new Date(now.getFullYear() - 1, 0, 1);
              const end = new Date(now.getFullYear() + 1, 11, 31);
              const evRes = await calendarApi.listEvents(
                (calendars[0] as any).id,
                start,
                end
              );
              const events = evRes.data || [];
              count = events.length;

              // Build ICS
              let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SignApps//Export//FR\r\n";
              for (const ev of events as any[]) {
                const formatIcs = (d: string) =>
                  d.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
                ics += `BEGIN:VEVENT\r\n`;
                ics += `SUMMARY:${(ev.title || "").replace(/,/g, "\\,")}\r\n`;
                if (ev.description)
                  ics += `DESCRIPTION:${ev.description.replace(/\n/g, "\\n").replace(/,/g, "\\,")}\r\n`;
                if (ev.location)
                  ics += `LOCATION:${ev.location.replace(/,/g, "\\,")}\r\n`;
                ics += `DTSTART:${formatIcs(ev.start_time || new Date().toISOString())}\r\n`;
                if (ev.end_time)
                  ics += `DTEND:${formatIcs(ev.end_time)}\r\n`;
                ics += `END:VEVENT\r\n`;
              }
              ics += "END:VCALENDAR\r\n";

              exportedFiles.push({
                name: "events.ics",
                blob: new Blob([ics], { type: "text/calendar;charset=utf-8" }),
              });
            } catch (err) {
              throw err;
            }
            break;
          }
          case "tasks": {
            try {
              const { schedulerApi } = await import("@/lib/api");
              const res = await schedulerApi.listJobs();
              const jobs = res.data || [];
              count = (jobs as any[]).length;
              const header =
                "Nom,Description,Planification,Commande,Type Cible,Active,Dernier Statut";
              const rows = (jobs as any[]).map(
                (j) =>
                  [
                    j.name || "",
                    j.description || "",
                    j.cron_expression || "",
                    j.command || "",
                    j.target_type || "",
                    j.enabled ? "Oui" : "Non",
                    j.last_status || "-",
                  ]
                    .map((v: string) => `"${v.replace(/"/g, '""')}"`)
                    .join(",")
              );
              data = [header, ...rows].join("\n");
              exportedFiles.push({
                name: "tasks.csv",
                blob: new Blob([data], {
                  type: "text/csv;charset=utf-8;",
                }),
              });
            } catch {
              throw new Error("Service scheduler indisponible");
            }
            break;
          }
          case "files": {
            try {
              const res = await storageApi.listFiles("default", "");
              const files = res.data?.objects || [];
              count = files.length;
              const header = "Nom,Cle,Type,Taille";
              const rows = files.map(
                (f: any) =>
                  [
                    f.name || f.key?.split("/").pop() || "",
                    f.key || "",
                    f.mime_type || f.content_type || "",
                    String(f.size || 0),
                  ]
                    .map((v: string) => `"${v.replace(/"/g, '""')}"`)
                    .join(",")
              );
              data = [header, ...rows].join("\n");
              exportedFiles.push({
                name: "files.csv",
                blob: new Blob([data], {
                  type: "text/csv;charset=utf-8;",
                }),
              });
            } catch {
              throw new Error("Service storage indisponible");
            }
            break;
          }
          case "documents": {
            try {
              const client = getClient(ServiceName.DOCS);
              const res = await client.get<any[]>("/documents");
              const docs = Array.isArray(res.data) ? res.data : [];
              count = docs.length;
              const header = "Titre,Contenu,Date de modification";
              const rows = docs.map(
                (d: any) =>
                  [
                    d.title || "",
                    (d.content || "").substring(0, 500),
                    d.updated_at || "",
                  ]
                    .map((v: string) => `"${v.replace(/"/g, '""')}"`)
                    .join(",")
              );
              data = [header, ...rows].join("\n");
              exportedFiles.push({
                name: "documents.csv",
                blob: new Blob([data], {
                  type: "text/csv;charset=utf-8;",
                }),
              });
            } catch {
              throw new Error("Service docs indisponible");
            }
            break;
          }
          case "emails": {
            try {
              const client = getClient(ServiceName.MAIL);
              const res = await client.get<{ messages: any[] }>("/messages", {
                params: { limit: 500 },
              });
              const messages = res.data?.messages || [];
              count = messages.length;
              const header = "Sujet,Expediteur,Date,Extrait";
              const rows = messages.map(
                (m: any) =>
                  [
                    m.subject || "",
                    m.from_address || "",
                    m.date || "",
                    (m.snippet || "").substring(0, 200),
                  ]
                    .map((v: string) => `"${v.replace(/"/g, '""')}"`)
                    .join(",")
              );
              data = [header, ...rows].join("\n");
              exportedFiles.push({
                name: "emails.csv",
                blob: new Blob([data], {
                  type: "text/csv;charset=utf-8;",
                }),
              });
            } catch {
              throw new Error("Service mail indisponible");
            }
            break;
          }
        }

        progress[i] = { module: mod, status: "done", count };
      } catch (err: any) {
        progress[i] = {
          module: mod,
          status: "error",
          error: err?.message || "Erreur",
        };
      }
      setExportProgress([...progress]);
    }

    // Create ZIP-like download (individual files for simplicity, or bundled)
    if (exportedFiles.length === 1) {
      // Single file: download directly
      const url = URL.createObjectURL(exportedFiles[0].blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exportedFiles[0].name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } else if (exportedFiles.length > 1) {
      // Multiple files: download each
      for (const ef of exportedFiles) {
        const url = URL.createObjectURL(ef.blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `signapps-export-${ef.name}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        // Small delay between downloads
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    setExporting(false);
    setExportStep(2);
    toast.success(
      `Export termine: ${exportedFiles.length} fichier(s) telecharge(s)`
    );
  }, [selectedModules]);

  const resetExport = () => {
    setExportStep(0);
    setSelectedModules(new Set());
    setExportProgress([]);
    setExporting(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Package className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Import / Export
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Importez ou exportez vos donnees en masse.
            </p>
          </div>
        </div>

        {/* Mode selection */}
        {mode === "idle" && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card
              className="cursor-pointer border-border/50 transition-all hover:border-primary/40 hover:shadow-md group"
              onClick={() => setMode("import")}
            >
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 mb-4 group-hover:scale-110 transition-transform">
                  <FileUp className="h-8 w-8 text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold">Importer des donnees</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                  Importez des contacts depuis un fichier CSV ou des evenements
                  depuis un fichier ICS.
                </p>
                <div className="flex gap-2 mt-4">
                  <Badge variant="secondary">CSV</Badge>
                  <Badge variant="secondary">ICS</Badge>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer border-border/50 transition-all hover:border-primary/40 hover:shadow-md group"
              onClick={() => setMode("export")}
            >
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 mb-4 group-hover:scale-110 transition-transform">
                  <FileDown className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold">Exporter des donnees</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                  Exportez vos donnees par module : contacts, evenements,
                  taches, fichiers, documents, emails.
                </p>
                <div className="flex gap-2 mt-4">
                  <Badge variant="secondary">CSV</Badge>
                  <Badge variant="secondary">ICS</Badge>
                  <Badge variant="secondary">Multi-fichiers</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── IMPORT WIZARD ────────────────────────────────────────────────────── */}
        {mode === "import" && (
          <div className="space-y-6">
            <Button
              variant="ghost"
              onClick={() => {
                setMode("idle");
                resetImport();
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>

            {/* Step indicators */}
            <div className="flex items-center gap-2">
              {["Type & Fichier", "Apercu", "Resultat"].map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                      i < importStep
                        ? "bg-primary text-primary-foreground"
                        : i === importStep
                          ? "bg-primary/20 text-primary border-2 border-primary"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i < importStep ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`text-sm ${i === importStep ? "font-medium" : "text-muted-foreground"}`}
                  >
                    {label}
                  </span>
                  {i < 2 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground mx-1" />
                  )}
                </div>
              ))}
            </div>

            {/* Step 0: Choose type and file */}
            {importStep === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Choisir le type d&apos;import</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card
                      className={`cursor-pointer transition-all ${
                        importType === "contacts-csv"
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-primary/30"
                      }`}
                      onClick={() => setImportType("contacts-csv")}
                    >
                      <CardContent className="flex items-center gap-4 p-4">
                        <Users className="h-8 w-8 text-green-500" />
                        <div>
                          <p className="font-medium">Contacts (CSV)</p>
                          <p className="text-sm text-muted-foreground">
                            Fichier CSV avec colonnes Nom, Email, Telephone,
                            Entreprise
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card
                      className={`cursor-pointer transition-all ${
                        importType === "events-ics"
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-primary/30"
                      }`}
                      onClick={() => setImportType("events-ics")}
                    >
                      <CardContent className="flex items-center gap-4 p-4">
                        <CalendarDays className="h-8 w-8 text-purple-500" />
                        <div>
                          <p className="font-medium">Evenements (ICS)</p>
                          <p className="text-sm text-muted-foreground">
                            Fichier iCalendar (.ics) pour import dans le
                            calendrier
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="import-file">
                      Selectionner le fichier
                    </Label>
                    <Input
                      ref={fileInputRef}
                      id="import-file"
                      type="file"
                      accept={
                        importType === "contacts-csv" ? ".csv,.txt" : ".ics"
                      }
                      onChange={handleFileSelect}
                    />
                    <p className="text-xs text-muted-foreground">
                      {importType === "contacts-csv"
                        ? "Formats acceptes: CSV (separateur virgule ou point-virgule)"
                        : "Format accepte: iCalendar (.ics)"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 1: Preview */}
            {importStep === 1 && importPreview && (
              <Card>
                <CardHeader>
                  <CardTitle>Apercu de l&apos;import</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 text-sm">
                    <Badge variant="outline">
                      {importPreview.fileName}
                    </Badge>
                    <span className="text-muted-foreground">
                      {importPreview.fileSize}
                    </span>
                    <span className="text-muted-foreground">
                      {importPreview.rowCount}{" "}
                      {importType === "contacts-csv"
                        ? "contacts"
                        : "evenements"}
                    </span>
                  </div>

                  {importPreview.errors && importPreview.errors.length > 0 && (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3">
                      <div className="flex items-center gap-2 text-destructive text-sm font-medium mb-1">
                        <AlertCircle className="h-4 w-4" />
                        Avertissements
                      </div>
                      {importPreview.errors.map((err, i) => (
                        <p
                          key={i}
                          className="text-sm text-destructive/80 ml-6"
                        >
                          {err}
                        </p>
                      ))}
                    </div>
                  )}

                  {importPreview.columns && (
                    <div>
                      <p className="text-sm font-medium mb-2">Colonnes detectees:</p>
                      <div className="flex gap-2 flex-wrap">
                        {importPreview.columns.map((col, i) => (
                          <Badge key={i} variant="secondary">
                            {col}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {importPreview.sampleRows &&
                    importPreview.sampleRows.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">
                          Apercu des donnees (5 premieres lignes):
                        </p>
                        <div className="overflow-x-auto rounded-lg border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                {importPreview.columns?.map((col, i) => (
                                  <th
                                    key={i}
                                    className="px-3 py-2 text-left font-medium text-muted-foreground"
                                  >
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {importPreview.sampleRows.map((row, ri) => (
                                <tr key={ri} className="border-b last:border-0">
                                  {row.map((cell, ci) => (
                                    <td
                                      key={ci}
                                      className="px-3 py-2 truncate max-w-[200px]"
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={resetImport}>
                      Annuler
                    </Button>
                    <Button
                      onClick={handleImportConfirm}
                      disabled={
                        !!(
                          importPreview.errors &&
                          importPreview.errors.length > 0
                        )
                      }
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Importer {importPreview.rowCount}{" "}
                      {importType === "contacts-csv"
                        ? "contacts"
                        : "evenements"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Progress/Result */}
            {importStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {importing ? "Import en cours..." : "Import termine"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {importing ? (
                    <div className="flex flex-col items-center py-8">
                      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                      <p className="text-muted-foreground">
                        Import en cours, veuillez patienter...
                      </p>
                    </div>
                  ) : importResult ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                          <Check className="h-6 w-6 text-green-500" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {importResult.success} element(s) importe(s) avec
                            succes
                          </p>
                          {importResult.errors > 0 && (
                            <p className="text-sm text-destructive">
                              {importResult.errors} erreur(s) lors de l&apos;import
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={resetImport}>
                          Nouvel import
                        </Button>
                        <Button
                          onClick={() => {
                            setMode("idle");
                            resetImport();
                          }}
                        >
                          Termine
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── EXPORT WIZARD ────────────────────────────────────────────────────── */}
        {mode === "export" && (
          <div className="space-y-6">
            <Button
              variant="ghost"
              onClick={() => {
                setMode("idle");
                resetExport();
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>

            {/* Step indicators */}
            <div className="flex items-center gap-2">
              {["Selection", "Telechargement", "Termine"].map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                      i < exportStep
                        ? "bg-primary text-primary-foreground"
                        : i === exportStep
                          ? "bg-primary/20 text-primary border-2 border-primary"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i < exportStep ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`text-sm ${i === exportStep ? "font-medium" : "text-muted-foreground"}`}
                  >
                    {label}
                  </span>
                  {i < 2 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground mx-1" />
                  )}
                </div>
              ))}
            </div>

            {/* Step 0: Select modules */}
            {exportStep === 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Choisir les modules a exporter</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllModules}
                    >
                      Tout selectionner
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {(
                      Object.keys(MODULE_LABELS) as ExportModule[]
                    ).map((mod) => (
                      <Card
                        key={mod}
                        className={`cursor-pointer transition-all ${
                          selectedModules.has(mod)
                            ? "border-primary bg-primary/5"
                            : "border-border/50 hover:border-primary/30"
                        }`}
                        onClick={() => toggleModule(mod)}
                      >
                        <CardContent className="flex items-center gap-3 p-4">
                          <Checkbox
                            checked={selectedModules.has(mod)}
                            onCheckedChange={() => toggleModule(mod)}
                          />
                          <span className="text-primary">
                            {MODULE_ICONS[mod]}
                          </span>
                          <span className="font-medium text-sm">
                            {MODULE_LABELS[mod]}
                          </span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      onClick={handleExportStart}
                      disabled={selectedModules.size === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Exporter {selectedModules.size} module(s)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 1: Download progress */}
            {exportStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {exporting ? "Export en cours..." : "Export termine"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {exportProgress.map((p) => (
                    <div
                      key={p.module}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <span className="text-primary">
                        {MODULE_ICONS[p.module as ExportModule]}
                      </span>
                      <span className="font-medium text-sm flex-1">
                        {MODULE_LABELS[p.module as ExportModule]}
                      </span>
                      {p.status === "pending" && (
                        <Badge variant="secondary">En attente</Badge>
                      )}
                      {p.status === "downloading" && (
                        <Badge className="bg-blue-500/10 text-blue-600 gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Telechargement
                        </Badge>
                      )}
                      {p.status === "done" && (
                        <Badge className="bg-green-500/10 text-green-600 gap-1">
                          <Check className="h-3 w-3" />
                          {p.count !== undefined
                            ? `${p.count} element(s)`
                            : "OK"}
                        </Badge>
                      )}
                      {p.status === "error" && (
                        <Badge variant="destructive" className="gap-1">
                          <X className="h-3 w-3" />
                          {p.error || "Erreur"}
                        </Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Step 2: Done */}
            {exportStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Export termine</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                      <Check className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {
                          exportProgress.filter((p) => p.status === "done")
                            .length
                        }{" "}
                        module(s) exporte(s) avec succes
                      </p>
                      {exportProgress.some((p) => p.status === "error") && (
                        <p className="text-sm text-destructive">
                          {
                            exportProgress.filter(
                              (p) => p.status === "error"
                            ).length
                          }{" "}
                          erreur(s)
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="space-y-2">
                    {exportProgress.map((p) => (
                      <div
                        key={p.module}
                        className="flex items-center gap-2 text-sm"
                      >
                        {p.status === "done" ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4 text-destructive" />
                        )}
                        <span>
                          {MODULE_LABELS[p.module as ExportModule]}
                        </span>
                        {p.count !== undefined && (
                          <span className="text-muted-foreground">
                            ({p.count} elements)
                          </span>
                        )}
                        {p.error && (
                          <span className="text-destructive">{p.error}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={resetExport}>
                      Nouvel export
                    </Button>
                    <Button
                      onClick={() => {
                        setMode("idle");
                        resetExport();
                      }}
                    >
                      Termine
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
