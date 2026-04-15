"use client";

import { SpinnerInfinity } from "spinners-react";
import { useEffect, useState, useCallback, useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Terminal,
  Upload,
  Settings,
  RefreshCw,
  HardDrive,
  Cpu,
  FileJson,
  CheckCircle2,
  Trash2,
  Edit,
  Plus,
  Network,
  Clock,
  Download,
  PlayCircle,
  Globe,
  Package,
  Server,
  Monitor,
  AlertCircle,
  Layers,
} from "lucide-react";
import {
  pxeApi,
  PxeProfile,
  PxeAsset,
  PxeImage,
  PxeDeployment,
  OsImage,
  PostDeployHooks,
  CreatePxeProfileRequest,
  UpdatePxeProfileRequest,
  RegisterPxeAssetRequest,
  UpdatePxeAssetRequest,
} from "@/lib/api/pxe";
import { toast } from "sonner";
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
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { usePageTitle } from "@/hooks/use-page-title";

// ============================================================================
// Helpers
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function statusColor(status: string): string {
  switch (status) {
    case "deployed":
    case "completed":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    case "provisioning":
    case "deploying":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "discovered":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "failed":
      return "bg-red-500/10 text-red-600 border-red-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-600 border-zinc-500/20";
  }
}

function OsTypeBadge({ type }: { type: string }) {
  const lower = type.toLowerCase();
  if (lower === "linux")
    return (
      <Badge
        variant="outline"
        className="text-green-600 border-green-500/30 bg-green-500/5"
      >
        Linux
      </Badge>
    );
  if (lower === "windows")
    return (
      <Badge
        variant="outline"
        className="text-blue-600 border-blue-500/30 bg-blue-500/5"
      >
        Windows
      </Badge>
    );
  if (lower === "tool")
    return (
      <Badge
        variant="outline"
        className="text-orange-600 border-orange-500/30 bg-orange-500/5"
      >
        Tool
      </Badge>
    );
  if (lower === "hypervisor")
    return (
      <Badge
        variant="outline"
        className="text-purple-600 border-purple-500/30 bg-purple-500/5"
      >
        Hypervisor
      </Badge>
    );
  if (lower === "network")
    return (
      <Badge
        variant="outline"
        className="text-rose-600 border-rose-500/30 bg-rose-500/5"
      >
        Network
      </Badge>
    );
  return <Badge variant="outline">{type}</Badge>;
}

const CATALOG_CATEGORY_LABELS: Record<string, string> = {
  desktop: "Desktop",
  server: "Server",
  diagnostic: "Diagnostics & Repair",
  cloning: "Cloning & Imaging",
  security: "Network & Security",
  hypervisor: "Hypervisor",
  storage: "Storage / NAS",
};

const CATALOG_CATEGORY_ORDER = [
  "desktop",
  "server",
  "diagnostic",
  "cloning",
  "security",
  "hypervisor",
  "storage",
];

// ============================================================================
// Main component
// ============================================================================

