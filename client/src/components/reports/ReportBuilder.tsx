"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  GripVertical,
  BarChart2,
  PieChart,
  LineChart,
  Table as TableIcon,
  Download,
  Play,
  Save,
  Clock,
  FileText,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  reportsApi,
  type Report,
  type ReportExecution,
  type CreateReportRequest,
} from "@/lib/api/reports";

// ---------------------------------------------------------------------------
// Column config types
// ---------------------------------------------------------------------------

interface ReportColumn {
  id: string;
  field: string;
  label: string;
  type: "dimension" | "metric";
  aggregation?: "count" | "sum" | "avg" | "min" | "max";
}

interface ReportConfig {
  id: string;
  name: string;
  source: string;
  columns: ReportColumn[];
  chart: "table" | "bar" | "line" | "pie";
  filters: { field: string; operator: string; value: string }[];
}

// ---------------------------------------------------------------------------
// Data sources & field definitions
// ---------------------------------------------------------------------------

const SOURCES = [
  { value: "activities", label: "Activites" },
  { value: "users", label: "Utilisateurs" },
  { value: "files", label: "Fichiers" },
  { value: "calendar", label: "Evenements" },
  { value: "tasks", label: "Taches" },
  { value: "mail", label: "Emails" },
  { value: "forms", label: "Formulaires" },
  { value: "deals", label: "Deals" },
  { value: "tickets", label: "Tickets" },
];

const FIELDS: Record<
  string,
  { value: string; label: string; type: "dimension" | "metric" }[]
> = {
  activities: [
    { value: "entity_type", label: "Module", type: "dimension" },
    { value: "action", label: "Action", type: "dimension" },
    { value: "actor_id", label: "Utilisateur", type: "dimension" },
    { value: "created_at", label: "Date", type: "dimension" },
    { value: "count", label: "Nombre", type: "metric" },
  ],
  users: [
    { value: "role", label: "Role", type: "dimension" },
    { value: "group", label: "Groupe", type: "dimension" },
    { value: "status", label: "Statut", type: "dimension" },
    { value: "created_at", label: "Date inscription", type: "dimension" },
    { value: "count", label: "Nombre", type: "metric" },
  ],
  files: [
    { value: "mime_type", label: "Type de fichier", type: "dimension" },
    { value: "created_by", label: "Auteur", type: "dimension" },
    { value: "created_at", label: "Date", type: "dimension" },
    { value: "size", label: "Taille", type: "metric" },
    { value: "count", label: "Nombre", type: "metric" },
  ],
  calendar: [
    { value: "organizer", label: "Organisateur", type: "dimension" },
    { value: "event_type", label: "Type", type: "dimension" },
    { value: "start_time", label: "Date", type: "dimension" },
    { value: "count", label: "Nombre", type: "metric" },
  ],
  tasks: [
    { value: "status", label: "Statut", type: "dimension" },
    { value: "assignee", label: "Assigne", type: "dimension" },
    { value: "priority", label: "Priorite", type: "dimension" },
    { value: "completed_at", label: "Termine le", type: "dimension" },
    { value: "count", label: "Nombre", type: "metric" },
  ],
  mail: [
    { value: "from", label: "Expediteur", type: "dimension" },
    { value: "folder", label: "Dossier", type: "dimension" },
    { value: "date", label: "Date", type: "dimension" },
    { value: "count", label: "Nombre", type: "metric" },
  ],
  forms: [
    { value: "form_title", label: "Formulaire", type: "dimension" },
    { value: "submitted_at", label: "Date soumission", type: "dimension" },
    { value: "count", label: "Nombre de reponses", type: "metric" },
  ],
  deals: [
    { value: "stage", label: "Etape", type: "dimension" },
    { value: "owner", label: "Responsable", type: "dimension" },
    { value: "created_at", label: "Date", type: "dimension" },
    { value: "amount", label: "Montant", type: "metric" },
    { value: "count", label: "Nombre", type: "metric" },
  ],
  tickets: [
    { value: "status", label: "Statut", type: "dimension" },
    { value: "priority", label: "Priorite", type: "dimension" },
    { value: "assignee", label: "Assigne", type: "dimension" },
    { value: "created_at", label: "Date", type: "dimension" },
    { value: "count", label: "Nombre", type: "metric" },
  ],
};

const CHART_ICONS: Record<string, React.ReactNode> = {
  table: <TableIcon className="w-4 h-4" />,
  bar: <BarChart2 className="w-4 h-4" />,
  line: <LineChart className="w-4 h-4" />,
  pie: <PieChart className="w-4 h-4" />,
};

