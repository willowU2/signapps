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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import {
  Ban,
  Plus,
  ShieldCheck,
  RefreshCw,
  Loader2,
  AlertTriangle,
  TriangleAlert,
} from "lucide-react";
import {
  useAdDomains,
  useInfraCertificates,
} from "@/hooks/use-active-directory";
import { adApi } from "@/lib/api/active-directory";
import { toast } from "sonner";
import type { InfraCertificate } from "@/types/active-directory";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CERT_TYPE_LABELS: Record<InfraCertificate["cert_type"], string> = {
  root_ca: "Root CA",
  intermediate_ca: "Intermediate CA",
  server: "Serveur",
  client: "Client",
  wildcard: "Wildcard",
};

const CERT_TYPE_COLORS: Record<InfraCertificate["cert_type"], string> = {
  root_ca:
    "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  intermediate_ca:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  server:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  client:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  wildcard:
    "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800",
};

const STATUS_COLORS: Record<InfraCertificate["status"], string> = {
  active:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  expired:
    "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  revoked:
    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
  pending:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
};

const STATUS_LABELS: Record<InfraCertificate["status"], string> = {
  active: "Actif",
  expired: "Expiré",
  revoked: "Révoqué",
  pending: "En attente",
};

function daysUntilExpiry(notAfter: string): number {
  return Math.floor(
    (new Date(notAfter).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CertificatesPage() {
  usePageTitle("Certificats — Active Directory");

  const [domainId, setDomainId] = useState("");

  // Issue dialog state
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueSubject, setIssueSubject] = useState("");
  const [issueCertType, setIssueCertType] = useState<
    "server" | "client" | "wildcard"
  >("server");
  const [issueSan, setIssueSan] = useState("");
  const [issuing, setIssuing] = useState(false);

  const {
    data: domains = [],
    isLoading: loadingDomains,
    isError: domainsError,
    refetch: refetchDomains,
  } = useAdDomains();

  const activeDomainId = domainId || domains[0]?.id || "";

  const {
    data: certs = [],
    isLoading: loadingCerts,
    refetch: refetchCerts,
  } = useInfraCertificates(activeDomainId);

  async function handleRenew(cert: InfraCertificate) {
    if (!window.confirm(`Renouveler le certificat "${cert.subject}" ?`)) return;
    try {
      await adApi.certificates.renew(cert.id);
      toast.success("Certificat renouvelé avec succès");
      refetchCerts();
    } catch {
      toast.error("Echec du renouvellement du certificat");
    }
  }

  async function handleRevoke(cert: InfraCertificate) {
    if (
      !window.confirm(
        `Révoquer le certificat "${cert.subject}" ? Cette action est irréversible.`,
      )
    )
      return;
    try {
      await adApi.certificates.revoke(cert.id);
      toast.success("Certificat révoqué");
      refetchCerts();
    } catch {
      toast.error("Echec de la révocation du certificat");
    }
  }

  async function handleIssue() {
    if (!issueSubject.trim()) return;
    setIssuing(true);
    try {
      const san = issueSan
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await adApi.certificates.issue(activeDomainId, {
        subject: issueSubject.trim(),
        cert_type: issueCertType,
        ...(san.length > 0 ? { san } : {}),
      });
      toast.success("Certificat émis avec succès");
      setIssueOpen(false);
      setIssueSubject("");
      setIssueSan("");
      setIssueCertType("server");
      refetchCerts();
    } catch {
      toast.error("Echec de l'émission du certificat");
    } finally {
      setIssuing(false);
    }
  }

  const expiringSoon = certs.filter(
    (c) => c.status === "active" && daysUntilExpiry(c.not_after) <= 30,
  );

  if (loadingDomains) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageBreadcrumb
            items={[
              { label: "Administration", href: "/admin" },
              { label: "Active Directory", href: "/admin/active-directory" },
              { label: "Certificats" },
            ]}
          />
          <PageHeader
            title="Certificats"
            description="Gestion des certificats TLS/PKI de l'infrastructure"
            icon={<ShieldCheck className="h-5 w-5" />}
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
              { label: "Certificats" },
            ]}
          />
          <PageHeader
            title="Certificats"
            description="Gestion des certificats TLS/PKI de l'infrastructure"
            icon={<ShieldCheck className="h-5 w-5" />}
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
            { label: "Certificats" },
          ]}
        />
        <PageHeader
          title="Certificats"
          description="Gestion des certificats TLS/PKI de l'infrastructure"
          icon={<ShieldCheck className="h-5 w-5" />}
          actions={
            <div className="flex items-center gap-2">
              {domains.length > 0 && (
                <Select value={activeDomainId} onValueChange={setDomainId}>
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
                onClick={() => refetchCerts()}
                disabled={loadingCerts}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loadingCerts ? "animate-spin" : ""}`}
                />
                Rafraichir
              </Button>
              {activeDomainId && (
                <Button size="sm" onClick={() => setIssueOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Emettre un certificat
                </Button>
              )}
            </div>
          }
        />

        {/* Domain selector (body area, visible when multiple domains) */}
        {domains.length > 1 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Domaine</Label>
            <Select value={activeDomainId} onValueChange={setDomainId}>
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
              <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
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

        {/* Expiring soon warning */}
        {expiringSoon.length > 0 && (
          <Card className="border-amber-400/60 bg-amber-50/40 dark:bg-amber-900/10">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <CardTitle className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {expiringSoon.length} certificat(s) expirent dans moins de 30
                  jours
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1">
                {expiringSoon.map((c) => (
                  <li key={c.id} className="text-amber-700 dark:text-amber-400">
                    <span className="font-mono">{c.subject}</span> —{" "}
                    {daysUntilExpiry(c.not_after)} jour(s) restant(s)
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Certificates table */}
        {activeDomainId && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Certificats</CardTitle>
              <CardDescription>{certs.length} certificat(s)</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingCerts ? (
                <div className="py-12 text-center text-muted-foreground">
                  <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin" />
                  Chargement...
                </div>
              ) : certs.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  Aucun certificat pour ce domaine.
                </div>
              ) : (
                <div className="rounded-b-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sujet</TableHead>
                        <TableHead>Emetteur</TableHead>
                        <TableHead className="w-[120px]">Type</TableHead>
                        <TableHead className="w-[120px]">Expiration</TableHead>
                        <TableHead className="w-[100px]">Statut</TableHead>
                        <TableHead className="w-[100px]">
                          Renouvellement
                        </TableHead>
                        <TableHead className="w-[100px] text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {certs.map((cert) => {
                        const days = daysUntilExpiry(cert.not_after);
                        return (
                          <TableRow key={cert.id}>
                            <TableCell className="font-mono text-sm max-w-[220px] truncate">
                              {cert.subject}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                              {cert.issuer}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-medium ${CERT_TYPE_COLORS[cert.cert_type] ?? ""}`}
                              >
                                {CERT_TYPE_LABELS[cert.cert_type] ??
                                  cert.cert_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span
                                className={
                                  days <= 30 && cert.status === "active"
                                    ? "text-amber-600 dark:text-amber-400 font-medium"
                                    : "text-sm"
                                }
                              >
                                {formatDate(cert.not_after)}
                              </span>
                              {days <= 30 && cert.status === "active" && (
                                <span className="ml-1 text-xs text-amber-500">
                                  ({days}j)
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-medium ${STATUS_COLORS[cert.status] ?? ""}`}
                              >
                                {STATUS_LABELS[cert.status] ?? cert.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {cert.auto_renew ? (
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  Auto
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  Manuel
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {cert.status === "active" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title="Renouveler"
                                    onClick={() => handleRenew(cert)}
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {cert.status === "active" &&
                                  cert.cert_type !== "root_ca" && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      title="Révoquer"
                                      onClick={() => handleRevoke(cert)}
                                    >
                                      <Ban className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                              </div>
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
        )}
      </div>

      {/* Issue Certificate Dialog */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Emettre un certificat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="issue-subject">
                Sujet (CN=...) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="issue-subject"
                placeholder="CN=mon-serveur.example.com"
                value={issueSubject}
                onChange={(e) => setIssueSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="issue-type">Type</Label>
              <Select
                value={issueCertType}
                onValueChange={(v) =>
                  setIssueCertType(v as "server" | "client" | "wildcard")
                }
              >
                <SelectTrigger id="issue-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="server">Serveur</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="wildcard">Wildcard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="issue-san">
                SAN{" "}
                <span className="text-muted-foreground text-xs">
                  (séparés par des virgules, optionnel)
                </span>
              </Label>
              <Input
                id="issue-san"
                placeholder="alt1.example.com, alt2.example.com"
                value={issueSan}
                onChange={(e) => setIssueSan(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIssueOpen(false)}
              disabled={issuing}
            >
              Annuler
            </Button>
            <Button
              onClick={handleIssue}
              disabled={!issueSubject.trim() || issuing}
            >
              {issuing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Emettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
