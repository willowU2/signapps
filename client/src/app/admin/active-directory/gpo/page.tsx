"use client";

import React, { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  FileText,
  Plus,
  Trash2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  useAdDomains,
  useAdGpos,
  useCreateGpo,
  useUpdateGpo,
  useDeleteGpo,
} from "@/hooks/use-active-directory";
import type { GroupPolicyObject } from "@/types/active-directory";

const DEFAULT_POLICIES = [
  "Default Domain Policy",
  "Default Domain Controllers Policy",
];

function isDefaultPolicy(name: string): boolean {
  return DEFAULT_POLICIES.some((d) =>
    name.toLowerCase().includes(d.toLowerCase()),
  );
}

export default function AdGpoPage() {
  usePageTitle("GPO — Active Directory");

  const [domainId, setDomainId] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newGpoName, setNewGpoName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<GroupPolicyObject | null>(
    null,
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: domains = [] } = useAdDomains();
  const { data: gpos = [], isLoading, refetch } = useAdGpos(domainId);
  const createGpo = useCreateGpo();
  const updateGpo = useUpdateGpo();
  const deleteGpo = useDeleteGpo();

  const sortedGpos = useMemo(() => {
    return [...gpos].sort((a, b) => {
      const aDefault = isDefaultPolicy(a.display_name) ? 0 : 1;
      const bDefault = isDefaultPolicy(b.display_name) ? 0 : 1;
      return (
        aDefault - bDefault || a.display_name.localeCompare(b.display_name)
      );
    });
  }, [gpos]);

  function handleCreate() {
    if (!newGpoName.trim() || !domainId) return;
    createGpo.mutate(
      { domainId, data: { display_name: newGpoName.trim(), enabled: true } },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setNewGpoName("");
        },
      },
    );
  }

  function handleToggle(gpo: GroupPolicyObject) {
    updateGpo.mutate({ id: gpo.id, data: { enabled: !gpo.enabled } });
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    deleteGpo.mutate(
      { id: deleteTarget.id, domainId },
      { onSuccess: () => setDeleteTarget(null) },
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Strategies de groupe (GPO)"
          description="Group Policy Objects pour la configuration des postes et utilisateurs"
          icon={<FileText className="h-5 w-5" />}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Rafraichir
              </Button>
              <Button
                size="sm"
                disabled={!domainId}
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle GPO
              </Button>
            </div>
          }
        />

        {/* Domain selector */}
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

        {/* Stats bar */}
        {domainId && (
          <div className="flex gap-6 text-sm text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">
                {gpos.length}
              </span>{" "}
              GPO{gpos.length !== 1 ? "s" : ""} au total
            </span>
            <span>
              <span className="font-semibold text-foreground">
                {gpos.filter((g) => g.enabled).length}
              </span>{" "}
              active{gpos.filter((g) => g.enabled).length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* GPO Table */}
        <Card>
          <CardHeader>
            <CardTitle>Group Policy Objects</CardTitle>
            <CardDescription>
              Politiques de groupe appliquees au domaine
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!domainId ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Selectionner un domaine</p>
                <p className="text-sm mt-1">
                  Choisissez un domaine pour afficher les GPOs
                </p>
              </div>
            ) : isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin opacity-40" />
                <p>Chargement...</p>
              </div>
            ) : sortedGpos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Aucune GPO configuree</p>
                <p className="text-sm mt-1">
                  Creez votre premiere strategie de groupe
                </p>
                <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Creer une GPO
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-6" />
                      <TableHead>Nom</TableHead>
                      <TableHead>GUID</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Machines</TableHead>
                      <TableHead>Utilisateurs</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>OUs liees</TableHead>
                      <TableHead className="w-[100px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedGpos.map((gpo) => {
                      const isDefault = isDefaultPolicy(gpo.display_name);
                      const isExpanded = expandedId === gpo.id;
                      return (
                        <React.Fragment key={gpo.id}>
                          <TableRow
                            className={isDefault ? "bg-muted/30" : undefined}
                          >
                            <TableCell>
                              <button
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  setExpandedId(isExpanded ? null : gpo.id)
                                }
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                {gpo.display_name}
                                {isDefault && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px]"
                                  >
                                    Defaut
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs text-muted-foreground">
                                {gpo.id}
                              </code>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {gpo.version}
                            </TableCell>
                            <TableCell>
                              {gpo.machine_enabled ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800 text-[10px]">
                                  Active
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  Inactive
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {gpo.user_enabled ? (
                                <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">
                                  Active
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  Inactive
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {gpo.enabled ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800">
                                  Activee
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Desactivee</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {gpo.linked_ous.length > 0
                                ? gpo.linked_ous.length
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title={gpo.enabled ? "Desactiver" : "Activer"}
                                  onClick={() => handleToggle(gpo)}
                                >
                                  {gpo.enabled ? (
                                    <ToggleRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                  ) : (
                                    <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Supprimer"
                                  onClick={() => setDeleteTarget(gpo)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="bg-muted/10 hover:bg-muted/10">
                              <TableCell colSpan={9}>
                                <div className="py-2 px-4 space-y-2 text-sm">
                                  <div className="flex gap-8">
                                    <div>
                                      <span className="text-muted-foreground">
                                        GUID :
                                      </span>{" "}
                                      <code className="text-xs">{gpo.id}</code>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">
                                        Version :
                                      </span>{" "}
                                      {gpo.version}
                                    </div>
                                  </div>
                                  {gpo.linked_ous.length > 0 && (
                                    <div>
                                      <span className="text-muted-foreground">
                                        OUs liees :
                                      </span>{" "}
                                      <span>{gpo.linked_ous.join(", ")}</span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create GPO dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>Creer une strategie de groupe</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nom de la GPO</Label>
                <Input
                  placeholder="Ma strategie de groupe"
                  value={newGpoName}
                  onChange={(e) => setNewGpoName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <p className="text-xs text-muted-foreground">
                  Le GUID sera genere automatiquement par le systeme
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button
                disabled={!newGpoName.trim() || createGpo.isPending}
                onClick={handleCreate}
              >
                {createGpo.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Creer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer la GPO</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget && isDefaultPolicy(deleteTarget.display_name) && (
                  <span className="block mb-2 font-medium text-amber-600 dark:text-amber-400">
                    Attention : il s&apos;agit d&apos;une politique systeme par
                    defaut. Sa suppression peut affecter le fonctionnement du
                    domaine.
                  </span>
                )}
                Etes-vous sur de vouloir supprimer{" "}
                <strong>{deleteTarget?.display_name}</strong> ? Cette action est
                irreversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeleteConfirm}
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
