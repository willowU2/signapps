"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { AssignmentPanel } from "@/components/org/assignment-panel";
import { orgApi } from "@/lib/api/org";
import type { Person, PersonRole, PersonRoleType, OrgNode } from "@/types/org";
import {
  Plus,
  Users,
  Search,
  Link2,
  Filter,
  Download,
  Move,
  Tags,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  employee: {
    label: "Employé",
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  client_contact: {
    label: "Client",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  supplier_contact: {
    label: "Fournisseur",
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  partner: {
    label: "Partenaire",
    color:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
};

interface PersonWithDetails extends Person {
  roles?: PersonRole[];
  primaryPosition?: string;
}

export default function PersonsPage() {
  usePageTitle("Personnes — Administration");

  const [persons, setPersons] = useState<PersonWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("active");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // SO3 — bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkRoleOpen, setBulkRoleOpen] = useState(false);
  const [targetNode, setTargetNode] = useState<string>("");
  const [targetRole, setTargetRole] = useState<string>("");
  const [availableNodes, setAvailableNodes] = useState<OrgNode[]>([]);

  // Create form
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRoles, setNewRoles] = useState<PersonRoleType[]>(["employee"]);
  const [creating, setCreating] = useState(false);

  const loadPersons = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const params: { role?: string; active?: boolean } = {};
      if (roleFilter !== "all") params.role = roleFilter;
      if (activeFilter === "active") params.active = true;
      if (activeFilter === "inactive") params.active = false;

      const res = await orgApi.persons.list(params);
      setPersons((res.data ?? []) as PersonWithDetails[]);
    } catch {
      setLoadError(true);
      toast.error("Erreur lors du chargement des personnes");
    } finally {
      setLoading(false);
    }
  }, [roleFilter, activeFilter]);

  useEffect(() => {
    loadPersons();
  }, [loadPersons]);

  const handleCreatePerson = async () => {
    if (!newFirstName.trim() || !newLastName.trim()) return;
    setCreating(true);
    try {
      await orgApi.persons.create({
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        email: newEmail.trim() || undefined,
        phone: newPhone.trim() || undefined,
        is_active: true,
        metadata: {},
        role_type: newRoles[0],
      });
      toast.success("Personne créée");
      setCreateOpen(false);
      setNewFirstName("");
      setNewLastName("");
      setNewEmail("");
      setNewPhone("");
      setNewRoles(["employee"]);
      loadPersons();
    } catch {
      toast.error("Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  const toggleRole = (role: PersonRoleType) => {
    setNewRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const filteredPersons = persons.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      (p.email?.toLowerCase().includes(q) ?? false)
    );
  });

  // ─── SO3 bulk selection helpers ────────────────────────────────────
  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredPersons.map((p) => p.id)));
  }, [filteredPersons]);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const loadAvailableNodes = useCallback(async () => {
    try {
      const res = await orgApi.trees.list();
      // Fetch subtree of first tree to flatten all nodes.
      if (Array.isArray(res.data) && res.data.length > 0) {
        const roots = res.data;
        const all: OrgNode[] = [];
        for (const root of roots) {
          try {
            const sub = await orgApi.trees.getFull(root.id);
            if (Array.isArray(sub.data)) all.push(...sub.data);
          } catch {
            // ignore
          }
        }
        setAvailableNodes(all);
      }
    } catch {
      setAvailableNodes([]);
    }
  }, []);

  const openBulkMove = useCallback(() => {
    setTargetNode("");
    loadAvailableNodes().catch(() => {});
    setBulkMoveOpen(true);
  }, [loadAvailableNodes]);

  const runBulkMove = useCallback(async () => {
    if (!targetNode) {
      toast.error("Sélectionnez un noeud cible");
      return;
    }
    try {
      const res = await orgApi.bulk.move({
        person_ids: Array.from(selectedIds),
        target_node_id: targetNode,
        axis: "structure",
      });
      toast.success(
        `${res.data.created} assignment(s) créés (${res.data.errors.length} erreurs)`,
      );
      setBulkMoveOpen(false);
      clearSelection();
      await loadPersons();
    } catch (err) {
      toast.error(`Erreur bulk move: ${(err as Error).message}`);
    }
  }, [targetNode, selectedIds, clearSelection, loadPersons]);

  const runBulkExport = useCallback(async () => {
    try {
      const res = await orgApi.bulk.exportCsv(Array.from(selectedIds));
      // Axios returns the raw blob when responseType: "blob"; some versions
      // still hand back the string body, so we normalise both.
      const payload = res.data as unknown;
      const blob =
        payload instanceof Blob
          ? payload
          : new Blob(
              [typeof payload === "string" ? payload : String(payload)],
              {
                type: "text/csv",
              },
            );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "persons.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${selectedIds.size} personnes exportées`);
    } catch (err) {
      toast.error(`Erreur export: ${(err as Error).message}`);
    }
  }, [selectedIds]);

  const runBulkAssignRole = useCallback(async () => {
    if (!targetRole.trim()) {
      toast.error("Saisissez un rôle");
      return;
    }
    try {
      const res = await orgApi.bulk.assignRole(
        Array.from(selectedIds),
        targetRole.trim(),
      );
      toast.success(`${res.data.updated} rôle(s) assigné(s)`);
      setBulkRoleOpen(false);
      clearSelection();
      await loadPersons();
    } catch (err) {
      toast.error(`Erreur assign-role: ${(err as Error).message}`);
    }
  }, [targetRole, selectedIds, clearSelection, loadPersons]);

  if (loading) {
    return (
      <AppLayout>
        <div className="px-6 py-6 space-y-6">
          <PageHeader
            title="Personnes"
            description="Gérez les personnes et leurs affectations dans la structure organisationnelle"
            icon={<Users className="h-5 w-5" />}
          />
          <LoadingState variant="skeleton" />
        </div>
      </AppLayout>
    );
  }

  if (loadError) {
    return (
      <AppLayout>
        <div className="px-6 py-6 space-y-6">
          <PageHeader
            title="Personnes"
            description="Gérez les personnes et leurs affectations dans la structure organisationnelle"
            icon={<Users className="h-5 w-5" />}
          />
          <ErrorState
            title="Impossible de charger les personnes"
            message="Vérifiez votre connexion au service d'organisation."
            onRetry={loadPersons}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-6 py-6 space-y-6">
        <PageHeader
          title="Personnes"
          description="Gérez les personnes et leurs affectations dans la structure organisationnelle"
          icon={<Users className="h-5 w-5" />}
          actions={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Créer une personne
            </Button>
          }
        />

        {/* ── Filters ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une personne..."
              className="pl-9"
            />
          </div>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-44">
              <Filter className="h-4 w-4 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Rôle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les rôles</SelectItem>
              {Object.entries(ROLE_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="inactive">Inactifs</SelectItem>
              <SelectItem value="all">Tous</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Table ── */}
        <div className="border rounded-lg bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      selectedIds.size > 0 &&
                      selectedIds.size === filteredPersons.length
                    }
                    onCheckedChange={(checked) => {
                      if (checked) selectAll();
                      else clearSelection();
                    }}
                    aria-label="Sélectionner tout"
                  />
                </TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôles</TableHead>
                <TableHead>Position principale</TableHead>
                <TableHead className="text-center">Compte</TableHead>
                <TableHead className="text-center">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPersons.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center text-muted-foreground"
                  >
                    Aucune personne trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredPersons.map((person) => (
                  <TableRow
                    key={person.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelectedPerson(person);
                      setAssignmentOpen(true);
                    }}
                  >
                    <TableCell
                      className="w-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedIds.has(person.id)}
                        onCheckedChange={() => toggleSelected(person.id)}
                        aria-label={`Sélectionner ${person.first_name} ${person.last_name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs font-semibold">
                            {`${person.first_name[0] ?? ""}${person.last_name[0] ?? ""}`.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">
                          {person.first_name} {person.last_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {person.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {(person.roles ?? [])
                          .filter((r) => r.is_active)
                          .map((role) => {
                            const cfg = ROLE_CONFIG[role.role_type];
                            if (!cfg) return null;
                            return (
                              <span
                                key={role.id}
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                                  cfg.color,
                                )}
                              >
                                {cfg.label}
                              </span>
                            );
                          })}
                        {(!person.roles || person.roles.length === 0) && (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {person.primaryPosition ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {person.user_id ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] text-green-600"
                        >
                          <Link2 className="h-3 w-3 mr-1" />
                          Lié
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Non lié
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={person.is_active ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {person.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          {filteredPersons.length} personne(s) affichée(s)
        </p>
      </div>

      {/* ── SO3 bulk footer (sticky, visible when selection >0) ── */}
      {selectedIds.size > 0 ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} sélectionné(s)
          </span>
          <div className="h-5 w-px bg-border" />
          <Button size="sm" variant="ghost" onClick={openBulkMove}>
            <Move className="mr-1 size-4" /> Déplacer vers OU
          </Button>
          <Button size="sm" variant="ghost" onClick={runBulkExport}>
            <Download className="mr-1 size-4" /> Exporter CSV
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setTargetRole("");
              setBulkRoleOpen(true);
            }}
          >
            <Tags className="mr-1 size-4" /> Assigner rôle
          </Button>
          <div className="h-5 w-px bg-border" />
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={clearSelection}
            aria-label="Effacer la sélection"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      {/* ── Bulk move dialog ── */}
      <Dialog open={bulkMoveOpen} onOpenChange={setBulkMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Déplacer {selectedIds.size} personne(s) vers une OU
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="bulk-target">Noeud cible</Label>
              <Select value={targetNode} onValueChange={setTargetNode}>
                <SelectTrigger id="bulk-target">
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {availableNodes.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkMoveOpen(false)}>
              Annuler
            </Button>
            <Button onClick={runBulkMove} disabled={!targetNode}>
              Déplacer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk assign-role dialog ── */}
      <Dialog open={bulkRoleOpen} onOpenChange={setBulkRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Assigner un rôle à {selectedIds.size} personne(s)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="bulk-role">Intitulé du rôle</Label>
              <Input
                id="bulk-role"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="ex: Senior Engineer"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRoleOpen(false)}>
              Annuler
            </Button>
            <Button onClick={runBulkAssignRole} disabled={!targetRole.trim()}>
              Assigner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assignment panel ── */}
      <AssignmentPanel
        person={selectedPerson}
        open={assignmentOpen}
        onOpenChange={(open) => {
          setAssignmentOpen(open);
          if (!open) setSelectedPerson(null);
        }}
        onPersonUpdated={loadPersons}
      />

      {/* ── Create dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer une personne</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="first-name">Prénom *</Label>
                <Input
                  id="first-name"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  placeholder="Jean"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">Nom *</Label>
                <Input
                  id="last-name"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  placeholder="Dupont"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="jean.dupont@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+33 1 23 45 67 89"
              />
            </div>
            <div className="space-y-2">
              <Label>Rôles</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {(
                  Object.entries(ROLE_CONFIG) as [
                    PersonRoleType,
                    (typeof ROLE_CONFIG)[string],
                  ][]
                ).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleRole(key)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full font-medium border transition-colors",
                      newRoles.includes(key)
                        ? cn(cfg.color, "border-current")
                        : "bg-muted text-muted-foreground border-transparent hover:border-border",
                    )}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreatePerson}
              disabled={creating || !newFirstName.trim() || !newLastName.trim()}
            >
              {creating ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
