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
import { AssignmentPanel } from "@/components/org/assignment-panel";
import { orgApi } from "@/lib/api/org";
import type { Person, PersonRole, PersonRoleType } from "@/types/org";
import { Plus, Users, Search, Link2, Filter } from "lucide-react";
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
                    colSpan={6}
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
