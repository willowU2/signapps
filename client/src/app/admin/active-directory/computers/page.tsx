"use client";

import React, { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Monitor, Search, Trash2, KeyRound, RefreshCw } from "lucide-react";
import { useAdDomains } from "@/hooks/use-active-directory";
import { useAdComputers } from "@/hooks/use-active-directory";
import type { ComputerAccount } from "@/types/active-directory";

function osBadge(os?: string) {
  if (!os) return <Badge variant="secondary">Inconnu</Badge>;
  const lower = os.toLowerCase();
  if (lower.includes("windows"))
    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-200">{os}</Badge>
    );
  if (lower.includes("linux"))
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        {os}
      </Badge>
    );
  return <Badge variant="secondary">{os}</Badge>;
}

function isOnlineLast30Days(lastLogon?: string): boolean {
  if (!lastLogon) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  return new Date(lastLogon) >= cutoff;
}

export default function AdComputersPage() {
  usePageTitle("Ordinateurs — Active Directory");

  const [domainId, setDomainId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ComputerAccount | null>(
    null,
  );

  const { data: domains = [] } = useAdDomains();
  const { data: computers = [], isLoading, refetch } = useAdComputers(domainId);

  const filtered = useMemo(() => {
    if (!search.trim()) return computers;
    const q = search.toLowerCase();
    return computers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.dns_hostname ?? "").toLowerCase().includes(q),
    );
  }, [computers, search]);

  const onlineCount = useMemo(
    () => computers.filter((c) => isOnlineLast30Days(c.last_logon)).length,
    [computers],
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Comptes ordinateurs"
          description="Machines jointes au domaine Active Directory"
          icon={<Monitor className="h-5 w-5" />}
          actions={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Rafraichir
            </Button>
          }
        />

        {/* Domain selector + search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={domainId} onValueChange={setDomainId}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Selectionner un domaine..." />
            </SelectTrigger>
            <SelectContent>
              {domains.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.dns_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou DNS..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Stats bar */}
        {domainId && (
          <div className="flex gap-6 text-sm text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">
                {computers.length}
              </span>{" "}
              ordinateur{computers.length !== 1 ? "s" : ""} au total
            </span>
            <span>
              <span className="font-semibold text-foreground">
                {onlineCount}
              </span>{" "}
              actif{onlineCount !== 1 ? "s" : ""} (30 derniers jours)
            </span>
          </div>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Ordinateurs joints</CardTitle>
            <CardDescription>
              Comptes machine enregistres dans le domaine
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!domainId ? (
              <div className="text-center py-12 text-muted-foreground">
                <Monitor className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Selectionner un domaine</p>
                <p className="text-sm mt-1">
                  Choisissez un domaine pour afficher les ordinateurs
                </p>
              </div>
            ) : isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin opacity-40" />
                <p>Chargement...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Monitor className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">
                  Aucun ordinateur joint au domaine
                </p>
                <p className="text-sm mt-1">
                  {search
                    ? "Aucun resultat pour cette recherche"
                    : "Les machines jointes apparaitront ici"}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom ordinateur</TableHead>
                      <TableHead>Nom DNS</TableHead>
                      <TableHead>Systeme</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Derniere connexion</TableHead>
                      <TableHead>Cree le</TableHead>
                      <TableHead className="w-[100px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((computer) => (
                      <TableRow key={computer.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4 text-muted-foreground" />
                            {computer.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs text-muted-foreground">
                            {computer.dns_hostname ?? "—"}
                          </code>
                        </TableCell>
                        <TableCell>{osBadge(computer.os)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {computer.os_version ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {computer.last_logon
                            ? new Date(computer.last_logon).toLocaleDateString(
                                "fr-FR",
                              )
                            : "Jamais"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(computer.created_at).toLocaleDateString(
                            "fr-FR",
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Reinitialiser le mot de passe"
                            >
                              <KeyRound className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Supprimer"
                              onClick={() => setDeleteTarget(computer)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
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

        {/* Delete confirmation */}
        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Supprimer le compte ordinateur
              </AlertDialogTitle>
              <AlertDialogDescription>
                Etes-vous sur de vouloir supprimer{" "}
                <strong>{deleteTarget?.name}</strong> du domaine ? Cette action
                est irreversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => setDeleteTarget(null)}
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
