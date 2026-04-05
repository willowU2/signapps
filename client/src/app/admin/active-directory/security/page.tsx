"use client";

import React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Shield,
  Lock,
  Key,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";

interface SecurityCheck {
  name: string;
  status: "pass" | "fail" | "warn";
  description: string;
}

const SECURITY_CHECKS: SecurityCheck[] = [
  {
    name: "TLS obligatoire sur LDAP",
    status: "warn",
    description: "LDAP accepte les connexions non chiffrees sur le port 389",
  },
  {
    name: "Pre-authentification Kerberos",
    status: "pass",
    description: "PA-ENC-TIMESTAMP est requis pour tous les comptes",
  },
  {
    name: "AES256 par defaut",
    status: "pass",
    description: "L'encryption AES256-CTS-HMAC-SHA1 est preferee",
  },
  {
    name: "RC4-HMAC desactive",
    status: "warn",
    description: "RC4-HMAC est encore disponible pour la compatibilite legacy",
  },
  {
    name: "Rotation cle krbtgt",
    status: "warn",
    description: "La cle krbtgt n'a pas ete changee depuis plus de 180 jours",
  },
  {
    name: "Politique de mot de passe",
    status: "pass",
    description: "Longueur minimale de 8 caracteres avec complexite",
  },
  {
    name: "Verrouillage de compte",
    status: "pass",
    description: "Verrouillage apres 5 tentatives echouees",
  },
  {
    name: "Audit des connexions",
    status: "pass",
    description: "Toutes les connexions LDAP et Kerberos sont tracees",
  },
  {
    name: "LDAP anonymous restreint",
    status: "pass",
    description: "Acces anonymous limite au RootDSE uniquement",
  },
  {
    name: "DNS TSIG",
    status: "fail",
    description: "Les mises a jour DNS dynamiques ne sont pas signees",
  },
];

export default function AdSecurityPage() {
  usePageTitle("Securite — Active Directory");

  const passCount = SECURITY_CHECKS.filter((c) => c.status === "pass").length;
  const warnCount = SECURITY_CHECKS.filter((c) => c.status === "warn").length;
  const failCount = SECURITY_CHECKS.filter((c) => c.status === "fail").length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Securite Active Directory"
          description="Audit de securite, politiques et recommandations"
          icon={<Shield className="h-5 w-5" />}
        />

        {/* Score */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* Policy Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Politique de mot de passe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Longueur minimale</span>
                <span className="font-medium">8 caracteres</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Complexite requise
                </span>
                <Badge variant="default" className="text-[10px]">
                  Oui
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Historique</span>
                <span className="font-medium">12 derniers</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Age maximum</span>
                <span className="font-medium">90 jours</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Verrouillage de compte
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seuil</span>
                <span className="font-medium">5 tentatives</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duree</span>
                <span className="font-medium">30 minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reset apres</span>
                <span className="font-medium">30 minutes</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Key className="h-4 w-4" />
                Politique Kerberos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duree TGT</span>
                <span className="font-medium">10 heures</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tolerance horloge</span>
                <span className="font-medium">5 minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Encryption</span>
                <Badge variant="default" className="text-[10px]">
                  AES256
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">RC4-HMAC</span>
                <Badge variant="secondary" className="text-[10px]">
                  Active (legacy)
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Security Checklist */}
        <Card>
          <CardHeader>
            <CardTitle>Audit de securite</CardTitle>
            <CardDescription>
              {passCount}/{SECURITY_CHECKS.length} controles conformes —{" "}
              {failCount > 0
                ? `${failCount} action(s) requise(s)`
                : "aucune action critique"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {SECURITY_CHECKS.map((check, i) => (
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
