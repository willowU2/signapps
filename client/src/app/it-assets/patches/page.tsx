"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Search,
  RefreshCw,
  BarChart2,
  Server,
} from "lucide-react";
import { itAssetsApi, Patch } from "@/lib/api/it-assets";
import { usePageTitle } from "@/hooks/use-page-title";

// ─── Severity helpers ────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  critical: {
    label: "Critical",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: <ShieldAlert className="h-3 w-3" />,
  },
  important: {
    label: "Important",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  moderate: {
    label: "Moderate",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  low: {
    label: "Low",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <ShieldCheck className="h-3 w-3" />,
  },
  unknown: {
    label: "Unknown",
    color: "bg-gray-100 text-gray-700 border-gray-200",
    icon: <ShieldCheck className="h-3 w-3" />,
  },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Approved", color: "bg-blue-100 text-blue-800" },
  deployed: { label: "Deployed", color: "bg-purple-100 text-purple-800" },
  installed: { label: "Installed", color: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800" },
};

function SeverityBadge({ severity }: { severity?: string }) {
  const cfg = SEVERITY_CONFIG[severity ?? "unknown"] ?? SEVERITY_CONFIG.unknown;
  return (
    <Badge
      variant="outline"
      className={`flex items-center gap-1 text-xs ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e3).toFixed(1)} KB`;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PatchesPage() {
  usePageTitle("Patch Management");

  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const queryClient = useQueryClient();

  const {
    data: patches = [],
    isLoading: patchesLoading,
    refetch,
  } = useQuery({
    queryKey: ["patches"],
    queryFn: () => itAssetsApi.listPatches().then((r) => r.data),
    refetchInterval: 60_000,
  });

  const { data: compliance, isLoading: complianceLoading } = useQuery({
    queryKey: ["patch-compliance"],
    queryFn: () => itAssetsApi.patchCompliance().then((r) => r.data),
    refetchInterval: 60_000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => itAssetsApi.approvePatch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patches"] });
      queryClient.invalidateQueries({ queryKey: ["patch-compliance"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => itAssetsApi.rejectPatch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patches"] });
      queryClient.invalidateQueries({ queryKey: ["patch-compliance"] });
    },
  });

  const deployMutation = useMutation({
    mutationFn: (id: string) => itAssetsApi.deployPatch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patches"] });
    },
  });

  const filtered: Patch[] = useMemo(() => {
    return patches.filter((p) => {
      const matchesSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.kb_number?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        p.patch_id.toLowerCase().includes(search.toLowerCase());
      const matchesSeverity =
        severityFilter === "all" || p.severity === severityFilter;
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [patches, search, severityFilter, statusFilter]);

  const pendingCount = patches.filter((p) => p.status === "pending").length;
  const approvedCount = patches.filter((p) => p.status === "approved").length;
  const criticalCount = patches.filter(
    (p) =>
      p.severity === "critical" &&
      p.status !== "installed" &&
      p.status !== "rejected",
  ).length;

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Patch Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Review and deploy available patches across your fleet
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={patchesLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${patchesLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Compliance Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    Total Machines
                  </p>
                  <p className="text-2xl font-bold">
                    {complianceLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      (compliance?.total_machines ?? "—")
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Fully Patched</p>
                  <p className="text-2xl font-bold text-green-600">
                    {complianceLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      (compliance?.fully_patched ?? "—")
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    Critical Pending
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    {complianceLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      (compliance?.critical_pending ?? criticalCount)
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Compliance</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {complianceLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      `${(compliance?.compliance_pct ?? 0).toFixed(0)}%`
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Severity breakdown */}
        {compliance && compliance.by_severity.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending by Severity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {compliance.by_severity.map((s) => (
                  <div key={s.severity} className="flex items-center gap-2">
                    <SeverityBadge severity={s.severity} />
                    <span className="text-sm font-medium">{s.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search patches..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="important">Important</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="deployed">Deployed</SelectItem>
                  <SelectItem value="installed">Installed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  {pendingCount} pending, {approvedCount} approved
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patches Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>KB / Patch ID</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patchesLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Loading patches...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8">
                      <div className="flex flex-col items-center justify-center text-center">
                        <ShieldCheck className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-semibold">
                          {search ||
                          severityFilter !== "all" ||
                          statusFilter !== "all"
                            ? "Aucun correctif correspondant"
                            : "Flotte a jour"}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                          {search ||
                          severityFilter !== "all" ||
                          statusFilter !== "all"
                            ? "Aucun correctif ne correspond aux filtres actuels."
                            : "Aucun correctif en attente — tous les appareils sont a jour."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((patch) => {
                    const isActioning =
                      approveMutation.isPending ||
                      rejectMutation.isPending ||
                      deployMutation.isPending;

                    return (
                      <TableRow key={patch.id}>
                        <TableCell
                          className="font-medium max-w-[300px] truncate"
                          title={patch.title}
                        >
                          {patch.title}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {patch.kb_number ? (
                            <span className="font-mono">{patch.kb_number}</span>
                          ) : (
                            <span className="font-mono text-xs">
                              {patch.patch_id.slice(0, 12)}…
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={patch.severity} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {patch.category ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatBytes(patch.size_bytes)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={patch.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(patch.detected_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {patch.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
                                  disabled={isActioning}
                                  onClick={() =>
                                    approveMutation.mutate(patch.id)
                                  }
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                                  disabled={isActioning}
                                  onClick={() =>
                                    rejectMutation.mutate(patch.id)
                                  }
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}
                            {patch.status === "approved" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                                disabled={isActioning}
                                onClick={() => deployMutation.mutate(patch.id)}
                              >
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                Deploy
                              </Button>
                            )}
                            {(patch.status === "deployed" ||
                              patch.status === "installed" ||
                              patch.status === "rejected") && (
                              <span className="text-xs text-muted-foreground italic pr-2">
                                {patch.status === "installed"
                                  ? "Done"
                                  : patch.status === "rejected"
                                    ? "Rejected"
                                    : "In progress"}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
