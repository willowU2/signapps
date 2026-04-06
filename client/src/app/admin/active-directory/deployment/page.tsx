"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HardDrive,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  Package,
  Plus,
  Trash2,
} from "lucide-react";
import {
  useAdDomains,
  useDeployProfiles,
  useDeployHistory,
} from "@/hooks/use-active-directory";
import type { DeployProfile, DeployHistory } from "@/types/active-directory";
import { adApi } from "@/lib/api/active-directory";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  DeployHistory["status"],
  { label: string; className: string }
> = {
  pending: {
    label: "En attente",
    className:
      "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
  },
  booting: {
    label: "Démarrage",
    className:
      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  },
  installing: {
    label: "Installation",
    className:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  },
  configuring: {
    label: "Configuration",
    className:
      "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  },
  completed: {
    label: "Terminé",
    className:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  },
  failed: {
    label: "Echec",
    className:
      "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  },
};

function formatDate(iso: string | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function packagesCount(packages: unknown[]): number {
  return Array.isArray(packages) ? packages.length : 0;
}

// ── History Panel ─────────────────────────────────────────────────────────────

function HistoryPanel({
  profile,
  onBack,
}: {
  profile: DeployProfile;
  onBack: () => void;
}) {
  const { data: history = [], isLoading } = useDeployHistory(profile.id);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
          <div>
            <CardTitle>
              Historique — {profile.name}
              {profile.os_type && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({profile.os_type}
                  {profile.os_version ? ` ${profile.os_version}` : ""})
                </span>
              )}
            </CardTitle>
            <CardDescription>50 derniers déploiements</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">
            <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin" />
            Chargement...
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            <HardDrive className="h-10 w-10 mx-auto mb-3 opacity-20" />
            Aucun déploiement enregistré pour ce profil.
          </div>
        ) : (
          <div className="rounded-b-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hostname</TableHead>
                  <TableHead className="w-[130px]">Statut</TableHead>
                  <TableHead className="w-[160px]">Démarré</TableHead>
                  <TableHead className="w-[160px]">Terminé</TableHead>
                  <TableHead>Erreur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => {
                  const cfg = STATUS_CONFIG[entry.status] ?? {
                    label: entry.status,
                    className: "",
                  };
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-sm">
                        {entry.hostname ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-medium ${cfg.className}`}
                        >
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(entry.started_at)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(entry.completed_at)}
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-[240px] truncate">
                        {entry.error_message ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DeploymentPage() {
  usePageTitle("Deploiement — Active Directory");

  const [domainId, setDomainId] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<DeployProfile | null>(
    null,
  );

  // Create profile dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newOsType, setNewOsType] = useState("");
  const [newOsVersion, setNewOsVersion] = useState("");

  const {
    data: domains = [],
    isLoading: loadingDomains,
    isError: domainsError,
    refetch: refetchDomains,
  } = useAdDomains();

  const activeDomainId = domainId || domains[0]?.id || "";

  const {
    data: profiles = [],
    isLoading: loadingProfiles,
    refetch: refetchProfiles,
  } = useDeployProfiles(activeDomainId);

  const handleDomainChange = (v: string) => {
    setDomainId(v);
    setSelectedProfile(null);
  };

  const openCreateDialog = () => {
    setNewName("");
    setNewDescription("");
    setNewOsType("");
    setNewOsVersion("");
    setCreateOpen(true);
  };

  const handleCreateProfile = async () => {
    if (!newName.trim()) {
      toast.error("Le nom du profil est obligatoire.");
      return;
    }
    if (!activeDomainId) {
      toast.error("Aucun domaine sélectionné.");
      return;
    }
    setCreating(true);
    try {
      await adApi.deploy.createProfile(activeDomainId, {
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        os_type: newOsType || undefined,
        os_version: newOsVersion.trim() || undefined,
      });
      toast.success(`Profil "${newName.trim()}" créé avec succès.`);
      setCreateOpen(false);
      void refetchProfiles();
    } catch {
      toast.error("Erreur lors de la création du profil.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProfile = async (
    e: React.MouseEvent,
    profile: DeployProfile,
  ) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Supprimer le profil "${profile.name}" ? Cette action est irréversible.`,
      )
    ) {
      return;
    }
    try {
      await adApi.deploy.deleteProfile(profile.id);
      toast.success(`Profil "${profile.name}" supprimé.`);
      void refetchProfiles();
    } catch {
      toast.error("Erreur lors de la suppression du profil.");
    }
  };

  if (loadingDomains) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageBreadcrumb
            items={[
              { label: "Administration", href: "/admin" },
              { label: "Active Directory", href: "/admin/active-directory" },
              { label: "Deploiement" },
            ]}
          />
          <PageHeader
            title="Deploiement"
            description="Profils de déploiement OS et historique PXE"
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
          <PageBreadcrumb
            items={[
              { label: "Administration", href: "/admin" },
              { label: "Active Directory", href: "/admin/active-directory" },
              { label: "Deploiement" },
            ]}
          />
          <PageHeader
            title="Deploiement"
            description="Profils de déploiement OS et historique PXE"
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
        <PageBreadcrumb
          items={[
            { label: "Administration", href: "/admin" },
            { label: "Active Directory", href: "/admin/active-directory" },
            { label: "Deploiement" },
          ]}
        />
        <PageHeader
          title="Deploiement"
          description="Profils de déploiement OS et historique PXE"
          icon={<HardDrive className="h-5 w-5" />}
          actions={
            <div className="flex items-center gap-2">
              {domains.length > 0 && (
                <Select
                  value={activeDomainId}
                  onValueChange={handleDomainChange}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Sélectionner un domaine" />
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
                onClick={() => refetchProfiles()}
                disabled={loadingProfiles}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loadingProfiles ? "animate-spin" : ""}`}
                />
                Rafraichir
              </Button>
              {activeDomainId && (
                <Button size="sm" onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau profil
                </Button>
              )}
            </div>
          }
        />

        {/* Domain selector (body area) */}
        {domains.length > 1 && !selectedProfile && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Domaine</Label>
            <Select value={activeDomainId} onValueChange={handleDomainChange}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Sélectionner un domaine" />
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

        {/* Empty state — no domains */}
        {domains.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-20" />
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

        {/* History panel when a profile is selected */}
        {selectedProfile ? (
          <HistoryPanel
            profile={selectedProfile}
            onBack={() => setSelectedProfile(null)}
          />
        ) : (
          /* Profiles table */
          activeDomainId && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Profils de deploiement</CardTitle>
                <CardDescription>
                  {profiles.length} profil(s) — cliquez sur une ligne pour
                  afficher l&apos;historique
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingProfiles ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin" />
                    Chargement...
                  </div>
                ) : profiles.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    <HardDrive className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    Aucun profil de déploiement pour ce domaine.
                  </div>
                ) : (
                  <div className="rounded-b-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom</TableHead>
                          <TableHead>Type OS</TableHead>
                          <TableHead>Version OS</TableHead>
                          <TableHead>OU cible</TableHead>
                          <TableHead className="w-[90px]">Par defaut</TableHead>
                          <TableHead className="w-[90px]">Paquets</TableHead>
                          <TableHead className="w-[48px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {profiles.map((profile) => (
                          <TableRow
                            key={profile.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedProfile(profile)}
                          >
                            <TableCell className="font-medium">
                              {profile.name}
                            </TableCell>
                            <TableCell className="text-sm">
                              {profile.os_type ?? (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {profile.os_version ?? "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground max-w-[180px] truncate">
                              {profile.target_ou ?? "—"}
                            </TableCell>
                            <TableCell>
                              {profile.is_default ? (
                                <Badge
                                  variant="outline"
                                  className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 text-[10px]"
                                >
                                  Defaut
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  —
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1 text-sm">
                                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                {packagesCount(profile.packages)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={(e) => handleDeleteProfile(e, profile)}
                                title="Supprimer ce profil"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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
          )
        )}
      </div>

      {/* Create profile dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Nouveau profil de deploiement</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">
                Nom <span className="text-destructive">*</span>
              </Label>
              <Input
                id="profile-name"
                placeholder="ex: Windows 11 Standard"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={creating}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-description">
                Description{" "}
                <span className="text-muted-foreground text-xs">
                  (optionnel)
                </span>
              </Label>
              <Input
                id="profile-description"
                placeholder="Description du profil"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                disabled={creating}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-os-type">Type OS</Label>
              <Select
                value={newOsType}
                onValueChange={setNewOsType}
                disabled={creating}
              >
                <SelectTrigger id="profile-os-type">
                  <SelectValue placeholder="Sélectionner un type OS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="windows">Windows</SelectItem>
                  <SelectItem value="linux">Linux</SelectItem>
                  <SelectItem value="macos">macOS</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-os-version">
                Version OS{" "}
                <span className="text-muted-foreground text-xs">
                  (optionnel)
                </span>
              </Label>
              <Input
                id="profile-os-version"
                placeholder="ex: 11 22H2"
                value={newOsVersion}
                onChange={(e) => setNewOsVersion(e.target.value)}
                disabled={creating}
              />
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
            <Button onClick={handleCreateProfile} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