let idCounter = 1;
function newId() {
  return `col-${idCounter++}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatExecutionStatus(status: string) {
  switch (status) {
    case "completed":
      return {
        label: "Termine",
        className:
          "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      };
    case "running":
      return {
        label: "En cours",
        className:
          "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      };
    case "pending":
      return {
        label: "En attente",
        className:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      };
    case "failed":
      return {
        label: "Echoue",
        className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      };
    default:
      return { label: status, className: "bg-gray-100 text-gray-800" };
  }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportBuilder() {
  const queryClient = useQueryClient();

  // ---- Saved reports list ----
  const { data: savedReports = [], isLoading: reportsLoading } = useQuery<
    Report[]
  >({
    queryKey: ["reports"],
    queryFn: async () => {
      const res = await reportsApi.list();
      return res.data || [];
    },
  });

  // ---- Local builder state ----
  const [config, setConfig] = useState<ReportConfig>({
    id: "new",
    name: "Mon rapport",
    source: "activities",
    columns: [],
    chart: "table",
    filters: [],
  });
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<Record<string, unknown>[] | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState("builder");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // ---- Execution history for selected report ----
  const { data: executions = [], isLoading: executionsLoading } = useQuery<
    ReportExecution[]
  >({
    queryKey: ["report-executions", selectedReportId],
    queryFn: async () => {
      if (!selectedReportId) return [];
      const res = await reportsApi.getExecutions(selectedReportId);
      return res.data || [];
    },
    enabled: !!selectedReportId,
  });

  // ---- Column management ----
  const fields = FIELDS[config.source] || [];

  const addColumn = () => {
    if (!fields.length) return;
    setConfig((c) => ({
      ...c,
      columns: [
        ...c.columns,
        {
          id: newId(),
          field: fields[0].value,
          label: fields[0].label,
          type: fields[0].type,
          aggregation: fields[0].type === "metric" ? "count" : undefined,
        },
      ],
    }));
  };

  const updateCol = (id: string, update: Partial<ReportColumn>) => {
    setConfig((c) => ({
      ...c,
      columns: c.columns.map((col) =>
        col.id === id ? { ...col, ...update } : col,
      ),
    }));
  };

  const removeCol = (id: string) => {
    setConfig((c) => ({
      ...c,
      columns: c.columns.filter((col) => col.id !== id),
    }));
  };

  // ---- Save report ----
  const saveReport = async () => {
    if (!config.name.trim()) {
      toast.error("Donnez un nom a votre rapport");
      return;
    }
    if (!config.columns.length) {
      toast.error("Ajoutez au moins une colonne");
      return;
    }
    setSaving(true);
    try {
      const payload: CreateReportRequest = {
        name: config.name,
        report_type: config.source,
        query_config: {
          source: config.source,
          columns: config.columns,
          chart: config.chart,
          filters: config.filters,
        },
      };
      if (config.id !== "new") {
        await reportsApi.update(config.id, {
          name: payload.name,
          query_config: payload.query_config,
        });
        toast.success("Rapport mis a jour");
      } else {
        const res = await reportsApi.create(payload);
        setConfig((c) => ({ ...c, id: res.data.id }));
        setSelectedReportId(res.data.id);
        toast.success("Rapport sauvegarde");
      }
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    } catch (err) {
      toast.error("Erreur lors de la sauvegarde du rapport");
    } finally {
      setSaving(false);
    }
  };

  // ---- Execute report ----
  const runReport = async () => {
    if (!config.columns.length) {
      toast.error("Ajoutez au moins une colonne");
      return;
    }

    // If report is not saved yet, save first
    let reportId = config.id;
    if (reportId === "new") {
      setSaving(true);
      try {
        const payload: CreateReportRequest = {
          name: config.name,
          report_type: config.source,
          query_config: {
            source: config.source,
            columns: config.columns,
            chart: config.chart,
            filters: config.filters,
          },
        };
        const res = await reportsApi.create(payload);
        reportId = res.data.id;
        setConfig((c) => ({ ...c, id: reportId }));
        setSelectedReportId(reportId);
        queryClient.invalidateQueries({ queryKey: ["reports"] });
      } catch {
        toast.error("Erreur lors de la sauvegarde avant execution");
        setSaving(false);
        return;
      } finally {
        setSaving(false);
      }
    }

    setRunning(true);
    setResults(null);
    try {
      const execution = await reportsApi.execute(reportId);
      queryClient.invalidateQueries({
        queryKey: ["report-executions", reportId],
      });

      if (
        execution.data.status === "completed" &&
        execution.data.row_count !== undefined
      ) {
        toast.success(`Rapport execute : ${execution.data.row_count} lignes`);
      } else if (execution.data.status === "failed") {
        toast.error(execution.data.error || "Execution echouee");
      } else {
        toast.info(
          "Execution lancee. Consultez l'historique pour les resultats.",
        );
      }

      // Display column headers from config as placeholder result structure
      if (execution.data.status === "completed") {
        // Results would come from a separate download endpoint; show execution info
        setResults([]);
      }
    } catch {
      toast.error("Erreur lors de l'execution du rapport");
    } finally {
      setRunning(false);
    }
  };

  // ---- Delete report ----
  const deleteReport = async (id: string) => {
    try {
      await reportsApi.delete(id);
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      if (config.id === id) {
        setConfig({
          id: "new",
          name: "Mon rapport",
          source: "activities",
          columns: [],
          chart: "table",
          filters: [],
        });
        setSelectedReportId(null);
        setResults(null);
      }
      toast.success("Rapport supprime");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  // ---- Load saved report into builder ----
  const loadReport = (report: Report) => {
    const qc = report.query_config as {
      source?: string;
      columns?: ReportColumn[];
      chart?: ReportConfig["chart"];
      filters?: ReportConfig["filters"];
    };
    setConfig({
      id: report.id,
      name: report.name,
      source: qc.source || report.report_type,
      columns: qc.columns || [],
      chart: qc.chart || "table",
      filters: qc.filters || [],
    });
    setSelectedReportId(report.id);
    setResults(null);
    setActiveTab("builder");
  };

  // ---- New report ----
  const newReport = () => {
    setConfig({
      id: "new",
      name: "Mon rapport",
      source: "activities",
      columns: [],
      chart: "table",
      filters: [],
    });
    setSelectedReportId(null);
    setResults(null);
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="builder">
          <BarChart2 className="w-4 h-4 mr-1.5" />
          Constructeur
        </TabsTrigger>
        <TabsTrigger value="saved">
          <FileText className="w-4 h-4 mr-1.5" />
          Rapports sauvegardes
          {savedReports.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-xs">
              {savedReports.length}
            </Badge>
          )}
        </TabsTrigger>
        {selectedReportId && (
          <TabsTrigger value="history">
            <Clock className="w-4 h-4 mr-1.5" />
            Historique
          </TabsTrigger>
        )}
      </TabsList>

      {/* ================================================================== */}
      {/* Builder Tab                                                        */}
      {/* ================================================================== */}
      <TabsContent value="builder" className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            value={config.name}
            onChange={(e) => setConfig((c) => ({ ...c, name: e.target.value }))}
            className="w-48 h-8 text-sm font-medium"
            placeholder="Nom du rapport"
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs">Source</Label>
            <Select
              value={config.source}
              onValueChange={(v) =>
                setConfig((c) => ({ ...c, source: v, columns: [] }))
              }
            >
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-1">
            {(["table", "bar", "line", "pie"] as const).map((ct) => (
              <Button
                key={ct}
                size="sm"
                variant={config.chart === ct ? "default" : "outline"}
                onClick={() => setConfig((c) => ({ ...c, chart: ct }))}
                className="h-8 w-8 p-0"
                title={ct}
              >
                {CHART_ICONS[ct]}
              </Button>
            ))}
          </div>
          <div className="flex gap-2 ml-auto">
            {config.id !== "new" && (
              <Button
                size="sm"
                variant="outline"
                onClick={newReport}
                className="h-8"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Nouveau
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={saveReport}
              disabled={saving || !config.columns.length}
              className="h-8"
            >
              <Save
                className={`w-3.5 h-3.5 mr-1.5 ${saving ? "animate-pulse" : ""}`}
              />
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
            <Button
              size="sm"
              onClick={runReport}
              disabled={running || !config.columns.length}
              className="h-8"
            >
              <Play
                className={`w-3.5 h-3.5 mr-1.5 ${running ? "animate-pulse" : ""}`}
              />
              {running ? "Execution..." : "Executer"}
            </Button>
          </div>
        </div>

        {/* Column builder */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm flex items-center justify-between">
              Colonnes
              <Button
                size="sm"
                variant="outline"
                onClick={addColumn}
                className="h-6 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" /> Ajouter
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {config.columns.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-3">
                Ajoutez des colonnes pour construire votre rapport
              </p>
            )}
            <div className="space-y-2">
              {config.columns.map((col) => (
                <div
                  key={col.id}
                  className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20"
                >
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab shrink-0" />
                  <Badge
                    variant={col.type === "metric" ? "default" : "outline"}
                    className="text-xs shrink-0"
                  >
                    {col.type === "metric" ? "Metrique" : "Dimension"}
                  </Badge>
                  <Select
                    value={col.field}
                    onValueChange={(v) => {
                      const f = fields.find((f) => f.value === v);
                      if (f)
                        updateCol(col.id, {
                          field: v,
                          label: f.label,
                          type: f.type,
                        });
                    }}
                  >
                    <SelectTrigger className="h-6 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {col.type === "metric" && (
                    <Select
                      value={col.aggregation}
                      onValueChange={(v) =>
                        updateCol(col.id, {
                          aggregation: v as ReportColumn["aggregation"],
                        })
                      }
                    >
                      <SelectTrigger className="h-6 text-xs w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["count", "sum", "avg", "min", "max"].map((a) => (
                          <SelectItem key={a} value={a}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive"
                    onClick={() => removeCol(col.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Execution result */}
        {results !== null && results.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm flex items-center justify-between">
                Resultats ({results.length} lignes)
                <Button size="sm" variant="outline" className="h-6 text-xs">
                  <Download className="w-3 h-3 mr-1" /> Exporter CSV
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      {Object.keys(results[0]).map((k) => (
                        <th
                          key={k}
                          className="text-left p-1.5 font-medium text-muted-foreground"
                        >
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-muted/50 hover:bg-muted/30"
                      >
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="p-1.5">
                            {String(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {results !== null && results.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Rapport execute avec succes. Les resultats sont disponibles dans
                l&apos;historique d&apos;execution.
              </p>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* ================================================================== */}
      {/* Saved reports Tab                                                   */}
      {/* ================================================================== */}
      <TabsContent value="saved" className="space-y-4">
        {reportsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-1/3 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : savedReports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Aucun rapport sauvegarde</p>
              <p className="text-sm text-muted-foreground mt-1">
                Creez un rapport dans le constructeur puis sauvegardez-le.
              </p>
              <Button
                className="mt-4"
                onClick={() => {
                  newReport();
                  setActiveTab("builder");
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Creer un rapport
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {savedReports.map((report) => (
              <Card key={report.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="truncate">{report.name}</span>
                    <Badge variant="outline" className="text-xs shrink-0 ml-2">
                      {report.report_type}
                    </Badge>
                  </CardTitle>
                  {report.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {report.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex-1 pb-2">
                  <p className="text-xs text-muted-foreground">
                    Cree le {formatDate(report.created_at)}
                  </p>
                </CardContent>
                <div className="flex gap-2 p-3 pt-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs"
                    onClick={() => loadReport(report)}
                  >
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={async () => {
                      setSelectedReportId(report.id);
                      try {
                        await reportsApi.execute(report.id);
                        queryClient.invalidateQueries({
                          queryKey: ["report-executions", report.id],
                        });
                        toast.success("Execution lancee");
                      } catch {
                        toast.error("Erreur lors de l'execution");
                      }
                    }}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Executer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-destructive"
                    onClick={() => deleteReport(report.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      {/* ================================================================== */}
      {/* Execution history Tab                                              */}
      {/* ================================================================== */}
      {selectedReportId && (
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Historique d&apos;execution
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {executionsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : executions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Aucune execution pour ce rapport.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium text-muted-foreground">
                          Statut
                        </th>
                        <th className="text-left p-2 font-medium text-muted-foreground">
                          Format
                        </th>
                        <th className="text-left p-2 font-medium text-muted-foreground">
                          Lignes
                        </th>
                        <th className="text-left p-2 font-medium text-muted-foreground">
                          Lance le
                        </th>
                        <th className="text-left p-2 font-medium text-muted-foreground">
                          Termine le
                        </th>
                        <th className="text-left p-2 font-medium text-muted-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {executions.map((exec) => {
                        const st = formatExecutionStatus(exec.status);
                        return (
                          <tr
                            key={exec.id}
                            className="border-b border-muted/50 hover:bg-muted/30"
                          >
                            <td className="p-2">
                              <Badge className={`text-xs ${st.className}`}>
                                {st.label}
                              </Badge>
                            </td>
                            <td className="p-2 uppercase">{exec.format}</td>
                            <td className="p-2">{exec.row_count ?? "-"}</td>
                            <td className="p-2">
                              {formatDate(exec.started_at)}
                            </td>
                            <td className="p-2">
                              {exec.completed_at
                                ? formatDate(exec.completed_at)
                                : "-"}
                            </td>
                            <td className="p-2">
                              {exec.download_url &&
                                exec.status === "completed" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-xs"
                                    asChild
                                  >
                                    <a href={exec.download_url} download>
                                      <Download className="w-3 h-3 mr-1" />
                                      Telecharger
                                    </a>
                                  </Button>
                                )}
                              {exec.error && (
                                <span
                                  className="text-destructive text-xs"
                                  title={exec.error}
                                >
                                  <AlertCircle className="w-3 h-3 inline mr-1" />
                                  Erreur
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      )}
    </Tabs>
  );
}
