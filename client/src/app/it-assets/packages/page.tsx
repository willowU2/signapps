"use client";

// SD1-SD4: Software package catalog, upload, deploy, self-service app store

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Package,
  Plus,
  Trash2,
  Edit,
  Download,
  Search,
  Upload,
  MonitorSmartphone,
  CheckCircle2,
  Clock,
  AlertCircle,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";
import { itAssetsApi, HardwareAsset } from "@/lib/api/it-assets";
import { usePageTitle } from "@/hooks/use-page-title";

const client = getClient(ServiceName.IT_ASSETS);

// ─── Types ───────────────────────────────────────────────────────────────────

interface SoftwarePackage {
  id: string;
  name: string;
  version: string;
  publisher?: string;
  platform: string;
  installer_type: string;
  silent_args?: string;
  file_path?: string;
  file_hash?: string;
  file_size?: number;
  created_at: string;
}

interface Deployment {
  id: string;
  package_id: string;
  hardware_id: string;
  status: string;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  exit_code?: number;
  output?: string;
}

interface CreatePackageForm {
  name: string;
  version: string;
  publisher: string;
  platform: string;
  installer_type: string;
  silent_args: string;
  file_path: string;
}

const PLATFORMS = [
  { value: "windows", label: "Windows" },
  { value: "linux", label: "Linux" },
  { value: "macos", label: "macOS" },
  { value: "cross", label: "Multi-plateforme" },
];

const INSTALLER_TYPES = [
  { value: "msi", label: "MSI" },
  { value: "exe", label: "EXE" },
  { value: "deb", label: "DEB" },
  { value: "rpm", label: "RPM" },
  { value: "pkg", label: "PKG" },
  { value: "script", label: "Script" },
  { value: "other", label: "Autre" },
];

// Popular apps for self-service store (SD4)
const APP_STORE_CATALOG = [
  {
    name: "Google Chrome",
    publisher: "Google",
    category: "Navigateur",
    icon: "🌐",
  },
  {
    name: "Mozilla Firefox",
    publisher: "Mozilla",
    category: "Navigateur",
    icon: "🦊",
  },
  {
    name: "Visual Studio Code",
    publisher: "Microsoft",
    category: "Dev",
    icon: "💻",
  },
  { name: "7-Zip", publisher: "7-Zip", category: "Utilitaires", icon: "📦" },
  {
    name: "VLC Media Player",
    publisher: "VideoLAN",
    category: "Multimédia",
    icon: "🎬",
  },
  {
    name: "Notepad++",
    publisher: "Notepad++",
    category: "Éditeur",
    icon: "📝",
  },
  { name: "WinSCP", publisher: "WinSCP", category: "Réseau", icon: "🔌" },
  { name: "PuTTY", publisher: "Simon Tatham", category: "Réseau", icon: "🔒" },
  {
    name: "LibreOffice",
    publisher: "LibreOffice",
    category: "Bureautique",
    icon: "📄",
  },
  {
    name: "Zoom",
    publisher: "Zoom Video",
    category: "Communication",
    icon: "📹",
  },
  { name: "Slack", publisher: "Slack", category: "Communication", icon: "💬" },
  { name: "Git", publisher: "Git SCM", category: "Dev", icon: "🔧" },
];