export default function PXEDashboard() {
  usePageTitle("Deploiement PXE");

  // Data
  const [profiles, setProfiles] = useState<PxeProfile[]>([]);
  const [assets, setAssets] = useState<PxeAsset[]>([]);
  const [images, setImages] = useState<PxeImage[]>([]);
  const [deployments, setDeployments] = useState<PxeDeployment[]>([]);
  const [catalog, setCatalog] = useState<OsImage[]>([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  // ── Profile dialog ─────────────────────────────────────────────────────
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PxeProfile | null>(null);
  const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<CreatePxeProfileRequest>({
    name: "",
    description: "",
    boot_script: "#!ipxe\necho Booting...\nexit",
    os_type: "Linux",
    os_version: "",
    is_default: false,
  });
  const [saving, setSaving] = useState(false);

  // ── Asset dialog ──────────────────────────────────────────────────────
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<PxeAsset | null>(null);
  const [deleteAssetId, setDeleteAssetId] = useState<string | null>(null);
  const [assetForm, setAssetForm] = useState<RegisterPxeAssetRequest>({
    mac_address: "",
    hostname: "",
    profile_id: undefined,
  });

  // ── Image upload ──────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadForm, setUploadForm] = useState({
    name: "",
    os_type: "linux",
    os_version: "",
    image_type: "iso",
    description: "",
  });
  const [uploading, setUploading] = useState(false);
  const [deleteImageId, setDeleteImageId] = useState<string | null>(null);

  // ── Catalog download ──────────────────────────────────────────────────
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);
  const [catalogFilter, setCatalogFilter] = useState<string>("all");

  // ── Hooks dialog ──────────────────────────────────────────────────────
  const [hooksDialogOpen, setHooksDialogOpen] = useState(false);
  const [hooksProfileId, setHooksProfileId] = useState<string | null>(null);
  const [hooksProfileName, setHooksProfileName] = useState("");
  const [hooks, setHooks] = useState<PostDeployHooks>({
    run_scripts: [],
    install_packages: [],
    join_domain: undefined,
    notify_webhook: undefined,
  });
  const [hooksLoading, setHooksLoading] = useState(false);
  const [hooksSaving, setHooksSaving] = useState(false);
  const [hooksScriptInput, setHooksScriptInput] = useState("");
  const [hooksPackageInput, setHooksPackageInput] = useState("");

  // ── Deploy wizard ─────────────────────────────────────────────────────
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [deployStep, setDeployStep] = useState(1);
  const [deployAssetId, setDeployAssetId] = useState("");
  const [deployProfileId, setDeployProfileId] = useState("");

  // ============================================================================
  // Load data
  // ============================================================================

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [profilesRes, assetsRes, imagesRes, deploymentsRes, catalogRes] =
        await Promise.allSettled([
          pxeApi.listProfiles(),
          pxeApi.listAssets(),
          pxeApi.listImages(),
          pxeApi.listDeployments(),
          pxeApi.listCatalog(),
        ]);
      if (profilesRes.status === "fulfilled")
        setProfiles(profilesRes.value.data);
      if (assetsRes.status === "fulfilled") setAssets(assetsRes.value.data);
      if (imagesRes.status === "fulfilled") setImages(imagesRes.value.data);
      if (deploymentsRes.status === "fulfilled")
        setDeployments(deploymentsRes.value.data);
      if (catalogRes.status === "fulfilled") setCatalog(catalogRes.value.data);
    } catch (err) {
      console.warn("Failed to load PXE data:", err);
      toast.error("Impossible de charger les donnees PXE");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ============================================================================
  // Profile handlers
  // ============================================================================

  const openCreateProfile = () => {
    setEditingProfile(null);
    setProfileForm({
      name: "",
      description: "",
      boot_script:
        "#!ipxe\ndhcp\nchain http://${next-server}/boot/${mac}.ipxe || exit",
      os_type: "Linux",
      os_version: "",
      is_default: false,
    });
    setProfileDialogOpen(true);
  };

  const openEditProfile = (profile: PxeProfile) => {
    setEditingProfile(profile);
    setProfileForm({
      name: profile.name,
      description: profile.description || "",
      boot_script: profile.boot_script,
      os_type: profile.os_type || "Linux",
      os_version: profile.os_version || "",
      is_default: profile.is_default || false,
    });
    setProfileDialogOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!profileForm.name || !profileForm.boot_script) {
      toast.error("Nom et script de boot requis");
      return;
    }
    try {
      setSaving(true);
      if (editingProfile) {
        const updated = (
          await pxeApi.updateProfile(
            editingProfile.id,
            profileForm as UpdatePxeProfileRequest,
          )
        ).data;
        setProfiles((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p)),
        );
        toast.success("Profil mis a jour");
      } else {
        const created = (await pxeApi.createProfile(profileForm)).data;
        setProfiles((prev) => [...prev, created]);
        toast.success("Profil cree");
      }
      setProfileDialogOpen(false);
    } catch (err) {
      console.warn("Error saving profile:", err);
      toast.error("Echec de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfileConfirm = async () => {
    if (!deleteProfileId) return;
    const id = deleteProfileId;
    setDeleteProfileId(null);
    try {
      await pxeApi.deleteProfile(id);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      toast.success("Profil supprime");
    } catch (err) {
      console.warn("Error deleting profile:", err);
      toast.error("Echec de la suppression");
    }
  };

  // ============================================================================
  // Asset handlers
  // ============================================================================

  const openCreateAsset = () => {
    setEditingAsset(null);
    setAssetForm({ mac_address: "", hostname: "", profile_id: undefined });
    setAssetDialogOpen(true);
  };

  const openEditAsset = (asset: PxeAsset) => {
    setEditingAsset(asset);
    setAssetForm({
      mac_address: asset.mac_address,
      hostname: asset.hostname || "",
      profile_id: asset.profile_id,
    });
    setAssetDialogOpen(true);
  };

  const handleSaveAsset = async () => {
    if (!assetForm.mac_address) {
      toast.error("Adresse MAC requise");
      return;
    }
    try {
      setSaving(true);
      if (editingAsset) {
        const updateData: UpdatePxeAssetRequest = {
          hostname: assetForm.hostname || undefined,
          profile_id: assetForm.profile_id,
        };
        const updated = (await pxeApi.updateAsset(editingAsset.id, updateData))
          .data;
        setAssets((prev) =>
          prev.map((a) => (a.id === updated.id ? updated : a)),
        );
        toast.success("Asset mis a jour");
      } else {
        const created = (await pxeApi.registerAsset(assetForm)).data;
        setAssets((prev) => [...prev, created]);
        toast.success("Asset enregistre");
      }
      setAssetDialogOpen(false);
    } catch (err) {
      console.warn("Error saving asset:", err);
      toast.error("Echec de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssetConfirm = async () => {
    if (!deleteAssetId) return;
    const id = deleteAssetId;
    setDeleteAssetId(null);
    try {
      await pxeApi.deleteAsset(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      toast.success("Asset supprime");
    } catch (err) {
      console.warn("Error deleting asset:", err);
      toast.error("Echec de la suppression");
    }
  };

  // ============================================================================
  // Image upload
  // ============================================================================

  const handleUploadImage = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Selectionnez un fichier ISO");
      return;
    }
    if (!uploadForm.name) {
      setUploadForm((prev) => ({ ...prev, name: file.name }));
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", uploadForm.name || file.name);
    formData.append("os_type", uploadForm.os_type);
    if (uploadForm.os_version)
      formData.append("os_version", uploadForm.os_version);
    formData.append("image_type", uploadForm.image_type);
    if (uploadForm.description)
      formData.append("description", uploadForm.description);

    try {
      setUploading(true);
      const created = (await pxeApi.uploadImage(formData)).data;
      setImages((prev) => [created, ...prev]);
      toast.success(
        `Image "${created.name}" uploadee (SHA-256: ${created.file_hash?.slice(0, 12)}...)`,
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadForm({
        name: "",
        os_type: "linux",
        os_version: "",
        image_type: "iso",
        description: "",
      });
    } catch (err) {
      console.warn("Upload error:", err);
      toast.error("Echec de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImageConfirm = async () => {
    if (!deleteImageId) return;
    const id = deleteImageId;
    setDeleteImageId(null);
    try {
      await pxeApi.deleteImage(id);
      setImages((prev) => prev.filter((i) => i.id !== id));
      toast.success("Image supprimee");
    } catch (err) {
      console.warn("Error deleting image:", err);
      toast.error("Echec de la suppression");
    }
  };

  // ============================================================================
  // Catalog download
  // ============================================================================

  const handleCatalogDownload = async (index: number, image: OsImage) => {
    if (!image.iso_url) {
      toast.error(`${image.name} n'a pas d'URL de telechargement public`);
      return;
    }
    try {
      setDownloadingIndex(index);
      const res = (await pxeApi.downloadCatalogImage(index)).data;
      toast.success(
        `Telechargement demarre : ${res.name} ${res.version}. ID: ${res.download_id.slice(0, 8)}`,
      );
    } catch (err) {
      console.warn("Catalog download error:", err);
      toast.error(`Echec du telechargement de ${image.name}`);
    } finally {
      setDownloadingIndex(null);
    }
  };

  // ============================================================================
  // Hooks
  // ============================================================================

  const openHooks = async (profile: PxeProfile) => {
    setHooksProfileId(profile.id);
    setHooksProfileName(profile.name);
    setHooksLoading(true);
    setHooksDialogOpen(true);
    try {
      const h = (await pxeApi.getHooks(profile.id)).data;
      setHooks(h);
      setHooksScriptInput(h.run_scripts.join("\n"));
      setHooksPackageInput(h.install_packages.join("\n"));
    } catch (err) {
      console.warn("Error loading hooks:", err);
      toast.error("Impossible de charger les hooks");
    } finally {
      setHooksLoading(false);
    }
  };

  const handleSaveHooks = async () => {
    if (!hooksProfileId) return;
    const updatedHooks: PostDeployHooks = {
      run_scripts: hooksScriptInput
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      install_packages: hooksPackageInput
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean),
      join_domain: hooks.join_domain,
      notify_webhook: hooks.notify_webhook || undefined,
    };
    try {
      setHooksSaving(true);
      await pxeApi.updateHooks(hooksProfileId, updatedHooks);
      setHooks(updatedHooks);
      toast.success("Hooks sauvegardes");
      setHooksDialogOpen(false);
    } catch (err) {
      console.warn("Error saving hooks:", err);
      toast.error("Echec de la sauvegarde des hooks");
    } finally {
      setHooksSaving(false);
    }
  };

  // ============================================================================
  // Deploy wizard
  // ============================================================================

  const openDeployWizard = () => {
    setDeployStep(1);
    setDeployAssetId("");
    setDeployProfileId("");
    setDeployDialogOpen(true);
  };

  const handleDeploy = async () => {
    if (!deployAssetId || !deployProfileId) {
      toast.error("Selectionnez une machine et un profil");
      return;
    }
    const asset = assets.find((a) => a.id === deployAssetId);
    if (!asset) {
      toast.error("Machine introuvable");
      return;
    }
    try {
      await pxeApi.updateAsset(deployAssetId, {
        profile_id: deployProfileId,
        status: "provisioning",
      });
      setAssets((prev) =>
        prev.map((a) =>
          a.id === deployAssetId
            ? { ...a, profile_id: deployProfileId, status: "provisioning" }
            : a,
        ),
      );
      toast.success(
        `Deploiement configure pour ${asset.hostname || asset.mac_address}`,
      );
      setDeployDialogOpen(false);
    } catch (err) {
      console.warn("Deploy error:", err);
      toast.error("Echec du deploiement");
    }
  };

  // ============================================================================
  // Computed stats
  // ============================================================================

  const deployedCount = assets.filter((a) => a.status === "deployed").length;
  const deployingCount = deployments.filter(
    (d) => d.status === "deploying",
  ).length;
  const recentDeployments = deployments.slice(0, 5);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-500 to-amber-700 bg-clip-text text-transparent">
              PXE Deployment Server
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Gerer les profils de boot reseau, images ISO et installations
              automatisees.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openDeployWizard}>
              <PlayCircle className="mr-2 h-4 w-4" /> Deployer
            </Button>
            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw
                className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Rafraichir
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            {
              label: "TFTP Status",
              value: "Online",
              sub: "Ecoute sur UDP port 69",
              color: "from-blue-500 to-indigo-500",
              icon: (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              ),
            },
            {
              label: "Profils de boot",
              value: profiles.length,
              sub: "Scripts iPXE configures",
              color: "from-amber-400 to-orange-500",
              icon: <FileJson className="h-4 w-4 text-muted-foreground" />,
            },
            {
              label: "Assets decouverts",
              value: assets.length,
              sub: "Machines tracees par MAC",
              color: "from-purple-500 to-pink-500",
              icon: <Network className="h-4 w-4 text-muted-foreground" />,
            },
            {
              label: "Deploiements",
              value: deployedCount,
              sub: `${deployingCount} en cours`,
              color: "from-emerald-500 to-teal-500",
              icon: <Cpu className="h-4 w-4 text-muted-foreground" />,
            },
          ].map((stat, i) => (
            <Card
              key={i}
              className="border-border/50 bg-card overflow-hidden relative group"
            >
              <div
                className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${stat.color} transform translate-y-1 group-hover:translate-y-0 transition-transform`}
              />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.label}
                </CardTitle>
                {stat.icon}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="dashboard" className="gap-1.5">
              <Layers className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="images" className="gap-1.5">
              <HardDrive className="h-4 w-4" />
              Images
            </TabsTrigger>
            <TabsTrigger value="profiles" className="gap-1.5">
              <Terminal className="h-4 w-4" />
              Profils
            </TabsTrigger>
            <TabsTrigger value="machines" className="gap-1.5">
              <Server className="h-4 w-4" />
              Machines
            </TabsTrigger>
            <TabsTrigger value="deploy" className="gap-1.5">
              <PlayCircle className="h-4 w-4" />
              Deployer
            </TabsTrigger>
            <TabsTrigger value="hooks" className="gap-1.5">
              <Settings className="h-4 w-4" />
              Hooks
            </TabsTrigger>
          </TabsList>

          {/* ── DASHBOARD TAB ── */}
          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Deploiements recents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentDeployments.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      Aucun deploiement
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {recentDeployments.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="font-mono text-sm truncate">
                              {d.asset_mac}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {d.current_step || d.status}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-xs font-medium ${statusColor(d.status)}`}
                            >
                              {d.status}
                            </span>
                            {d.status === "deploying" && (
                              <Progress
                                value={d.progress}
                                className="w-20 h-1"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Vue d'ensemble</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    {
                      label: "Images uploadees",
                      value: images.length,
                      icon: (
                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                      ),
                    },
                    {
                      label: "Profils iPXE",
                      value: profiles.length,
                      icon: (
                        <Terminal className="h-4 w-4 text-muted-foreground" />
                      ),
                    },
                    {
                      label: "Machines decouverts",
                      value: assets.length,
                      icon: (
                        <Network className="h-4 w-4 text-muted-foreground" />
                      ),
                    },
                    {
                      label: "Images catalogue",
                      value: catalog.length,
                      icon: <Globe className="h-4 w-4 text-muted-foreground" />,
                    },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {item.icon}
                        <span className="text-sm">{item.label}</span>
                      </div>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── IMAGES TAB ── */}
          <TabsContent value="images" className="space-y-4">
            {/* Upload card */}
            <Card>
              <CardHeader>
                <CardTitle>Uploader une image ISO</CardTitle>
                <CardDescription>
                  SHA-256 calcule automatiquement lors de l'upload.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <Label>Fichier ISO</Label>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".iso,.img,.bin"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Nom</Label>
                    <Input
                      className="mt-1"
                      placeholder="Ubuntu 24.04 Server"
                      value={uploadForm.name}
                      onChange={(e) =>
                        setUploadForm((p) => ({ ...p, name: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Type d'OS</Label>
                    <Select
                      value={uploadForm.os_type}
                      onValueChange={(v) =>
                        setUploadForm((p) => ({ ...p, os_type: v }))
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="linux">Linux</SelectItem>
                        <SelectItem value="windows">Windows</SelectItem>
                        <SelectItem value="bsd">BSD</SelectItem>
                        <SelectItem value="other">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Version</Label>
                    <Input
                      className="mt-1"
                      placeholder="24.04"
                      value={uploadForm.os_version}
                      onChange={(e) =>
                        setUploadForm((p) => ({
                          ...p,
                          os_version: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <Button onClick={handleUploadImage} disabled={uploading}>
                  {uploading ? (
                    <SpinnerInfinity
                      size={16}
                      secondaryColor="rgba(128,128,128,0.2)"
                      color="currentColor"
                      speed={120}
                      className="mr-2 h-4 w-4"
                    />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Uploader
                </Button>
              </CardContent>
            </Card>

            {/* Images list */}
            <Card>
              <CardHeader>
                <CardTitle>Images uploadees ({images.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <SpinnerInfinity
                      size={24}
                      secondaryColor="rgba(128,128,128,0.2)"
                      color="currentColor"
                      speed={120}
                      className="h-8 w-8 text-muted-foreground"
                    />
                  </div>
                ) : images.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <HardDrive className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>Aucune image uploadee</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom</TableHead>
                          <TableHead>OS</TableHead>
                          <TableHead>Taille</TableHead>
                          <TableHead>SHA-256</TableHead>
                          <TableHead>Ajoute</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {images.map((img) => (
                          <TableRow key={img.id}>
                            <TableCell className="font-medium">
                              {img.name}
                            </TableCell>
                            <TableCell>
                              <OsTypeBadge type={img.os_type} />
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {img.file_size ? formatBytes(img.file_size) : "-"}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {img.file_hash
                                ? `${img.file_hash.slice(0, 16)}...`
                                : "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {img.created_at
                                ? formatDistanceToNow(
                                    new Date(img.created_at),
                                    { addSuffix: true, locale: fr },
                                  )
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => setDeleteImageId(img.id)}
                              >
                                <Trash2 className="h-4 w-4" />
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

            {/* Catalog */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Catalogue d'images OS</CardTitle>
                    <CardDescription>
                      {catalog.length} images — telechargeables depuis leurs
                      sources officielles.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(["all", ...CATALOG_CATEGORY_ORDER] as string[]).map(
                      (cat) => (
                        <button
                          key={cat}
                          onClick={() => setCatalogFilter(cat)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                            catalogFilter === cat
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-transparent text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {cat === "all"
                            ? "Tout"
                            : (CATALOG_CATEGORY_LABELS[cat] ?? cat)}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const filteredCatalog = catalog
                    .map((img, originalIndex) => ({ img, originalIndex }))
                    .filter(
                      ({ img }) =>
                        catalogFilter === "all" ||
                        img.category === catalogFilter,
                    );

                  const groups = CATALOG_CATEGORY_ORDER.map((cat) => ({
                    cat,
                    label: CATALOG_CATEGORY_LABELS[cat] ?? cat,
                    items: filteredCatalog.filter(
                      ({ img }) => img.category === cat,
                    ),
                  })).filter((g) => g.items.length > 0);

                  if (groups.length === 0) {
                    return (
                      <p className="text-center py-8 text-muted-foreground text-sm">
                        Aucune image dans cette categorie.
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-6">
                      {groups.map(({ cat, label, items }) => (
                        <div key={cat}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {label}
                            </span>
                            <span className="text-xs text-muted-foreground/60">
                              ({items.length})
                            </span>
                            <div className="flex-1 h-px bg-border" />
                          </div>
                          <div className="rounded-md border overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Nom</TableHead>
                                  <TableHead>Version</TableHead>
                                  <TableHead>Arch</TableHead>
                                  <TableHead className="hidden md:table-cell">
                                    Description
                                  </TableHead>
                                  <TableHead>Taille</TableHead>
                                  <TableHead className="text-right">
                                    Action
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {items.map(({ img, originalIndex }) => (
                                  <TableRow key={originalIndex}>
                                    <TableCell className="font-medium">
                                      <div className="flex items-center gap-2">
                                        <OsTypeBadge type={img.os_type} />
                                        <span className="whitespace-nowrap">
                                          {img.name}
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-sm whitespace-nowrap">
                                      {img.version}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                      {img.arch}
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-xs truncate">
                                      {img.description}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                                      {img.size_bytes > 0
                                        ? formatBytes(img.size_bytes)
                                        : "—"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {img.iso_url ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={
                                            downloadingIndex === originalIndex
                                          }
                                          onClick={() =>
                                            handleCatalogDownload(
                                              originalIndex,
                                              img,
                                            )
                                          }
                                        >
                                          {downloadingIndex ===
                                          originalIndex ? (
                                            <SpinnerInfinity
                                              size={14}
                                              secondaryColor="rgba(128,128,128,0.2)"
                                              color="currentColor"
                                              speed={120}
                                              className="mr-1.5 h-3.5 w-3.5"
                                            />
                                          ) : (
                                            <Download className="mr-1.5 h-3.5 w-3.5" />
                                          )}
                                          Telecharger
                                        </Button>
                                      ) : (
                                        <span className="text-xs text-muted-foreground italic">
                                          Licence requise
                                        </span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PROFILES TAB ── */}
          <TabsContent value="profiles" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Profils de boot iPXE</CardTitle>
                  <CardDescription>
                    Scripts iPXE pour le boot reseau des clients.
                  </CardDescription>
                </div>
                <Button onClick={openCreateProfile}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouveau profil
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <SpinnerInfinity
                      size={24}
                      secondaryColor="rgba(128,128,128,0.2)"
                      color="currentColor"
                      speed={120}
                      className="h-8 w-8 text-muted-foreground"
                    />
                  </div>
                ) : profiles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Terminal className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>Aucun profil configure</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom</TableHead>
                          <TableHead>OS</TableHead>
                          <TableHead>Version</TableHead>
                          <TableHead>Mis a jour</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {profiles.map((profile) => (
                          <TableRow key={profile.id} className="group">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Terminal className="h-4 w-4 text-muted-foreground" />
                                {profile.name}
                                {profile.is_default && (
                                  <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-primary/20 text-primary font-semibold uppercase">
                                    Defaut
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{profile.os_type || "-"}</TableCell>
                            <TableCell>{profile.os_version || "-"}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {profile.updated_at
                                ? formatDistanceToNow(
                                    new Date(profile.updated_at),
                                    { addSuffix: true, locale: fr },
                                  )
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditProfile(profile)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => setDeleteProfileId(profile.id)}
                              >
                                <Trash2 className="h-4 w-4" />
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
          </TabsContent>

          {/* ── MACHINES TAB ── */}
          <TabsContent value="machines" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Machines PXE</CardTitle>
                  <CardDescription>
                    Machines tracees par adresse MAC. Le boot PXE les enregistre
                    automatiquement.
                  </CardDescription>
                </div>
                <Button onClick={openCreateAsset}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <SpinnerInfinity
                      size={24}
                      secondaryColor="rgba(128,128,128,0.2)"
                      color="currentColor"
                      speed={120}
                      className="h-8 w-8 text-muted-foreground"
                    />
                  </div>
                ) : assets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <HardDrive className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>Aucune machine decouverte</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>MAC</TableHead>
                          <TableHead>Hostname</TableHead>
                          <TableHead>IP</TableHead>
                          <TableHead>Profil</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Derniere activite</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assets.map((asset) => (
                          <TableRow key={asset.id}>
                            <TableCell className="font-mono text-sm">
                              {asset.mac_address}
                            </TableCell>
                            <TableCell>{asset.hostname || "-"}</TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">
                              {asset.ip_address || "-"}
                            </TableCell>
                            <TableCell>
                              {asset.profile_id ? (
                                profiles.find((p) => p.id === asset.profile_id)
                                  ?.name || "-"
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  Defaut
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-medium text-xs ${statusColor(asset.status)}`}
                              >
                                {asset.status === "deployed" && (
                                  <CheckCircle2 className="h-3 w-3" />
                                )}
                                {asset.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {asset.last_seen ? (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(
                                    new Date(asset.last_seen),
                                    { addSuffix: true, locale: fr },
                                  )}
                                </span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditAsset(asset)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => setDeleteAssetId(asset.id)}
                              >
                                <Trash2 className="h-4 w-4" />
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
          </TabsContent>

          {/* ── DEPLOY TAB ── */}
          <TabsContent value="deploy" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Assistant de deploiement</CardTitle>
                <CardDescription>
                  Selectionnez une machine et un profil, puis lancez le
                  deploiement.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-w-lg">
                <div className="space-y-2">
                  <Label>Machine cible</Label>
                  <Select
                    value={deployAssetId}
                    onValueChange={setDeployAssetId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectionner une machine..." />
                    </SelectTrigger>
                    <SelectContent>
                      {assets.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.hostname || a.mac_address} — {a.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Profil de boot</Label>
                  <Select
                    value={deployProfileId}
                    onValueChange={setDeployProfileId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectionner un profil..." />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {p.is_default ? "(defaut)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {deployAssetId && deployProfileId && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm space-y-1">
                    <p className="font-medium text-amber-600">
                      Resume du deploiement
                    </p>
                    <p className="text-muted-foreground">
                      Machine:{" "}
                      <strong>
                        {assets.find((a) => a.id === deployAssetId)?.hostname ||
                          assets.find((a) => a.id === deployAssetId)
                            ?.mac_address}
                      </strong>
                    </p>
                    <p className="text-muted-foreground">
                      Profil:{" "}
                      <strong>
                        {profiles.find((p) => p.id === deployProfileId)?.name}
                      </strong>
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleDeploy}
                  disabled={!deployAssetId || !deployProfileId}
                  className="w-full"
                >
                  <PlayCircle className="mr-2 h-4 w-4" /> Lancer le deploiement
                </Button>
              </CardContent>
            </Card>

            {/* Deployment history */}
            {deployments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Historique des deploiements</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>MAC</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Progression</TableHead>
                          <TableHead>Etape</TableHead>
                          <TableHead>Debut</TableHead>
                          <TableHead>Fin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deployments.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="font-mono text-sm">
                              {d.asset_mac}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-xs font-medium ${statusColor(d.status)}`}
                              >
                                {d.status === "failed" && (
                                  <AlertCircle className="h-3 w-3" />
                                )}
                                {d.status === "completed" && (
                                  <CheckCircle2 className="h-3 w-3" />
                                )}
                                {d.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={d.progress}
                                  className="w-20 h-1.5"
                                />
                                <span className="text-xs text-muted-foreground">
                                  {d.progress}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {d.current_step || "-"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {d.started_at
                                ? format(new Date(d.started_at), "dd/MM HH:mm")
                                : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {d.completed_at
                                ? format(
                                    new Date(d.completed_at),
                                    "dd/MM HH:mm",
                                  )
                                : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── HOOKS TAB ── */}
          <TabsContent value="hooks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Hooks post-deploiement</CardTitle>
                <CardDescription>
                  Configurez les actions a executer apres l'installation pour
                  chaque profil.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {profiles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Settings className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>Aucun profil. Creez d'abord un profil iPXE.</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Profil</TableHead>
                          <TableHead>OS</TableHead>
                          <TableHead className="text-right">
                            Configurer les hooks
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {profiles.map((profile) => (
                          <TableRow key={profile.id}>
                            <TableCell className="font-medium">
                              {profile.name}
                            </TableCell>
                            <TableCell>{profile.os_type || "-"}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openHooks(profile)}
                              >
                                <Settings className="mr-1.5 h-3.5 w-3.5" />{" "}
                                Configurer
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
          </TabsContent>
        </Tabs>
      </div>

      {/* ── PROFILE DIALOG ── */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingProfile ? "Modifier le profil" : "Nouveau profil de boot"}
            </DialogTitle>
            <DialogDescription>
              Configurer un script iPXE pour le boot reseau
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Nom</Label>
                <Input
                  placeholder="Ubuntu 24.04 LTS"
                  value={profileForm.name}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Type d'OS</Label>
                <Select
                  value={profileForm.os_type}
                  onValueChange={(v) =>
                    setProfileForm((p) => ({ ...p, os_type: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Linux">Linux</SelectItem>
                    <SelectItem value="Windows">Windows</SelectItem>
                    <SelectItem value="BSD">BSD</SelectItem>
                    <SelectItem value="Tool">Tool/Diagnostic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Version</Label>
              <Input
                placeholder="24.04"
                value={profileForm.os_version}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, os_version: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input
                placeholder="Installation automatisee..."
                value={profileForm.description}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Script iPXE</Label>
              <Textarea
                className="font-mono text-sm min-h-[200px]"
                placeholder="#!ipxe&#10;dhcp&#10;boot http://..."
                value={profileForm.boot_script}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, boot_script: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_default"
                checked={profileForm.is_default}
                onCheckedChange={(checked) =>
                  setProfileForm((p) => ({ ...p, is_default: checked }))
                }
              />
              <Label htmlFor="is_default">Profil par defaut</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProfileDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving && (
                <SpinnerInfinity
                  size={16}
                  secondaryColor="rgba(128,128,128,0.2)"
                  color="currentColor"
                  speed={120}
                  className="mr-2 h-4 w-4"
                />
              )}
              {editingProfile ? "Sauvegarder" : "Creer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ASSET DIALOG ── */}
      <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingAsset ? "Modifier l'asset" : "Ajouter un asset"}
            </DialogTitle>
            <DialogDescription>
              Enregistrer une machine par son adresse MAC
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Adresse MAC</Label>
              <Input
                placeholder="00:1A:2B:3C:4D:5E"
                value={assetForm.mac_address}
                onChange={(e) =>
                  setAssetForm((p) => ({
                    ...p,
                    mac_address: e.target.value.toUpperCase(),
                  }))
                }
                disabled={!!editingAsset}
              />
            </div>
            <div className="grid gap-2">
              <Label>Hostname</Label>
              <Input
                placeholder="srv-web-01"
                value={assetForm.hostname}
                onChange={(e) =>
                  setAssetForm((p) => ({ ...p, hostname: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Profil de boot</Label>
              <Select
                value={assetForm.profile_id || "default"}
                onValueChange={(v) =>
                  setAssetForm((p) => ({
                    ...p,
                    profile_id: v === "default" ? undefined : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Profil par defaut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Profil par defaut</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveAsset} disabled={saving}>
              {saving && (
                <SpinnerInfinity
                  size={16}
                  secondaryColor="rgba(128,128,128,0.2)"
                  color="currentColor"
                  speed={120}
                  className="mr-2 h-4 w-4"
                />
              )}
              {editingAsset ? "Sauvegarder" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── HOOKS DIALOG ── */}
      <Dialog open={hooksDialogOpen} onOpenChange={setHooksDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              Hooks post-deploiement — {hooksProfileName}
            </DialogTitle>
            <DialogDescription>
              Actions executees automatiquement apres l'installation.
            </DialogDescription>
          </DialogHeader>
          {hooksLoading ? (
            <div className="flex justify-center py-8">
              <SpinnerInfinity
                size={24}
                secondaryColor="rgba(128,128,128,0.2)"
                color="currentColor"
                speed={120}
                className="h-8 w-8 text-muted-foreground"
              />
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Scripts a executer (un par ligne)</Label>
                <Textarea
                  className="font-mono text-sm min-h-[100px]"
                  placeholder="https://example.com/setup.sh&#10;/opt/scripts/configure.sh"
                  value={hooksScriptInput}
                  onChange={(e) => setHooksScriptInput(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Paquets a installer (un par ligne)</Label>
                <Textarea
                  className="font-mono text-sm min-h-[80px]"
                  placeholder="curl&#10;git&#10;htop"
                  value={hooksPackageInput}
                  onChange={(e) => setHooksPackageInput(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Webhook de notification (optionnel)</Label>
                <Input
                  placeholder="https://hooks.example.com/pxe-done"
                  value={hooks.notify_webhook || ""}
                  onChange={(e) =>
                    setHooks((h) => ({
                      ...h,
                      notify_webhook: e.target.value || undefined,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Jonction de domaine (optionnel)</Label>
                <Input
                  placeholder="domain.local"
                  value={hooks.join_domain?.domain || ""}
                  onChange={(e) =>
                    setHooks((h) => ({
                      ...h,
                      join_domain: e.target.value
                        ? { domain: e.target.value }
                        : undefined,
                    }))
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHooksDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveHooks}
              disabled={hooksSaving || hooksLoading}
            >
              {hooksSaving && (
                <SpinnerInfinity
                  size={16}
                  secondaryColor="rgba(128,128,128,0.2)"
                  color="currentColor"
                  speed={120}
                  className="mr-2 h-4 w-4"
                />
              )}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DEPLOY WIZARD DIALOG ── */}
      <Dialog open={deployDialogOpen} onOpenChange={setDeployDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Assistant de deploiement rapide</DialogTitle>
            <DialogDescription>
              Assignez un profil a une machine et demarrez le deploiement.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Machine</Label>
              <Select value={deployAssetId} onValueChange={setDeployAssetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.hostname || a.mac_address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Profil de boot</Label>
              <Select
                value={deployProfileId}
                onValueChange={setDeployProfileId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              disabled={!deployAssetId || !deployProfileId}
            >
              <PlayCircle className="mr-2 h-4 w-4" /> Deployer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CONFIRM DIALOGS ── */}
      <AlertDialog
        open={!!deleteProfileId}
        onOpenChange={() => setDeleteProfileId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce profil ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProfileConfirm}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteAssetId}
        onOpenChange={() => setDeleteAssetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet asset ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAssetConfirm}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteImageId}
        onOpenChange={() => setDeleteImageId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette image ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le fichier sera supprime du serveur. Cette action est
              irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteImageConfirm}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
