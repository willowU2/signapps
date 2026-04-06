"use client";

import React, { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Network,
  Shield,
  Server,
  Globe,
  Key,
  Lock,
  Monitor,
  FileText,
  Package,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Database,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  useAdDomains,
  useAdComputers,
  useAdGpos,
  useCreateDomain,
  useDeleteDomain,
  useDcStatus,
} from "@/hooks/use-active-directory";

export default function ActiveDirectoryPage() {
  usePageTitle("Active Directory — Administration");

  const {
    data: domains = [],
    isLoading: domainsLoading,
    isError: domainsError,
    refetch: refetchDomains,
  } = useAdDomains();
  const { data: dcStatus } = useDcStatus();
  const createDomain = useCreateDomain();
  const deleteDomain = useDeleteDomain();

  // Use the first domain for real-time metric counts
  const domainId = domains[0]?.id ?? "";
  const { data: computers = [] } = useAdComputers(domainId);
  const { data: gpos = [] } = useAdGpos(domainId);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newDomain, setNewDomain] = useState({
    dns_name: "",
    netbios_name: "",
    admin_password: "",
    domain_type: "full",
    ad_enabled: true,
    mail_enabled: true,
    dhcp_enabled: true,
    pxe_enabled: false,
  });

  const stats = {
    domains: domains.length,
    computers: computers.length,
    users: 0,
    gpos: gpos.length,
  };

  const dcOnline = dcStatus?.status === "healthy";

  const handleCreateDomain = async () => {
    try {
      await createDomain.mutateAsync({
        dns_name: newDomain.dns_name,
        netbios_name: newDomain.netbios_name || undefined,
        domain_type: newDomain.domain_type,
        ad_enabled: newDomain.ad_enabled,
        mail_enabled: newDomain.mail_enabled,
        dhcp_enabled: newDomain.dhcp_enabled,
        pxe_enabled: newDomain.pxe_enabled,
        tree_id: "00000000-0000-0000-0000-000000000001",
        admin_user_id: "00000000-0000-0000-0000-000000000001",
        admin_password: newDomain.admin_password,
      });
      toast.success(`Domaine ${newDomain.dns_name} cree avec succes`);
      setCreateDialogOpen(false);
      setNewDomain({
        dns_name: "",
        netbios_name: "",
        admin_password: "",
        domain_type: "full",
        ad_enabled: true,
        mail_enabled: true,
        dhcp_enabled: true,
        pxe_enabled: false,
      });
    } catch (e) {
      toast.error(
        `Erreur: ${e instanceof Error ? e.message : "Echec de la creation"}`,
      );
    }
  };

  const handleDeleteDomain = async (id: string, name: string) => {
    if (
      !confirm(`Supprimer le domaine ${name} ? Cette action est irreversible.`)
    )
      return;
    try {
      await deleteDomain.mutateAsync(id);
      toast.success(`Domaine ${name} supprime`);
    } catch (e) {
      toast.error(`Erreur: ${e instanceof Error ? e.message : "Echec"}`);
    }
  };

  if (domainsLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageHeader
            title="Active Directory"
            description="Gestion du Domain Controller, domaines, Kerberos, DNS et GPO"
            icon={<Network className="h-5 w-5" />}
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
            title="Active Directory"
            description="Gestion du Domain Controller, domaines, Kerberos, DNS et GPO"
            icon={<Network className="h-5 w-5" />}
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
          title="Active Directory"
          description="Gestion du Domain Controller, domaines, Kerberos, DNS et GPO"
          icon={<Network className="h-5 w-5" />}
          actions={
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchDomains()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Rafraichir
              </Button>
              <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau domaine
              </Button>
            </div>
          }
        />

        {/* DC Status + Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-in">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Domain Controller
              </CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {dcOnline ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-2xl font-bold">
                  {dcOnline ? "En ligne" : "Hors ligne"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {dcStatus?.version
                  ? `v${dcStatus.version}`
                  : "LDAP :389 | KDC :88"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Domaines</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.domains}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Domaines actifs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ordinateurs</CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.computers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Machines jointes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">GPOs</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.gpos}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Strategies de groupe
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 stagger-in">
          {[
            {
              href: "/admin/active-directory/domains",
              icon: Database,
              label: "Domaines",
              desc: "Registre unifie AD+DNS+Mail",
            },
            {
              href: "/admin/active-directory/dns",
              icon: Globe,
              label: "Zones DNS",
              desc: "SRV, A, CNAME records",
            },
            {
              href: "/admin/active-directory/kerberos",
              icon: Key,
              label: "Kerberos",
              desc: "Principals et cles",
            },
            {
              href: "/admin/active-directory/computers",
              icon: Monitor,
              label: "Ordinateurs",
              desc: "Comptes machine",
            },
            {
              href: "/admin/active-directory/gpo",
              icon: FileText,
              label: "GPO",
              desc: "Strategies de groupe",
            },
            {
              href: "/admin/active-directory/security",
              icon: Shield,
              label: "Securite",
              desc: "Audit et politiques",
            },
            {
              href: "/admin/active-directory/certificates",
              icon: Lock,
              label: "Certificats",
              desc: "CA, TLS, renouvellement",
            },
            {
              href: "/admin/active-directory/dhcp",
              icon: Network,
              label: "DHCP",
              desc: "Scopes et baux reseau",
            },
            {
              href: "/admin/active-directory/deployment",
              icon: Package,
              label: "Deploiement",
              desc: "Profils OS et logiciels",
            },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{item.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.desc}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Domains Table */}
        <Card>
          <CardHeader>
            <CardTitle>Domaines</CardTitle>
            <CardDescription>
              Domaines Active Directory configures sur cette instance
            </CardDescription>
          </CardHeader>
          <CardContent>
            {domains.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Network className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Aucun domaine configure</p>
                <p className="text-sm mt-1">
                  Creez votre premier domaine Active Directory pour commencer
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Creer un domaine
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domaine</TableHead>
                      <TableHead>NetBIOS</TableHead>
                      <TableHead>Realm</TableHead>
                      <TableHead>SID</TableHead>
                      <TableHead>Niveau</TableHead>
                      <TableHead>Services</TableHead>
                      <TableHead>Cree le</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {domains.map((domain) => (
                      <TableRow key={domain.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-primary" />
                            {domain.dns_name}
                            {domain.forest_root && (
                              <Badge
                                variant="secondary"
                                className="text-[10px]"
                              >
                                Racine
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {domain.netbios_name}
                          </code>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs">{domain.realm}</code>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs text-muted-foreground">
                            {domain.domain_sid}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            Niveau {domain.domain_function_level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {domain.ad_enabled && (
                              <Badge variant="secondary" className="text-[9px]">
                                AD
                              </Badge>
                            )}
                            {domain.mail_enabled && (
                              <Badge variant="secondary" className="text-[9px]">
                                Mail
                              </Badge>
                            )}
                            {domain.dhcp_enabled && (
                              <Badge variant="secondary" className="text-[9px]">
                                DHCP
                              </Badge>
                            )}
                            {domain.pxe_enabled && (
                              <Badge variant="secondary" className="text-[9px]">
                                PXE
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(domain.created_at).toLocaleDateString(
                            "fr-FR",
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleDeleteDomain(domain.id, domain.dns_name)
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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

        {/* Create Domain Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Creer un domaine Active Directory</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nom DNS du domaine</Label>
                <Input
                  placeholder="example.com"
                  value={newDomain.dns_name}
                  onChange={(e) =>
                    setNewDomain((d) => ({ ...d, dns_name: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Le FQDN du domaine (ex: corp.example.com)
                </p>
              </div>
              <div className="space-y-2">
                <Label>Nom NetBIOS</Label>
                <Input
                  placeholder="EXAMPLE"
                  value={newDomain.netbios_name}
                  onChange={(e) =>
                    setNewDomain((d) => ({
                      ...d,
                      netbios_name: e.target.value.toUpperCase(),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Nom court du domaine (max 15 caracteres, majuscules)
                </p>
              </div>
              <div className="space-y-2">
                <Label>Mot de passe administrateur</Label>
                <Input
                  type="password"
                  placeholder="Mot de passe du compte admin"
                  value={newDomain.admin_password}
                  onChange={(e) =>
                    setNewDomain((d) => ({
                      ...d,
                      admin_password: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Mot de passe pour les cles Kerberos de l&apos;administrateur
                </p>
              </div>
              <div className="space-y-2">
                <Label>Type de domaine</Label>
                <Select
                  value={newDomain.domain_type}
                  onValueChange={(v) => {
                    const presets: Record<string, Partial<typeof newDomain>> = {
                      full: {
                        ad_enabled: true,
                        mail_enabled: true,
                        dhcp_enabled: true,
                      },
                      dns_only: {
                        ad_enabled: false,
                        mail_enabled: false,
                        dhcp_enabled: false,
                      },
                      mail_only: {
                        ad_enabled: false,
                        mail_enabled: true,
                        dhcp_enabled: false,
                      },
                      internal: {
                        ad_enabled: true,
                        mail_enabled: false,
                        dhcp_enabled: true,
                      },
                    };
                    setNewDomain((d) => ({
                      ...d,
                      domain_type: v,
                      ...presets[v],
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">
                      Complet (AD + Mail + DHCP)
                    </SelectItem>
                    <SelectItem value="internal">
                      Interne (AD + DHCP)
                    </SelectItem>
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
                      checked={newDomain.ad_enabled}
                      onCheckedChange={(v) =>
                        setNewDomain((d) => ({ ...d, ad_enabled: !!v }))
                      }
                    />
                    <Label className="text-sm font-normal">
                      Active Directory
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={newDomain.mail_enabled}
                      onCheckedChange={(v) =>
                        setNewDomain((d) => ({ ...d, mail_enabled: !!v }))
                      }
                    />
                    <Label className="text-sm font-normal">Serveur Mail</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={newDomain.dhcp_enabled}
                      onCheckedChange={(v) =>
                        setNewDomain((d) => ({ ...d, dhcp_enabled: !!v }))
                      }
                    />
                    <Label className="text-sm font-normal">DHCP</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={newDomain.pxe_enabled}
                      onCheckedChange={(v) =>
                        setNewDomain((d) => ({ ...d, pxe_enabled: !!v }))
                      }
                    />
                    <Label className="text-sm font-normal">PXE Boot</Label>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button
                disabled={
                  !newDomain.dns_name ||
                  !newDomain.netbios_name ||
                  !newDomain.admin_password ||
                  createDomain.isPending
                }
                onClick={handleCreateDomain}
              >
                {createDomain.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Creer le domaine
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
