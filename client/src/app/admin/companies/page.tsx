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
import { Skeleton } from "@/components/ui/skeleton";
import {
  companiesApi,
  type Company,
  type PersonCompany,
  type CreateCompanyRequest,
} from "@/lib/api/companies";
import {
  Building2,
  Plus,
  ChevronDown,
  ChevronRight,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/components/ui/error-state";

// ─── Badge colours by company type ────────────────────────────────────────────

const TYPE_CONFIG: Record<
  Company["company_type"],
  { label: string; variant: string; className: string }
> = {
  internal: {
    label: "Interne",
    variant: "default",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  client: {
    label: "Client",
    variant: "default",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  supplier: {
    label: "Fournisseur",
    variant: "default",
    className:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  partner: {
    label: "Partenaire",
    variant: "default",
    className:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
};

// ─── Expanded row: affiliated persons ─────────────────────────────────────────

function AffiliatedPersonsRow({ companyId }: { companyId: string }) {
  const [persons, setPersons] = useState<PersonCompany[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    companiesApi
      .listPersons(companyId)
      .then((res) => setPersons(res.data ?? []))
      .catch(() => setPersons([]))
      .finally(() => setLoading(false));
  }, [companyId]);

  if (loading) {
    return (
      <TableRow>
        <TableCell colSpan={6} className="bg-muted/30 px-8 py-3">
          <Skeleton className="h-4 w-48" />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell colSpan={6} className="bg-muted/30 px-8 py-3">
        {persons.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Aucune personne affiliée
          </p>
        ) : (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              <Users className="inline h-3 w-3 mr-1" />
              Personnes affiliées ({persons.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {persons.map((p) => (
                <Badge key={p.id} variant="secondary" className="text-xs">
                  {p.role_in_company}
                  {p.job_title ? ` — ${p.job_title}` : ""}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULT_FORM: CreateCompanyRequest = {
  name: "",
  company_type: "client",
  legal_name: "",
  siren: "",
  city: "",
  country: "FR",
  website: "",
};

export default function CompaniesPage() {
  usePageTitle("Entreprises — Administration");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateCompanyRequest>(DEFAULT_FORM);
  const [creating, setCreating] = useState(false);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await companiesApi.list();
      setCompanies(res.data ?? []);
    } catch {
      setLoadError(true);
      toast.error("Erreur lors du chargement des entreprises");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      await companiesApi.create(form);
      toast.success("Entreprise créée");
      setCreateOpen(false);
      setForm(DEFAULT_FORM);
      loadCompanies();
    } catch {
      toast.error("Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`Désactiver "${name}" ?`)) return;
    try {
      await companiesApi.deactivate(id);
      toast.success("Entreprise désactivée");
      loadCompanies();
    } catch {
      toast.error("Erreur lors de la désactivation");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout>
        <div className="px-6 py-6 space-y-6">
          <PageHeader
            title="Entreprises"
            description="Gérez les entreprises et leurs affiliations"
            icon={<Building2 className="h-5 w-5" />}
          />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loadError) {
    return (
      <AppLayout>
        <div className="px-6 py-6 space-y-6">
          <PageHeader
            title="Entreprises"
            description="Gérez les entreprises et leurs affiliations"
            icon={<Building2 className="h-5 w-5" />}
          />
          <ErrorState
            title="Impossible de charger les entreprises"
            message="Vérifiez votre connexion au service d'identité."
            onRetry={loadCompanies}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-6 py-6 space-y-6">
        {/* Header */}
        <PageHeader
          title="Entreprises"
          description="Gérez les entreprises et leurs affiliations"
          icon={<Building2 className="h-5 w-5" />}
          actions={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle entreprise
            </Button>
          }
        />

        {/* Table */}
        {companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              Aucune entreprise enregistrée
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Créer la première entreprise
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-8" />
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>SIREN</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => {
                  const typeConf = TYPE_CONFIG[company.company_type];
                  const isExpanded = expandedId === company.id;
                  return (
                    <React.Fragment key={company.id}>
                      <TableRow
                        className={cn(
                          "cursor-pointer transition-colors",
                          isExpanded && "bg-muted/20",
                        )}
                        onClick={() => toggleExpand(company.id)}
                      >
                        <TableCell className="pr-0">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {company.name}
                          {company.legal_name &&
                            company.legal_name !== company.name && (
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                ({company.legal_name})
                              </span>
                            )}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("border-0", typeConf.className)}>
                            {typeConf.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {company.city ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {company.siren ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              company.is_active !== false
                                ? "default"
                                : "secondary"
                            }
                            className={
                              company.is_active !== false
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0"
                                : ""
                            }
                          >
                            {company.is_active !== false ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {company.is_active !== false && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                              onClick={() =>
                                handleDeactivate(company.id, company.name)
                              }
                            >
                              Désactiver
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <AffiliatedPersonsRow companyId={company.id} />
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Create dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nouvelle entreprise</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="company-name">
                  Nom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="company-name"
                  placeholder="Acme Corp"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <Label htmlFor="company-type">
                  Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.company_type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, company_type: v }))
                  }
                >
                  <SelectTrigger id="company-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Interne</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="supplier">Fournisseur</SelectItem>
                    <SelectItem value="partner">Partenaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Legal name */}
              <div className="space-y-1.5">
                <Label htmlFor="company-legal-name">Raison sociale</Label>
                <Input
                  id="company-legal-name"
                  placeholder="Acme Corporation SAS"
                  value={form.legal_name ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, legal_name: e.target.value }))
                  }
                />
              </div>

              {/* SIREN */}
              <div className="space-y-1.5">
                <Label htmlFor="company-siren">SIREN</Label>
                <Input
                  id="company-siren"
                  placeholder="123456789"
                  maxLength={9}
                  value={form.siren ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, siren: e.target.value }))
                  }
                />
              </div>

              {/* City + Country row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="company-city">Ville</Label>
                  <Input
                    id="company-city"
                    placeholder="Paris"
                    value={form.city ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, city: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company-country">Pays</Label>
                  <Input
                    id="company-country"
                    placeholder="FR"
                    maxLength={2}
                    value={form.country ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        country: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>
              </div>

              {/* Website */}
              <div className="space-y-1.5">
                <Label htmlFor="company-website">Site web</Label>
                <Input
                  id="company-website"
                  placeholder="https://acme.com"
                  value={form.website ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, website: e.target.value }))
                  }
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
              <Button
                onClick={handleCreate}
                disabled={creating || !form.name.trim()}
              >
                {creating ? "Création…" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
