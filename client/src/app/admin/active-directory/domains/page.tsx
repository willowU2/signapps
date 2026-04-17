"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Globe,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useAdDomains } from "@/hooks/use-active-directory";
import { adApi } from "@/lib/api/active-directory";
import { toast } from "sonner";
import type { AdDomain, CreateDomainRequest } from "@/types/active-directory";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function truncateSid(sid: string, maxLen = 18): string {
  return sid.length > maxLen ? `${sid.slice(0, maxLen)}…` : sid;
}

const DOMAIN_TYPE_LABELS: Record<string, string> = {
  full: "Complet",
  dns_only: "DNS",
  mail_only: "Mail",
  internal: "Interne",
};

const DOMAIN_TYPE_COLORS: Record<string, string> = {
  full: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  dns_only:
    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
  mail_only:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  internal:
    "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
};

// Service badge colour classes
const SERVICE_BADGE_CLASSES = {
  AD: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  Mail: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  DHCP: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  PXE: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
} as const;

// ── Service Badges ─────────────────────────────────────────────────────────────

function ServiceBadges({ domain }: { domain: AdDomain }) {
  const services: Array<{
    key: keyof typeof SERVICE_BADGE_CLASSES;
    enabled: boolean | undefined;
  }> = [
    { key: "AD", enabled: domain.ad_enabled },
    { key: "Mail", enabled: domain.mail_enabled },
    { key: "DHCP", enabled: domain.dhcp_enabled },
    { key: "PXE", enabled: domain.pxe_enabled },
  ];

  const active = services.filter((s) => s.enabled);

  if (active.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {active.map(({ key }) => (
        <Badge
          key={key}
          variant="outline"
          className={`text-[10px] font-medium ${SERVICE_BADGE_CLASSES[key]}`}
        >
          {key}
        </Badge>
      ))}
    </div>
  );
}

// ── Initial form state ─────────────────────────────────────────────────────────

const EMPTY_FORM: CreateDomainRequest & {
  admin_password: string;
  domain_type: string;
} = {
  dns_name: "",
  netbios_name: "",
  domain_type: "full",
  ad_enabled: true,
  mail_enabled: true,
  dhcp_enabled: true,
  pxe_enabled: false,
  admin_password: "",
};

type DomainTypePreset = Pick<
  typeof EMPTY_FORM,
  "ad_enabled" | "mail_enabled" | "dhcp_enabled"
>;

const DOMAIN_TYPE_PRESETS: Record<string, DomainTypePreset> = {
  full: { ad_enabled: true, mail_enabled: true, dhcp_enabled: true },
  dns_only: { ad_enabled: false, mail_enabled: false, dhcp_enabled: false },
  mail_only: { ad_enabled: false, mail_enabled: true, dhcp_enabled: false },
  internal: { ad_enabled: true, mail_enabled: false, dhcp_enabled: true },
};

// ── Main Page ─────────────────────────────────────────────────────────────────

type EditDomainData = {
  netbios_name: string;
  domain_type: string;
  ad_enabled: boolean;
  mail_enabled: boolean;
  dhcp_enabled: boolean;
  pxe_enabled: boolean;
  ntp_enabled: boolean;
};