const STATUS_CONFIG: Record<
  string,
  { label: string; color: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "En attente", color: "outline" },
  running: { label: "En cours", color: "secondary" },
  completed: { label: "Terminé", color: "default" },
  failed: { label: "Échec", color: "destructive" },
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PackagesPage() {
  usePageTitle("Déploiement Logiciels");
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("catalog");
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<SoftwarePackage | null>(
    null,
  );
  const [deployingPackage, setDeployingPackage] =
    useState<SoftwarePackage | null>(null);
  const [selectedMachines, setSelectedMachines] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [form, setForm] = useState<CreatePackageForm>({
    name: "",
    version: "",
    publisher: "",
    platform: "windows",
    installer_type: "msi",
    silent_args: "",
    file_path: "",
  });
  const [storeSearch, setStoreSearch] = useState("");
  const [storeCategory, setStoreCategory] = useState("all");

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data: packages, isLoading: packagesLoading } = useQuery({
    queryKey: ["software-packages"],
    queryFn: () =>
      client.get<SoftwarePackage[]>("/it-assets/packages").then((r) => r.data),
  });

  const { data: hardware } = useQuery({
    queryKey: ["hardware"],
    queryFn: () => itAssetsApi.listHardware().then((r) => r.data),
  });

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: CreatePackageForm) =>
      client.post("/it-assets/packages", data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["software-packages"] });
      setDialogOpen(false);
      toast.success("Paquet ajouté");
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreatePackageForm>;
    }) => client.put(`/it-assets/packages/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["software-packages"] });
      setDialogOpen(false);
      toast.success("Paquet mis à jour");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      client.delete(`/it-assets/packages/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["software-packages"] });
      toast.success("Paquet supprimé");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const deployMutation = useMutation({
    mutationFn: ({
      id,
      hardwareIds,
      scheduledAt,
    }: {
      id: string;
      hardwareIds: string[];
      scheduledAt?: string;
    }) =>
      client
        .post<Deployment[]>(`/it-assets/packages/${id}/deploy`, {
          hardware_ids: hardwareIds,
          scheduled_at: scheduledAt || undefined,
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      setDeployDialogOpen(false);
      setSelectedMachines([]);
      toast.success(`Déploiement planifié sur ${data.length} machine(s)`);
    },
    onError: () => toast.error("Erreur lors du déploiement"),
  });

  // ─── Filtered data ──────────────────────────────────────────────────────────

  const filteredPackages = useMemo(() => {
    const pkgs = packages ?? [];
    return pkgs.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.publisher ?? "").toLowerCase().includes(search.toLowerCase());
      const matchPlatform =
        platformFilter === "all" || p.platform === platformFilter;
      return matchSearch && matchPlatform;
    });
  }, [packages, search, platformFilter]);

  const storeCategories = useMemo(() => {
    const cats = new Set(APP_STORE_CATALOG.map((a) => a.category));
    return ["all", ...Array.from(cats)];
  }, []);

  const filteredStore = useMemo(() => {
    return APP_STORE_CATALOG.filter((app) => {
      const matchSearch =
        !storeSearch ||
        app.name.toLowerCase().includes(storeSearch.toLowerCase());
      const matchCat =
        storeCategory === "all" || app.category === storeCategory;
      return matchSearch && matchCat;
    });
  }, [storeSearch, storeCategory]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingPackage(null);
    setForm({
      name: "",
      version: "",
      publisher: "",
      platform: "windows",
      installer_type: "msi",
      silent_args: "",
      file_path: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (pkg: SoftwarePackage) => {
    setEditingPackage(pkg);
    setForm({
      name: pkg.name,
      version: pkg.version,
      publisher: pkg.publisher ?? "",
      platform: pkg.platform,
      installer_type: pkg.installer_type,
      silent_args: pkg.silent_args ?? "",
      file_path: pkg.file_path ?? "",
    });
    setDialogOpen(true);
  };

  const openDeploy = (pkg: SoftwarePackage) => {
    setDeployingPackage(pkg);
    setSelectedMachines([]);
    setScheduledAt("");
    setDeployDialogOpen(true);
  };

  const handleSave = () => {
    if (editingPackage) {
      updateMutation.mutate({ id: editingPackage.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleDeploy = () => {
    if (!deployingPackage || selectedMachines.length === 0) return;
    deployMutation.mutate({
      id: deployingPackage.id,
      hardwareIds: selectedMachines,
      scheduledAt: scheduledAt || undefined,
    });
  };

  const toggleMachine = (id: string) => {
    setSelectedMachines((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const platformLabel = (p: string) =>
    PLATFORMS.find((pl) => pl.value === p)?.label ?? p;
  const installerLabel = (t: string) =>
    INSTALLER_TYPES.find((it) => it.value === t)?.label ?? t;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6" />
              Déploiement Logiciels
            </h1>
            <p className="text-muted-foreground text-sm">
              Catalogue, déploiement et libre-service
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un paquet
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="catalog">Catalogue (SD1-SD3)</TabsTrigger>
            <TabsTrigger value="store">
              <Store className="h-4 w-4 mr-1" />
              App Store (SD4)
            </TabsTrigger>
          </TabsList>

          {/* SD1-SD3: Package catalog */}
          <TabsContent value="catalog">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Rechercher un paquet..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Select
                    value={platformFilter}
                    onValueChange={setPlatformFilter}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Plateforme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      {PLATFORMS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {packagesLoading ? (
                  <div className="text-muted-foreground text-sm">
                    Chargement...
                  </div>
                ) : filteredPackages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Package className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-semibold">Aucun paquet</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                      Ajoutez votre premier logiciel pour gerer le deploiement.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Éditeur</TableHead>
                        <TableHead>Plateforme</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Taille</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPackages.map((pkg) => (
                        <TableRow key={pkg.id}>
                          <TableCell className="font-medium">
                            {pkg.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {pkg.version}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {pkg.publisher ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {platformLabel(pkg.platform)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {installerLabel(pkg.installer_type)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {pkg.file_size
                              ? `${(pkg.file_size / 1024 / 1024).toFixed(1)} MB`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Déployer"
                                onClick={() => openDeploy(pkg)}
                                aria-label="Déployer"
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => openEdit(pkg)}
                                aria-label="Modifier"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={() => deleteMutation.mutate(pkg.id)}
                                aria-label="Supprimer"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SD4: Self-service app store */}
          <TabsContent value="store">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  App Store libre-service
                </CardTitle>
                <CardDescription>
                  Applications disponibles pour les utilisateurs finaux. Cliquez
                  sur &quot;Installer&quot; pour déclencher un déploiement.
                </CardDescription>
                <div className="flex flex-wrap gap-3 pt-2">
                  <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Rechercher une app..."
                      value={storeSearch}
                      onChange={(e) => setStoreSearch(e.target.value)}
                    />
                  </div>
                  <Select
                    value={storeCategory}
                    onValueChange={setStoreCategory}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {storeCategories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c === "all" ? "Toutes" : c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredStore.map((app) => {
                    // Find if this app is in the package catalog
                    const catalogPkg = (packages ?? []).find((p) =>
                      p.name
                        .toLowerCase()
                        .includes(app.name.split(" ")[0].toLowerCase()),
                    );
                    return (
                      <div
                        key={app.name}
                        className="p-4 border rounded-md flex items-start gap-3 hover:bg-muted/20 transition-colors"
                      >
                        <div className="text-2xl shrink-0">{app.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{app.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {app.publisher}
                          </div>
                          <Badge variant="outline" className="text-xs mt-1">
                            {app.category}
                          </Badge>
                        </div>
                        {catalogPkg ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => openDeploy(catalogPkg)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Installer
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled
                            className="shrink-0 text-xs text-muted-foreground"
                          >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Non configuré
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Package create/edit dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingPackage ? "Modifier le paquet" : "Ajouter un paquet"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Nom</Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Version</Label>
                  <Input
                    value={form.version}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, version: e.target.value }))
                    }
                    placeholder="1.0.0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Éditeur</Label>
                  <Input
                    value={form.publisher}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, publisher: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Plateforme</Label>
                  <Select
                    value={form.platform}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, platform: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Type d&apos;installeur</Label>
                  <Select
                    value={form.installer_type}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, installer_type: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INSTALLER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Arguments silencieux</Label>
                  <Input
                    value={form.silent_args}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, silent_args: e.target.value }))
                    }
                    placeholder="/quiet /norestart"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Chemin fichier</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.file_path}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, file_path: e.target.value }))
                    }
                    placeholder="\\server\share\installer.msi"
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    title="Parcourir"
                    aria-label="Parcourir"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  !form.name ||
                  !form.version ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
              >
                {editingPackage ? "Mettre à jour" : "Ajouter"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Deploy dialog */}
        <Dialog open={deployDialogOpen} onOpenChange={setDeployDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Déployer — {deployingPackage?.name} v{deployingPackage?.version}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Sélectionnez les machines cibles</Label>
                <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                  {(hardware ?? []).length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      Aucune machine disponible
                    </div>
                  ) : (
                    (hardware ?? []).map((hw) => (
                      <label
                        key={hw.id}
                        className="flex items-center gap-3 p-3 hover:bg-muted/30 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMachines.includes(hw.id)}
                          onChange={() => toggleMachine(hw.id)}
                        />
                        <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{hw.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {hw.type} · {hw.location ?? "—"}
                          </div>
                        </div>
                        {hw.status && (
                          <Badge
                            variant={
                              hw.status === "active" ? "default" : "outline"
                            }
                            className="text-xs"
                          >
                            {hw.status}
                          </Badge>
                        )}
                      </label>
                    ))
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedMachines.length} machine(s) sélectionnée(s)
                </div>
              </div>
              <div className="space-y-1">
                <Label>Planifier à (optionnel)</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
                <div className="text-xs text-muted-foreground">
                  Laissez vide pour déployer immédiatement lors du prochain
                  heartbeat agent
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeployDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleDeploy}
                disabled={
                  selectedMachines.length === 0 || deployMutation.isPending
                }
              >
                <Download className="h-4 w-4 mr-2" />
                Déployer sur {selectedMachines.length} machine(s)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
