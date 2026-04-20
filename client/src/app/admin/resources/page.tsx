"use client";

/**
 * SO8 — Catalogue unifié de ressources tangibles.
 *
 * Remplace la page /admin/resources legacy (qui tapait l'identity service) par
 * la surface canonique `org_resources` exposée par signapps-org (port 3026).
 *
 * Filtres: kind, status, search. Actions: créer, archiver, transition de
 * statut, export CSV (bulk). Chaque ligne lie vers `/admin/resources/:id`.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/use-page-title";
import { orgApi } from "@/lib/api/org";
import type { Resource, ResourceKind, ResourceStatus } from "@/types/org";
import {
  Package,
  Plus,
  Search,
  Download,
  Trash2,
  ExternalLink,
} from "lucide-react";

const KIND_OPTIONS: { value: ResourceKind; label: string; emoji: string }[] = [
  { value: "it_device", label: "IT / informatique", emoji: "💻" },
  { value: "vehicle", label: "Véhicule", emoji: "🚗" },
  { value: "key_physical", label: "Clé physique", emoji: "🔑" },
  { value: "badge", label: "Badge", emoji: "🪪" },
  { value: "av_equipment", label: "Équipement AV", emoji: "📹" },
  { value: "furniture", label: "Mobilier", emoji: "🪑" },
  { value: "mobile_phone", label: "Téléphone", emoji: "📱" },
  { value: "license_software", label: "Licence logiciel", emoji: "🧾" },
  { value: "other", label: "Autre", emoji: "📦" },
];

const STATUS_OPTIONS: { value: ResourceStatus; label: string }[] = [
  { value: "ordered", label: "Commandée" },
  { value: "active", label: "En service" },
  { value: "loaned", label: "Prêtée" },
  { value: "in_maintenance", label: "En maintenance" },
  { value: "returned", label: "Rendue" },
  { value: "retired", label: "Retirée" },
];

function kindLabel(kind: string): string {
  const opt = KIND_OPTIONS.find((o) => o.value === kind);
  return opt ? `${opt.emoji} ${opt.label}` : kind;
}

function statusLabel(status: ResourceStatus): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

function statusBadgeVariant(
  status: ResourceStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "loaned":
    case "in_maintenance":
      return "secondary";
    case "retired":
      return "destructive";
    default:
      return "outline";
  }
}

export default function ResourcesPage() {
  usePageTitle("Ressources");

  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<ResourceKind | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ResourceStatus | "all">(
    "all",
  );

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{
    slug: string;
    kind: ResourceKind;
    name: string;
    description: string;
    serial_or_ref: string;
    purchase_cost_cents: string;
  }>({
    slug: "",
    kind: "it_device",
    name: "",
    description: "",
    serial_or_ref: "",
    purchase_cost_cents: "",
  });

  const load = useMemo(
    () => async () => {
      setLoading(true);
      try {
        const res = await orgApi.resources.list({
          kind: kindFilter === "all" ? undefined : kindFilter,
          status: statusFilter === "all" ? undefined : statusFilter,
        });
        setResources(res.data ?? []);
      } catch (e) {
        console.error(e);
        toast.error("Erreur de chargement");
      } finally {
        setLoading(false);
      }
    },
    [kindFilter, statusFilter],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter((r) => {
      return (
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.serial_or_ref ?? "").toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [resources, search]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error("Nom et slug obligatoires");
      return;
    }
    setCreating(true);
    try {
      const res = await orgApi.resources.create({
        slug: form.slug.trim(),
        kind: form.kind,
        name: form.name.trim(),
        description: form.description || undefined,
        serial_or_ref: form.serial_or_ref || undefined,
        purchase_cost_cents: form.purchase_cost_cents
          ? parseInt(form.purchase_cost_cents, 10)
          : undefined,
      });
      toast.success("Ressource créée");
      setIsCreateOpen(false);
      setForm({
        slug: "",
        kind: "it_device",
        name: "",
        description: "",
        serial_or_ref: "",
        purchase_cost_cents: "",
      });
      setResources((list) => [res.data, ...list]);
    } catch (e) {
      console.error(e);
      toast.error("Création refusée (slug déjà utilisé ?)");
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Archiver cette ressource ?")) return;
    try {
      await orgApi.resources.archive(id);
      toast.success("Ressource archivée");
      setResources((list) => list.filter((r) => r.id !== id));
    } catch (e) {
      console.error(e);
      toast.error("Échec de l'archivage");
    }
  };

  const handleExportCsv = () => {
    const header = "id,slug,kind,name,status,serial,cost_cents,assigned_person";
    const rows = filtered.map((r) =>
      [
        r.id,
        r.slug,
        r.kind,
        `"${r.name.replaceAll('"', '""')}"`,
        r.status,
        r.serial_or_ref ?? "",
        r.purchase_cost_cents ?? "",
        r.assigned_to_person_id ?? "",
      ].join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resources-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Ressources"
          icon={<Package className="h-5 w-5 text-primary" />}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportCsv}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nouvelle ressource
              </Button>
            </div>
          }
        />

        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher nom, slug, serial…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={kindFilter}
            onValueChange={(v) => setKindFilter(v as ResourceKind | "all")}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {KIND_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.emoji} {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as ResourceStatus | "all")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            Chargement…
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Coût</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Aucune ressource trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/resources/${r.id}`}
                          className="hover:underline"
                        >
                          {r.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {r.slug}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {kindLabel(r.kind)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(r.status)}>
                          {statusLabel(r.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.serial_or_ref ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.purchase_cost_cents
                          ? `${(r.purchase_cost_cents / 100).toLocaleString(
                              "fr-FR",
                            )} ${r.currency ?? "EUR"}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Link
                            href={`/admin/resources/${r.id}`}
                            title="Voir le détail"
                          >
                            <Button size="sm" variant="ghost" asChild>
                              <span>
                                <ExternalLink className="h-4 w-4" />
                              </span>
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleArchive(r.id)}
                            title="Archiver"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Créer une ressource</DialogTitle>
              <DialogDescription>
                Les champs spécifiques au type sont éditables sur la fiche
                détaillée après création.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label htmlFor="slug">Slug *</Label>
                <Input
                  id="slug"
                  placeholder="veh-tesla-y-02"
                  value={form.slug}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, slug: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="kind">Type *</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, kind: v as ResourceKind }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KIND_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.emoji} {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  placeholder="Tesla Model Y (Paris)"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="serial">Numéro de série / ref</Label>
                <Input
                  id="serial"
                  placeholder="VIN-XXX ou S/N"
                  value={form.serial_or_ref}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, serial_or_ref: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="desc">Description</Label>
                <Textarea
                  id="desc"
                  rows={2}
                  placeholder="Note facultative"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="cost">Coût d&apos;achat (centimes)</Label>
                <Input
                  id="cost"
                  type="number"
                  placeholder="500000"
                  value={form.purchase_cost_cents}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      purchase_cost_cents: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={creating}
              >
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Création…" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