export default function DomainsPage() {
  usePageTitle("Domaines — Active Directory");

  const { data: domains = [], isLoading, isError, refetch } = useAdDomains();

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const [editOpen, setEditOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<AdDomain | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editData, setEditData] = useState<EditDomainData>({
    netbios_name: "",
    domain_type: "full",
    ad_enabled: true,
    mail_enabled: true,
    dhcp_enabled: true,
    pxe_enabled: false,
    ntp_enabled: false,
  });

  const openEditDialog = (domain: AdDomain) => {
    setEditingDomain(domain);
    setEditData({
      netbios_name: domain.netbios_name ?? "",
      domain_type: domain.domain_type ?? "full",
      ad_enabled: domain.ad_enabled ?? true,
      mail_enabled: domain.mail_enabled ?? true,
      dhcp_enabled: domain.dhcp_enabled ?? true,
      pxe_enabled: domain.pxe_enabled ?? false,
      ntp_enabled: domain.ntp_enabled ?? false,
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingDomain) return;
    setEditSaving(true);
    try {
      await adApi.domains.update(editingDomain.id, {
        netbios_name: editData.netbios_name || undefined,
        domain_type: editData.domain_type,
        ad_enabled: editData.ad_enabled,
        mail_enabled: editData.mail_enabled,
        dhcp_enabled: editData.dhcp_enabled,
        pxe_enabled: editData.pxe_enabled,
        ntp_enabled: editData.ntp_enabled,
      });
      toast.success(`Domaine "${editingDomain.dns_name}" mis a jour`);
      setEditOpen(false);
      setEditingDomain(null);
      refetch();
    } catch (e) {
      toast.error(
        `Erreur: ${e instanceof Error ? e.message : "Echec de la mise a jour"}`,
      );
    } finally {
      setEditSaving(false);
    }
  };

  const handleDomainTypeChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      domain_type: value,
      ...(DOMAIN_TYPE_PRESETS[value] ?? {}),
    }));
  };

  const handleCreate = async () => {
    if (!form.dns_name) return;
    setCreating(true);
    try {
      await adApi.domains.create({
        dns_name: form.dns_name,
        netbios_name: form.netbios_name || undefined,
        domain_type: form.domain_type,
        ad_enabled: form.ad_enabled,
        mail_enabled: form.mail_enabled,
        dhcp_enabled: form.dhcp_enabled,
        pxe_enabled: form.pxe_enabled,
        tree_id: "00000000-0000-0000-0000-000000000001",
        admin_user_id: "00000000-0000-0000-0000-000000000001",
        admin_password: form.admin_password || undefined,
      });
      toast.success(`Domaine ${form.dns_name} cree avec succes`);
      setCreateOpen(false);
      setForm({ ...EMPTY_FORM });
      refetch();
    } catch (e) {
      toast.error(
        `Erreur: ${e instanceof Error ? e.message : "Echec de la creation"}`,
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (domain: AdDomain) => {
    if (
      !window.confirm(
        `Supprimer le domaine "${domain.dns_name}" ? Cette action est irreversible.`,
      )
    ) {
      return;
    }
    try {
      await adApi.domains.delete(domain.id);
      toast.success(`Domaine "${domain.dns_name}" supprime`);
      refetch();
    } catch (e) {
      toast.error(
        `Erreur: ${e instanceof Error ? e.message : "Echec de la suppression"}`,
      );
    }
  };

  const breadcrumb = (
    <PageBreadcrumb
      items={[
        { label: "Administration", href: "/admin" },
        { label: "Active Directory", href: "/admin/active-directory" },
        { label: "Domaines" },
      ]}
    />
  );

  const header = (
    <PageHeader
      title="Domaines"
      description="Gestion des domaines d'infrastructure unifies"
      icon={<Globe className="h-5 w-5" />}
      actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            disabled={isLoading}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouveau domaine
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Rafraichir
          </Button>
        </div>
      }
    />
  );

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          {breadcrumb}
          {header}
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <div className="space-y-6">
          {breadcrumb}
          {header}
          <div className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
            <p className="text-sm font-medium">Erreur de chargement</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reessayer
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {breadcrumb}
        {header}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Domaines enregistres</CardTitle>
            <CardDescription>
              {domains.length} domaine{domains.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {domains.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium">Aucun domaine configure</p>
                <p className="text-sm mt-1">
                  Creez votre premier domaine pour commencer.
                </p>
                <Button
                  className="mt-4"
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau domaine
                </Button>
              </div>
            ) : (
              <div className="rounded-b-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom DNS</TableHead>
                      <TableHead className="w-[110px]">NetBIOS</TableHead>
                      <TableHead className="w-[160px]">Realm</TableHead>
                      <TableHead className="w-[160px]">SID</TableHead>
                      <TableHead className="w-[100px]">Type</TableHead>
                      <TableHead className="w-[160px]">Services</TableHead>
                      <TableHead className="w-[100px]">Cert Mode</TableHead>
                      <TableHead className="w-[80px]">Statut</TableHead>
                      <TableHead className="w-[100px]">Cree le</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {domains.map((domain) => (
                      <TableRow key={domain.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="font-mono text-sm">
                              {domain.dns_name}
                            </span>
                            {domain.forest_root && (
                              <Badge
                                variant="secondary"
                                className="text-[9px] shrink-0"
                              >
                                Racine
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {domain.netbios_name || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </code>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {domain.realm || "—"}
                        </TableCell>
                        <TableCell>
                          <code
                            className="text-xs text-muted-foreground"
                            title={domain.domain_sid}
                          >
                            {truncateSid(domain.domain_sid)}
                          </code>
                        </TableCell>
                        <TableCell>
                          {domain.domain_type ? (
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-medium ${DOMAIN_TYPE_COLORS[domain.domain_type] ?? ""}`}
                            >
                              {DOMAIN_TYPE_LABELS[domain.domain_type] ??
                                domain.domain_type}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ServiceBadges domain={domain} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {domain.cert_mode ?? "—"}
                        </TableCell>
                        <TableCell>
                          {domain.is_active !== false ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 text-[10px] font-medium"
                            >
                              Actif
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-muted text-muted-foreground text-[10px]"
                            >
                              Inactif
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(domain.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => openEditDialog(domain)}
                              title="Modifier ce domaine"
                              aria-label="Modifier ce domaine"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(domain)}
                              title="Supprimer ce domaine"
                              aria-label="Supprimer ce domaine"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Domain Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Modifier le domaine{" "}
              {editingDomain && (
                <span className="font-mono text-sm font-normal text-muted-foreground ml-1">
                  {editingDomain.dns_name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-netbios">Nom NetBIOS</Label>
              <Input
                id="edit-netbios"
                placeholder="EXAMPLE"
                value={editData.netbios_name}
                onChange={(e) =>
                  setEditData((d) => ({
                    ...d,
                    netbios_name: e.target.value.toUpperCase(),
                  }))
                }
                disabled={editSaving}
              />
              <p className="text-xs text-muted-foreground">
                Nom court du domaine (max 15 caracteres, majuscules)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-domain-type">Type de domaine</Label>
              <Select
                value={editData.domain_type}
                onValueChange={(value) =>
                  setEditData((d) => ({ ...d, domain_type: value }))
                }
                disabled={editSaving}
              >
                <SelectTrigger id="edit-domain-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">
                    Complet (AD + Mail + DHCP)
                  </SelectItem>
                  <SelectItem value="internal">Interne (AD + DHCP)</SelectItem>
                  <SelectItem value="dns_only">DNS uniquement</SelectItem>
                  <SelectItem value="mail_only">Mail uniquement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Services actives</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-svc-ad"
                    checked={editData.ad_enabled}
                    onCheckedChange={(v) =>
                      setEditData((d) => ({ ...d, ad_enabled: !!v }))
                    }
                    disabled={editSaving}
                  />
                  <Label htmlFor="edit-svc-ad" className="text-sm font-normal">
                    Active Directory
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-svc-mail"
                    checked={editData.mail_enabled}
                    onCheckedChange={(v) =>
                      setEditData((d) => ({ ...d, mail_enabled: !!v }))
                    }
                    disabled={editSaving}
                  />
                  <Label
                    htmlFor="edit-svc-mail"
                    className="text-sm font-normal"
                  >
                    Serveur Mail
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-svc-dhcp"
                    checked={editData.dhcp_enabled}
                    onCheckedChange={(v) =>
                      setEditData((d) => ({ ...d, dhcp_enabled: !!v }))
                    }
                    disabled={editSaving}
                  />
                  <Label
                    htmlFor="edit-svc-dhcp"
                    className="text-sm font-normal"
                  >
                    DHCP
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-svc-pxe"
                    checked={editData.pxe_enabled}
                    onCheckedChange={(v) =>
                      setEditData((d) => ({ ...d, pxe_enabled: !!v }))
                    }
                    disabled={editSaving}
                  />
                  <Label htmlFor="edit-svc-pxe" className="text-sm font-normal">
                    PXE Boot
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-svc-ntp"
                    checked={editData.ntp_enabled}
                    onCheckedChange={(v) =>
                      setEditData((d) => ({ ...d, ntp_enabled: !!v }))
                    }
                    disabled={editSaving}
                  />
                  <Label htmlFor="edit-svc-ntp" className="text-sm font-normal">
                    NTP
                  </Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={editSaving}
            >
              Annuler
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Pencil className="h-4 w-4 mr-2" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Domain Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nouveau domaine</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="domain-dns">
                Nom DNS du domaine <span className="text-destructive">*</span>
              </Label>
              <Input
                id="domain-dns"
                placeholder="example.com"
                value={form.dns_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dns_name: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Le FQDN du domaine (ex : corp.example.com)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain-netbios">Nom NetBIOS</Label>
              <Input
                id="domain-netbios"
                placeholder="EXAMPLE"
                value={form.netbios_name ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    netbios_name: e.target.value.toUpperCase(),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Nom court du domaine (max 15 caracteres, majuscules)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain-type">Type de domaine</Label>
              <Select
                value={form.domain_type}
                onValueChange={handleDomainTypeChange}
              >
                <SelectTrigger id="domain-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">
                    Complet (AD + Mail + DHCP)
                  </SelectItem>
                  <SelectItem value="internal">Interne (AD + DHCP)</SelectItem>
                  <SelectItem value="dns_only">DNS uniquement</SelectItem>
                  <SelectItem value="mail_only">Mail uniquement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Services actives</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="svc-ad"
                    checked={form.ad_enabled ?? false}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, ad_enabled: !!v }))
                    }
                  />
                  <Label htmlFor="svc-ad" className="text-sm font-normal">
                    Active Directory
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="svc-mail"
                    checked={form.mail_enabled ?? false}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, mail_enabled: !!v }))
                    }
                  />
                  <Label htmlFor="svc-mail" className="text-sm font-normal">
                    Serveur Mail
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="svc-dhcp"
                    checked={form.dhcp_enabled ?? false}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, dhcp_enabled: !!v }))
                    }
                  />
                  <Label htmlFor="svc-dhcp" className="text-sm font-normal">
                    DHCP
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="svc-pxe"
                    checked={form.pxe_enabled ?? false}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, pxe_enabled: !!v }))
                    }
                  />
                  <Label htmlFor="svc-pxe" className="text-sm font-normal">
                    PXE Boot
                  </Label>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain-password">
                Mot de passe administrateur
              </Label>
              <Input
                id="domain-password"
                type="password"
                placeholder="Mot de passe du compte admin"
                value={form.admin_password ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, admin_password: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Mot de passe pour les cles Kerberos de l&apos;administrateur
              </p>
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
            <Button
              onClick={handleCreate}
              disabled={creating || !form.dns_name}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Creer le domaine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
