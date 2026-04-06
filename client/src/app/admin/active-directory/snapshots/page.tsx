"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  HardDrive,
  Plus,
  RefreshCw,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Eye,
} from "lucide-react";
import { adApi } from "@/lib/api/active-directory";
import { useAdDomains } from "@/hooks/use-active-directory";
import { toast } from "sonner";
import type { AdSnapshot, SnapshotPreview } from "@/types/active-directory";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes?: number): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

function truncateChecksum(checksum?: string): string {
  if (!checksum) return "—";
  return checksum.length > 16 ? `${checksum.slice(0, 16)}…` : checksum;
}

const SNAPSHOT_TYPE_COLORS: Record<string, string> = {
  full: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  incremental:
    "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
};

const SNAPSHOT_TYPE_LABELS: Record<string, string> = {
  full: "Complet",
  incremental: "Incrementiel",
};

const SNAPSHOT_STATUS_COLORS: Record<string, string> = {
  pending:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  completed:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  failed:
    "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  restoring:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
};

const SNAPSHOT_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  completed: "Termine",
  failed: "Echec",
  restoring: "Restauration",
};

function SnapshotTypeBadge({ type }: { type: string }) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-medium ${SNAPSHOT_TYPE_COLORS[type] ?? "bg-muted text-muted-foreground"}`}
    >
      {SNAPSHOT_TYPE_LABELS[type] ?? type}
    </Badge>
  );
}

function SnapshotStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-medium ${SNAPSHOT_STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {SNAPSHOT_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

// ── Restore Dialog ─────────────────────────────────────────────────────────────

interface RestoreDialogProps {
  snapshot: AdSnapshot | null;
  onClose: () => void;
  onRestored: () => void;
}

function RestoreDialog({ snapshot, onClose, onRestored }: RestoreDialogProps) {
  const [targetDn, setTargetDn] = useState("");
  const [includeChildren, setIncludeChildren] = useState(true);
  const [preview, setPreview] = useState<SnapshotPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!snapshot) {
      setTargetDn("");
      setIncludeChildren(true);
      setPreview(null);
    }
  }, [snapshot]);

  if (!snapshot) return null;

  async function handlePreview() {
    if (!snapshot) return;
    setPreviewing(true);
    try {
      const res = await adApi.sync.restorePreview(snapshot.id, {
        ...(targetDn.trim() ? { target_dn: targetDn.trim() } : {}),
        include_children: includeChildren,
      });
      setPreview(res.data);
    } catch {
      toast.error("Impossible de generer l'apercu de restauration");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleRestore() {
    if (!snapshot) return;
    setRestoring(true);
    try {
      await adApi.sync.restoreExecute(snapshot.id, {
        ...(targetDn.trim() ? { target_dn: targetDn.trim() } : {}),
        include_children: includeChildren,
      });
      toast.success("Restauration initiee avec succes");
      onRestored();
      onClose();
    } catch {
      toast.error("Echec de la restauration");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Dialog open={!!snapshot} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Restaurer le snapshot</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <SnapshotTypeBadge type={snapshot.snapshot_type} />
              <span className="text-muted-foreground">
                {formatDate(snapshot.created_at)}
              </span>
              <span className="text-muted-foreground">
                {formatBytes(snapshot.size_bytes)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="restore-dn">DN cible (optionnel)</Label>
            <Input
              id="restore-dn"
              placeholder="OU=DRH,DC=corp,DC=local"
              value={targetDn}
              onChange={(e) => setTargetDn(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Laisser vide pour restaurer depuis la racine du domaine.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="restore-children"
              checked={includeChildren}
              onCheckedChange={(v) => setIncludeChildren(!!v)}
            />
            <Label
              htmlFor="restore-children"
              className="text-sm font-normal cursor-pointer"
            >
              Inclure les objets enfants
            </Label>
          </div>

          {/* Preview results */}
          {preview && (
            <div className="rounded-md border border-border bg-muted/50 p-3 space-y-1 text-sm">
              <p className="font-medium mb-2">Apercu de la restauration</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                <span>OUs a creer</span>
                <span className="font-mono tabular-nums text-foreground">
                  {preview.ous_to_create}
                </span>
                <span>OUs a mettre a jour</span>
                <span className="font-mono tabular-nums text-foreground">
                  {preview.ous_to_update}
                </span>
                <span>Utilisateurs a creer</span>
                <span className="font-mono tabular-nums text-foreground">
                  {preview.users_to_create}
                </span>
                <span>Utilisateurs a mettre a jour</span>
                <span className="font-mono tabular-nums text-foreground">
                  {preview.users_to_update}
                </span>
                <span>Utilisateurs a supprimer</span>
                <span className="font-mono tabular-nums text-destructive">
                  {preview.users_to_delete}
                </span>
              </div>
              {preview.details.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground max-h-28 overflow-y-auto">
                  {preview.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={previewing || restoring}
          >
            Annuler
          </Button>
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={previewing || restoring}
          >
            {previewing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            Apercu
          </Button>
          <Button onClick={handleRestore} disabled={restoring || previewing}>
            {restoring ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Restaurer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function SnapshotsPage() {
  usePageTitle("Sauvegardes — Active Directory");

  const [domainId, setDomainId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<"full" | "incremental">("full");
  const [creating, setCreating] = useState(false);
  const [restoreSnapshot, setRestoreSnapshot] = useState<AdSnapshot | null>(
    null,
  );

  const {
    data: domains = [],
    isLoading: loadingDomains,
    isError: domainsError,
    refetch: refetchDomains,
  } = useAdDomains();

  const activeDomainId = domainId || domains[0]?.id || "";

  const {
    data: snapshots = [],
    isLoading: loadingSnapshots,
    refetch: refetchSnapshots,
  } = useQuery<AdSnapshot[]>({
    queryKey: ["ad-snapshots", activeDomainId],
    queryFn: async () => {
      const res = await adApi.sync.snapshots(activeDomainId);
      return res.data;
    },
    enabled: !!activeDomainId,
  });

  useEffect(() => {
    if (domains.length > 0 && !domainId) {
      setDomainId(domains[0].id);
    }
  }, [domains, domainId]);

  async function handleCreate() {
    setCreating(true);
    try {
      await adApi.sync.createSnapshot(activeDomainId, {
        snapshot_type: createType,
      });
      toast.success(
        `Snapshot ${SNAPSHOT_TYPE_LABELS[createType] ?? createType} cree`,
      );
      setCreateOpen(false);
      refetchSnapshots();
    } catch {
      toast.error("Echec de la creation du snapshot");
    } finally {
      setCreating(false);
    }
  }

  const breadcrumb = [
    { label: "Administration", href: "/admin" },
    { label: "Active Directory", href: "/admin/active-directory" },
    { label: "Sauvegardes" },
  ];

  if (loadingDomains) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageBreadcrumb items={breadcrumb} />
          <PageHeader
            title="Sauvegardes"
            description="Snapshots Active Directory et restauration"
            icon={<HardDrive className="h-5 w-5" />}
          />
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (domainsError) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageBreadcrumb items={breadcrumb} />
          <PageHeader
            title="Sauvegardes"
            description="Snapshots Active Directory et restauration"
            icon={<HardDrive className="h-5 w-5" />}
          />
          <div className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
            <p className="text-sm font-medium">Erreur de chargement</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => refetchDomains()}
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Reessayer
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageBreadcrumb items={breadcrumb} />
        <PageHeader
          title="Sauvegardes"
          description="Snapshots Active Directory et restauration"
          icon={<HardDrive className="h-5 w-5" />}
          actions={
            <div className="flex items-center gap-2">
              {domains.length > 0 && (
                <Select value={activeDomainId} onValueChange={setDomainId}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Selectionner un domaine" />
                  </SelectTrigger>
                  <SelectContent>
                    {domains.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.dns_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchSnapshots()}
                disabled={loadingSnapshots}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loadingSnapshots ? "animate-spin" : ""}`}
                />
                Rafraichir
              </Button>
              {activeDomainId && (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Creer un snapshot
                </Button>
              )}
            </div>
          }
        />

        {/* No domains */}
        {domains.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium">
                Aucun domaine Active Directory configure
              </p>
              <p className="text-sm mt-1">
                Configurez un domaine depuis la page Active Directory.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Snapshots table */}
        {activeDomainId && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Snapshots
              </CardTitle>
              <CardDescription>
                {snapshots.length} snapshot(s) disponible(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingSnapshots ? (
                <div className="py-12 text-center text-muted-foreground">
                  <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin" />
                  Chargement...
                </div>
              ) : snapshots.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  <HardDrive className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  Aucun snapshot pour ce domaine.
                  <br />
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Creer un snapshot
                  </Button>
                </div>
              ) : (
                <div className="rounded-b-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Type</TableHead>
                        <TableHead className="w-[160px]">Date</TableHead>
                        <TableHead className="w-[90px]">Taille</TableHead>
                        <TableHead className="w-[110px]">Statut</TableHead>
                        <TableHead>Tables incluses</TableHead>
                        <TableHead className="w-[160px]">Checksum</TableHead>
                        <TableHead className="w-[90px] text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {snapshots.map((snap) => (
                        <TableRow key={snap.id}>
                          <TableCell>
                            <SnapshotTypeBadge type={snap.snapshot_type} />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(snap.created_at)}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {formatBytes(snap.size_bytes)}
                          </TableCell>
                          <TableCell>
                            <SnapshotStatusBadge status={snap.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[240px]">
                              {snap.tables_included.length === 0 ? (
                                <span className="text-muted-foreground text-sm">
                                  —
                                </span>
                              ) : (
                                snap.tables_included.map((t) => (
                                  <Badge
                                    key={t}
                                    variant="secondary"
                                    className="text-[9px] px-1.5 py-0"
                                  >
                                    {t}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {truncateChecksum(snap.checksum)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={snap.status !== "completed"}
                              onClick={() => setRestoreSnapshot(snap)}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                              Restaurer
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Snapshot Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Creer un snapshot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Type de snapshot</Label>
              <Select
                value={createType}
                onValueChange={(v) =>
                  setCreateType(v as "full" | "incremental")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">
                    Complet — sauvegarde integrale
                  </SelectItem>
                  <SelectItem value="incremental">
                    Incrementiel — modifications depuis le dernier snapshot
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Creer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Dialog */}
      <RestoreDialog
        snapshot={restoreSnapshot}
        onClose={() => setRestoreSnapshot(null)}
        onRestored={() => refetchSnapshots()}
      />
    </AppLayout>
  );
}
