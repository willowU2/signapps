"use client";

import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";
import { Badge } from "@/components/ui/badge";
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
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { adApi } from "@/lib/api/active-directory";

// ── Types ──────────────────────────────────────────────────────────────────────

interface InfraHealth {
  domains: number;
  certificates: {
    active: number;
    expiring_soon: number;
  };
  dhcp: {
    scopes: number;
    active_leases: number;
  };
  deployment: {
    profiles: number;
  };
}

interface ExpiringCert {
  id: string;
  subject: string;
  not_after: string;
  days_remaining?: number;
}

interface ExpiringCertsResponse {
  expiring_within_days: number;
  count: number;
  certificates: ExpiringCert[];
}

interface SecurityCheck {
  name: string;
  status: "pass" | "fail" | "warn";
  description: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildSecurityChecks(
  health: InfraHealth,
  expiring: ExpiringCertsResponse,
): SecurityCheck[] {
  return [
    {
      name: "Certificats CA",
      status: health.certificates.active > 0 ? "pass" : "fail",
      description:
        health.certificates.active > 0
          ? `${health.certificates.active} certificat(s) actif(s) dans l'infrastructure`
          : "Aucun certificat actif — la PKI n'est pas configuree",
    },
    {
      name: "Renouvellement auto",
      status: expiring.count === 0 ? "pass" : "warn",
      description:
        expiring.count === 0
          ? "Aucun certificat n'expire dans les 30 prochains jours"
          : `${expiring.count} certificat(s) expirent dans moins de 30 jours`,
    },
    {
      name: "DHCP actif",
      status: health.dhcp.scopes > 0 ? "pass" : "warn",
      description:
        health.dhcp.scopes > 0
          ? `${health.dhcp.scopes} scope(s) DHCP configure(s), ${health.dhcp.active_leases} bail(aux) actif(s)`
          : "Aucun scope DHCP configure",
    },
    {
      name: "Domaines configures",
      status: health.domains > 0 ? "pass" : "fail",
      description:
        health.domains > 0
          ? `${health.domains} domaine(s) Active Directory actif(s)`
          : "Aucun domaine Active Directory configure",
    },
    {
      name: "Profils de deploiement",
      status: health.deployment.profiles > 0 ? "pass" : "warn",
      description:
        health.deployment.profiles > 0
          ? `${health.deployment.profiles} profil(s) de deploiement defini(s)`
          : "Aucun profil de deploiement configure",
    },
  ];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AdSecurityPage() {
  usePageTitle("Securite — Active Directory");

  const [health, setHealth] = useState<InfraHealth | null>(null);
  const [expiring, setExpiring] = useState<ExpiringCertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function fetchData() {
    setLoading(true);
    setError(false);
    try {
      const [healthRes, expiringRes] = await Promise.all([
        adApi.monitoring.infrastructureHealth(),
        adApi.monitoring.expiringCerts(30),
      ]);
      setHealth(healthRes.data as InfraHealth);
      setExpiring(expiringRes.data as ExpiringCertsResponse);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const breadcrumb = (
    <PageBreadcrumb
      items={[
        { label: "Administration", href: "/admin" },
        { label: "Active Directory", href: "/admin/active-directory" },
        { label: "Securite" },
      ]}
    />
  );

  const header = (
    <PageHeader
      title="Securite Active Directory"
      description="Audit de securite, etat de l'infrastructure et recommandations"
      icon={<Shield className="h-5 w-5" />}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Rafraichir
        </Button>
      }
    />
  );

  if (loading) {
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

  if (error || !health || !expiring) {
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
              onClick={fetchData}
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Reessayer
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const checks = buildSecurityChecks(health, expiring);
  const passCount = checks.filter((c) => c.status === "pass").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const failCount = checks.filter((c) => c.status === "fail").length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {breadcrumb}
        {header}

        {/* Summary score cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-in">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Conformes</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {passCount}
              </div>
              <p className="text-xs text-muted-foreground">controles passes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Avertissements
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {warnCount}
              </div>
              <p className="text-xs text-muted-foreground">
                ameliorations suggerees
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Critiques</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {failCount}
              </div>
              <p className="text-xs text-muted-foreground">actions requises</p>
            </CardContent>
          </Card>
        </div>

        {/* Infrastructure Health */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-in">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Domaines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{health.domains}</div>
              <p className="text-xs text-muted-foreground">
                domaine(s) Active Directory
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Certificats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {health.certificates.active}
              </div>
              <p className="text-xs text-muted-foreground">
                actif(s)
                {health.certificates.expiring_soon > 0 && (
                  <span className="ml-1 text-amber-600 dark:text-amber-400 font-medium">
                    · {health.certificates.expiring_soon} expire(nt) bientot
                  </span>
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">DHCP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{health.dhcp.scopes}</div>
              <p className="text-xs text-muted-foreground">
                scope(s) · {health.dhcp.active_leases} bail(aux)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Deploiement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {health.deployment.profiles}
              </div>
              <p className="text-xs text-muted-foreground">
                profil(s) configure(s)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Certificate Health */}
        <Card>
          <CardHeader>
            <CardTitle>Sante des certificats</CardTitle>
            <CardDescription>
              {health.certificates.active} certificat(s) actif(s) ·{" "}
              {expiring.count === 0
                ? "aucun renouvellement urgent"
                : `${expiring.count} expirant dans ${expiring.expiring_within_days} jours`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expiring.count > 0 ? (
              <>
                <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    {expiring.count} certificat(s) expirent dans les{" "}
                    {expiring.expiring_within_days} prochains jours
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sujet</TableHead>
                      <TableHead className="w-[160px]">Expiration</TableHead>
                      <TableHead className="w-[120px]">
                        Jours restants
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiring.certificates.map((cert) => {
                      const daysLeft =
                        cert.days_remaining ??
                        Math.floor(
                          (new Date(cert.not_after).getTime() - Date.now()) /
                            (1000 * 60 * 60 * 24),
                        );
                      return (
                        <TableRow key={cert.id}>
                          <TableCell className="font-mono text-sm">
                            {cert.subject}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(cert.not_after)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                daysLeft <= 7
                                  ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                                  : "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
                              }
                            >
                              {daysLeft}j
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            ) : (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <p className="text-sm text-emerald-800 dark:text-emerald-300">
                  Tous les certificats sont valides pour les 30 prochains jours
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Checks */}
        <Card>
          <CardHeader>
            <CardTitle>Audit de securite</CardTitle>
            <CardDescription>
              {passCount}/{checks.length} controles conformes —{" "}
              {failCount > 0
                ? `${failCount} action(s) requise(s)`
                : "aucune action critique"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {checks.map((check, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50"
                >
                  {check.status === "pass" ? (
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  ) : check.status === "warn" ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="text-sm font-medium">{check.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {check.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
