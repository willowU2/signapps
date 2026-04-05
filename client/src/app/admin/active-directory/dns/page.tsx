"use client";

import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Globe,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Zap,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  useAdDomains,
  useAdDnsZones,
  useAdDnsRecords,
  useAddDnsRecord,
  useDeleteDnsRecord,
} from "@/hooks/use-active-directory";
import type {
  AdDnsRecord,
  CreateDnsRecordRequest,
} from "@/types/active-directory";

// ── Record type badge colors ─────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  A: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  AAAA: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  SRV: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  CNAME:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  TXT: "bg-muted text-muted-foreground border-border",
  MX: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  NS: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
  PTR: "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800",
  SOA: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
};

const RECORD_TYPES = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "NS",
  "PTR",
  "SRV",
  "TXT",
] as const;

// ── Smart rdata renderer ─────────────────────────────────────────────────────

function renderRdata(record: AdDnsRecord): string {
  const r = record.rdata;
  if (!r) return "—";
  switch (record.record_type) {
    case "A":
    case "AAAA":
      return String(r.address ?? r.ip ?? "—");
    case "SRV": {
      const prio = r.priority ?? 0;
      const w = r.weight ?? 0;
      const port = r.port ?? 0;
      const target = r.target ?? "—";
      return `${prio} ${w} ${port} ${target}`;
    }
    case "MX":
      return `${r.preference ?? r.priority ?? 0} ${r.exchange ?? r.host ?? "—"}`;
    case "CNAME":
    case "PTR":
    case "NS":
      return String(r.target ?? r.host ?? r.nsdname ?? "—");
    case "TXT":
      return String(r.text ?? r.value ?? "—");
    default:
      return Object.values(r).join(" ") || "—";
  }
}

// ── rdata form fields per type ───────────────────────────────────────────────

interface RdataFormProps {
  type: string;
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}

