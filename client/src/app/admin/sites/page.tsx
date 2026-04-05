"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { orgApi } from "@/lib/api/org";
import type { Site, SiteType, Person } from "@/types/org";
import {
  Plus,
  MapPin,
  Building2,
  ChevronRight,
  ChevronDown,
  Users,
  Edit2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";

const SITE_TYPE_CONFIG: Record<
  SiteType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  campus: {
    label: "Campus",
    icon: <Building2 className="h-4 w-4" />,
    color: "text-purple-600",
  },
  building: {
    label: "Bâtiment",
    icon: <Building2 className="h-4 w-4" />,
    color: "text-blue-600",
  },
  floor: {
    label: "Étage",
    icon: <MapPin className="h-4 w-4" />,
    color: "text-teal-600",
  },
  room: {
    label: "Salle",
    icon: <MapPin className="h-4 w-4" />,
    color: "text-green-600",
  },
};

interface SiteWithChildren extends Site {
  children?: SiteWithChildren[];
}

function buildSiteTree(sites: Site[]): SiteWithChildren[] {
  const map = new Map<string, SiteWithChildren>();
  const roots: SiteWithChildren[] = [];

  sites.forEach((s) => map.set(s.id, { ...s, children: [] }));
  sites.forEach((s) => {
    const node = map.get(s.id)!;
    if (s.parent_id && map.has(s.parent_id)) {
      map.get(s.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

interface SiteTreeItemProps {
  site: SiteWithChildren;
  depth: number;
  selectedId: string | null;
  onSelect: (site: Site) => void;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onEdit: (site: Site) => void;
  onDelete: (site: Site) => void;
}

function SiteTreeItem({
  site,
  depth,
  selectedId,
  onSelect,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
}: SiteTreeItemProps) {
  const hasChildren = (site.children?.length ?? 0) > 0;
  const isExpanded = expanded.has(site.id);
  const isSelected = selectedId === site.id;
  const cfg = SITE_TYPE_CONFIG[site.site_type as SiteType] ?? {
    label: site.site_type,
    icon: <MapPin className="h-4 w-4" />,
    color: "text-muted-foreground",
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors group",
          isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
        )}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        onClick={() => onSelect(site)}
      >
        <button
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground",
            !hasChildren && "invisible",
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(site.id);
          }}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <span className={cn("shrink-0", cfg.color)}>{cfg.icon}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{site.name}</span>
            <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
              {cfg.label}
            </Badge>
          </div>
          {(site.city || site.country) && (
            <p className="text-xs text-muted-foreground">
              {[site.city, site.country].filter(Boolean).join(", ")}
            </p>
          )}
        </div>

        {site.capacity && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
            <Users className="h-3 w-3" />
            {site.capacity}
          </span>
        )}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(site);
            }}
          >
            <Edit2 className="h-3 w-3" />
          </button>
          <button
            className="p-1 rounded hover:bg-muted text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(site);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {isExpanded && hasChildren && (
        <div>
          {site.children!.map((child) => (
            <SiteTreeItem
              key={child.id}
              site={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SitesPage() {
  usePageTitle("Sites — Administration");

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [sitePersons, setSitePersons] = useState<Person[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editSite, setEditSite] = useState<Site | null>(null);
  const [deleteSite, setDeleteSite] = useState<Site | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<SiteType>("building");
  const [formAddress, setFormAddress] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formCountry, setFormCountry] = useState("");
  const [formCapacity, setFormCapacity] = useState("");
  const [formTimezone, setFormTimezone] = useState("Europe/Paris");
  const [formParentId, setFormParentId] = useState("");
  const [saving, setSaving] = useState(false);

  const loadSites = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await orgApi.sites.list();
      setSites(res.data ?? []);
      // Auto-expand roots
      const roots = (res.data ?? []).filter((s) => !s.parent_id);
      setExpanded(new Set(roots.map((r) => r.id)));
    } catch {
      setLoadError(true);
      toast.error("Erreur lors du chargement des sites");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  useEffect(() => {
    if (selectedSite) {
      orgApi.sites
        .persons(selectedSite.id)
        .then((res) => setSitePersons(res.data ?? []))
        .catch(() => setSitePersons([]));
    } else {
      setSitePersons([]);
    }
  }, [selectedSite]);

  const resetForm = () => {
    setFormName("");
    setFormType("building");
    setFormAddress("");
    setFormCity("");
    setFormCountry("");
    setFormCapacity("");
    setFormTimezone("Europe/Paris");
    setFormParentId("");
  };

  const openEdit = (site: Site) => {
    setEditSite(site);
    setFormName(site.name);
    setFormType(site.site_type as SiteType);
    setFormAddress(site.address ?? "");
    setFormCity(site.city ?? "");
    setFormCountry(site.country ?? "");
    setFormCapacity(site.capacity?.toString() ?? "");
    setFormTimezone(site.timezone ?? "Europe/Paris");
    setFormParentId(site.parent_id ?? "");
    setCreateOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const data: Partial<Site> = {
        name: formName.trim(),
        site_type: formType,
        address: formAddress.trim() || undefined,
        city: formCity.trim() || undefined,
        country: formCountry.trim() || undefined,
        capacity: formCapacity ? parseInt(formCapacity, 10) : undefined,
        timezone: formTimezone || "Europe/Paris",
        parent_id: formParentId.trim() || undefined,
        is_active: true,
      };

      if (editSite) {
        await orgApi.sites.update(editSite.id, data);
        toast.success("Site mis à jour");
      } else {
        await orgApi.sites.create(data);
        toast.success("Site créé");
      }

      setCreateOpen(false);
      setEditSite(null);
      resetForm();
      loadSites();
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteSite) return;
    setDeleting(true);
    try {
      await orgApi.sites.update(deleteSite.id, { is_active: false });
      toast.success("Site supprimé");
      setDeleteSite(null);
      if (selectedSite?.id === deleteSite.id) setSelectedSite(null);
      loadSites();
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  const siteTree = buildSiteTree(sites);

  if (loading) {
    return (
      <AppLayout>
        <div className="px-6 py-6 space-y-6">
          <PageHeader
            title="Sites"
            description="Gérez la hiérarchie géographique: campus, bâtiments, étages et salles"
            icon={<MapPin className="h-5 w-5" />}
          />
          <LoadingState variant="skeleton" />
        </div>
      </AppLayout>
    );
  }

  if (loadError) {
    return (
      <AppLayout>
        <div className="px-6 py-6 space-y-6">
          <PageHeader
            title="Sites"
            description="Gérez la hiérarchie géographique: campus, bâtiments, étages et salles"
            icon={<MapPin className="h-5 w-5" />}
          />
          <ErrorState
            title="Impossible de charger les sites"
            message="Vérifiez votre connexion au service d'organisation."
            onRetry={loadSites}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-6 py-6 space-y-6">
        <PageHeader
          title="Sites"
          description="Gérez la hiérarchie géographique: campus, bâtiments, étages et salles"
          icon={<MapPin className="h-5 w-5" />}
          actions={
            <Button
              size="sm"
              onClick={() => {
                setEditSite(null);
                resetForm();
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nouveau site
            </Button>
          }
        />

        <div className="flex gap-4">
          {/* ── Left: Site tree ── */}
          <div className="flex-1 border rounded-lg bg-card overflow-hidden">
            {siteTree.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                <MapPin className="h-10 w-10 opacity-20" />
                <p className="text-sm">
                  Aucun site — cliquez sur «Nouveau site»
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {siteTree.map((site) => (
                  <SiteTreeItem
                    key={site.id}
                    site={site}
                    depth={0}
                    selectedId={selectedSite?.id ?? null}
                    onSelect={setSelectedSite}
                    expanded={expanded}
                    onToggleExpand={(id) => {
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      });
                    }}
                    onEdit={openEdit}
                    onDelete={setDeleteSite}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Right: Site detail ── */}
          <div className="w-80 shrink-0">
            {selectedSite ? (
              <div className="border rounded-lg bg-card p-4 space-y-4">
                <div>
                  <h3 className="font-semibold">{selectedSite.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {SITE_TYPE_CONFIG[selectedSite.site_type as SiteType]
                      ?.label ?? selectedSite.site_type}
                  </p>
                </div>

                {selectedSite.address && (
                  <div className="text-sm space-y-1">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium">
                      Adresse
                    </p>
                    <p>{selectedSite.address}</p>
                    {selectedSite.city && (
                      <p>
                        {selectedSite.city}
                        {selectedSite.country
                          ? `, ${selectedSite.country}`
                          : ""}
                      </p>
                    )}
                  </div>
                )}

                {selectedSite.capacity && (
                  <div className="text-sm">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium mb-1">
                      Capacité
                    </p>
                    <p>{selectedSite.capacity} personnes</p>
                  </div>
                )}

                <div className="text-sm">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium mb-1">
                    Fuseau horaire
                  </p>
                  <p>{selectedSite.timezone}</p>
                </div>

                {/* Persons at this site */}
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium mb-2">
                    Personnes ({sitePersons.length})
                  </p>
                  {sitePersons.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aucune personne
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {sitePersons.slice(0, 5).map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px]">
                              {`${p.first_name[0] ?? ""}${p.last_name[0] ?? ""}`.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate">
                            {p.first_name} {p.last_name}
                          </span>
                        </div>
                      ))}
                      {sitePersons.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          +{sitePersons.length - 5} autres
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="border rounded-lg bg-card/50 h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <MapPin className="h-8 w-8 opacity-20" />
                <p className="text-sm">Sélectionnez un site</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Create/Edit dialog ── */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setEditSite(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editSite ? "Modifier le site" : "Nouveau site"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="site-name">Nom *</Label>
                <Input
                  id="site-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Tour A, Salle Conférence 1"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  value={formType}
                  onValueChange={(v) => setFormType(v as SiteType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SITE_TYPE_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacité</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={formCapacity}
                  onChange={(e) => setFormCapacity(e.target.value)}
                  placeholder="50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="12 rue de la Paix"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city">Ville</Label>
                <Input
                  id="city"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder="Paris"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Pays</Label>
                <Input
                  id="country"
                  value={formCountry}
                  onChange={(e) => setFormCountry(e.target.value)}
                  placeholder="France"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Fuseau horaire</Label>
              <Input
                id="timezone"
                value={formTimezone}
                onChange={(e) => setFormTimezone(e.target.value)}
                placeholder="Europe/Paris"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent-site">Site parent (ID)</Label>
              <Input
                id="parent-site"
                value={formParentId}
                onChange={(e) => setFormParentId(e.target.value)}
                placeholder="UUID du site parent"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setEditSite(null);
              }}
            >
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving ? "Sauvegarde..." : editSite ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <Dialog
        open={!!deleteSite}
        onOpenChange={(open) => !open && setDeleteSite(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer «{deleteSite?.name}»?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Ce site sera désactivé. Les sous-sites et personnes associées ne
            seront pas supprimés.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSite(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