function RdataFields({ type, value, onChange }: RdataFormProps) {
  const set = (k: string, v: string) => onChange({ ...value, [k]: v });

  switch (type) {
    case "A":
    case "AAAA":
      return (
        <div className="space-y-2">
          <Label>Adresse IP</Label>
          <Input
            placeholder={type === "A" ? "192.168.1.1" : "::1"}
            value={value.address ?? ""}
            onChange={(e) => set("address", e.target.value)}
          />
        </div>
      );
    case "CNAME":
    case "PTR":
    case "NS":
      return (
        <div className="space-y-2">
          <Label>Cible</Label>
          <Input
            placeholder="host.example.com."
            value={value.target ?? ""}
            onChange={(e) => set("target", e.target.value)}
          />
        </div>
      );
    case "MX":
      return (
        <>
          <div className="space-y-2">
            <Label>Preference</Label>
            <Input
              type="number"
              placeholder="10"
              value={value.preference ?? ""}
              onChange={(e) => set("preference", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Serveur de messagerie</Label>
            <Input
              placeholder="mail.example.com."
              value={value.exchange ?? ""}
              onChange={(e) => set("exchange", e.target.value)}
            />
          </div>
        </>
      );
    case "SRV":
      return (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Priorite</Label>
              <Input
                type="number"
                placeholder="0"
                value={value.priority ?? ""}
                onChange={(e) => set("priority", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Poids</Label>
              <Input
                type="number"
                placeholder="0"
                value={value.weight ?? ""}
                onChange={(e) => set("weight", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input
                type="number"
                placeholder="443"
                value={value.port ?? ""}
                onChange={(e) => set("port", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cible</Label>
            <Input
              placeholder="host.example.com."
              value={value.target ?? ""}
              onChange={(e) => set("target", e.target.value)}
            />
          </div>
        </>
      );
    case "TXT":
      return (
        <div className="space-y-2">
          <Label>Texte</Label>
          <Input
            placeholder="v=spf1 include:example.com ~all"
            value={value.text ?? ""}
            onChange={(e) => set("text", e.target.value)}
          />
        </div>
      );
    default:
      return null;
  }
}

// ── Add Record Dialog ────────────────────────────────────────────────────────

interface AddRecordDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  zoneId: string;
}

function AddRecordDialog({ open, onOpenChange, zoneId }: AddRecordDialogProps) {
  const [name, setName] = useState("@");
  const [type, setType] = useState("A");
  const [rdata, setRdata] = useState<Record<string, string>>({});
  const [ttl, setTtl] = useState("3600");
  const [isStatic, setIsStatic] = useState(true);
  const addRecord = useAddDnsRecord();

  const handleSubmit = () => {
    const payload: CreateDnsRecordRequest = {
      name,
      record_type: type,
      rdata: rdata as Record<string, unknown>,
      ttl: parseInt(ttl, 10) || 3600,
      is_static: isStatic,
    };
    addRecord.mutate(
      { zoneId, data: payload },
      {
        onSuccess: () => {
          onOpenChange(false);
          setName("@");
          setType("A");
          setRdata({});
          setTtl("3600");
          setIsStatic(true);
        },
      },
    );
  };

  const handleTypeChange = (v: string) => {
    setType(v);
    setRdata({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Ajouter un enregistrement DNS</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                placeholder="@"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECORD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <RdataFields type={type} value={rdata} onChange={setRdata} />
          <div className="space-y-2">
            <Label>TTL (secondes)</Label>
            <Input
              type="number"
              placeholder="3600"
              value={ttl}
              onChange={(e) => setTtl(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="is-static"
              checked={isStatic}
              onCheckedChange={(v) => setIsStatic(Boolean(v))}
            />
            <Label htmlFor="is-static" className="font-normal cursor-pointer">
              Enregistrement statique (ne pas purger lors du nettoyage)
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={addRecord.isPending}>
            {addRecord.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AdDnsPage() {
  usePageTitle("DNS — Active Directory");

  const {
    data: domains = [],
    isLoading: loadingDomains,
    isError: domainsError,
    refetch: refetchDomains,
  } = useAdDomains();
  const [selectedDomainId, setSelectedDomainId] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdDnsRecord | null>(null);

  const activeDomainId = selectedDomainId || domains[0]?.id || "";
  const { data: zones = [], isLoading: loadingZones } =
    useAdDnsZones(activeDomainId);
  const activeZoneId = selectedZoneId || zones[0]?.id || "";
  const {
    data: records = [],
    isLoading: loadingRecords,
    refetch,
  } = useAdDnsRecords(activeZoneId);
  const deleteRecord = useDeleteDnsRecord();

  const activeZone = zones.find((z) => z.id === activeZoneId);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchSearch =
        !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        renderRdata(r).toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || r.record_type === typeFilter;
      return matchSearch && matchType;
    });
  }, [records, search, typeFilter]);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteRecord.mutate(
      { recordId: deleteTarget.id, zoneId: activeZoneId },
      { onSuccess: () => setDeleteTarget(null) },
    );
  };

  if (loadingDomains) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageHeader
            title="Zones DNS"
            description="Gestion des zones et enregistrements DNS Active Directory"
            icon={<Globe className="h-5 w-5" />}
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
          <PageHeader
            title="Zones DNS"
            description="Gestion des zones et enregistrements DNS Active Directory"
            icon={<Globe className="h-5 w-5" />}
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
        <PageHeader
          title="Zones DNS"
          description="Gestion des zones et enregistrements DNS Active Directory"
          icon={<Globe className="h-5 w-5" />}
          actions={
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={loadingRecords}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loadingRecords ? "animate-spin" : ""}`}
                />
                Rafraichir
              </Button>
              {activeZoneId && (
                <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              )}
            </div>
          }
        />

        {/* Domain + Zone selectors */}
        <div className="flex flex-wrap gap-4">
          {domains.length > 1 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Domaine</Label>
              <Select
                value={activeDomainId}
                onValueChange={(v) => {
                  setSelectedDomainId(v);
                  setSelectedZoneId("");
                }}
              >
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
            </div>
          )}
          {zones.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Zone</Label>
              <Select value={activeZoneId} onValueChange={setSelectedZoneId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Selectionner une zone" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.zone_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Empty state */}
        {!loadingDomains && domains.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium">
                Aucun domaine Active Directory configure
              </p>
              <p className="text-sm mt-1">
                Configurez d&apos;abord un domaine depuis la page Active
                Directory.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Zone info card */}
        {activeZone && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {activeZone.zone_name}
                  </CardTitle>
                  <CardDescription>
                    Zone {activeZone.zone_type} —{" "}
                    {activeZone.allow_dynamic_update ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Mises a jour dynamiques activees
                      </span>
                    ) : (
                      <span>Mises a jour dynamiques desactivees</span>
                    )}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Zap className="h-4 w-4 mr-2" />
                  Nettoyer
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                {[
                  { label: "Serial SOA", value: activeZone.soa_serial },
                  { label: "Refresh", value: `${activeZone.soa_refresh}s` },
                  { label: "Retry", value: `${activeZone.soa_retry}s` },
                  { label: "Expire", value: `${activeZone.soa_expire}s` },
                  { label: "TTL minimum", value: `${activeZone.soa_minimum}s` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Records table */}
        {activeZoneId && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Enregistrements</CardTitle>
                  <CardDescription>
                    {filteredRecords.length} enregistrement(s)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      className="pl-8 h-8 w-48 text-sm"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-8 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous types</SelectItem>
                      {RECORD_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingRecords ? (
                <div className="py-12 text-center text-muted-foreground">
                  <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin" />
                  Chargement...
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  Aucun enregistrement.
                </div>
              ) : (
                <div className="rounded-b-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead className="w-[80px]">Type</TableHead>
                        <TableHead>Donnees</TableHead>
                        <TableHead className="w-[80px]">TTL</TableHead>
                        <TableHead className="w-[100px]">Statut</TableHead>
                        <TableHead className="w-[140px]">Horodatage</TableHead>
                        <TableHead className="w-[50px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-mono text-sm">
                            {record.name}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-medium ${TYPE_COLORS[record.record_type] ?? ""}`}
                            >
                              {record.record_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground max-w-[280px] truncate">
                            {renderRdata(record)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {record.ttl}s
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                record.is_static ? "secondary" : "outline"
                              }
                              className="text-[10px]"
                            >
                              {record.is_static ? "Statique" : "Dynamique"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {record.timestamp
                              ? new Date(record.timestamp).toLocaleString(
                                  "fr-FR",
                                )
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDeleteTarget(record)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
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

        {/* Add record dialog */}
        {activeZoneId && (
          <AddRecordDialog
            open={addDialogOpen}
            onOpenChange={setAddDialogOpen}
            zoneId={activeZoneId}
          />
        )}

        {/* Delete confirmation */}
        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(v) => {
            if (!v) setDeleteTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Supprimer l&apos;enregistrement ?
              </AlertDialogTitle>
              <AlertDialogDescription>
                L&apos;enregistrement{" "}
                <span className="font-mono font-medium">
                  {deleteTarget?.name}
                </span>{" "}
                ({deleteTarget?.record_type}) sera definitivement supprime.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDelete}
                disabled={deleteRecord.isPending}
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
