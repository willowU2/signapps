"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Monitor,
  RefreshCw,
  Shield,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { adApi } from "@/lib/api/active-directory";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdTeamAccount {
  id: string;
  display_name: string;
  sam_account_name: string;
  status: "synced" | "disabled" | "pending";
  last_login?: string;
}

interface AdTeamComputer {
  id: string;
  hostname: string;
  os: string;
  last_seen?: string;
}

interface AdTeamGpo {
  name: string;
  guid?: string;
  settings?: Record<string, unknown>;
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<
  AdTeamAccount["status"],
  { label: string; className: string }
> = {
  synced: {
    label: "Actif",
    className: "border-green-500 text-green-600 bg-green-50",
  },
  disabled: {
    label: "Desactivé",
    className: "border-red-500 text-red-600 bg-red-50",
  },
  pending: {
    label: "En attente",
    className: "border-yellow-500 text-yellow-600 bg-yellow-50",
  },
};

// ── AD Accounts section ───────────────────────────────────────────────────────

function AccountsSection() {
  const queryClient = useQueryClient();

  const {
    data: accounts,
    isLoading,
    isError,
    refetch,
  } = useQuery<AdTeamAccount[]>({
    queryKey: ["ad-my-team-accounts"],
    queryFn: () =>
      adApi.myTeamAd.accounts().then((r) => r.data as AdTeamAccount[]),
  });

  const disableMutation = useMutation({
    mutationFn: (id: string) => adApi.myTeamAd.disableAccount(id),
    onSuccess: () => {
      toast.success("Compte désactivé");
      void queryClient.invalidateQueries({ queryKey: ["ad-my-team-accounts"] });
    },
    onError: () => toast.error("Échec de la désactivation"),
  });

  const enableMutation = useMutation({
    mutationFn: (id: string) => adApi.myTeamAd.enableAccount(id),
    onSuccess: () => {
      toast.success("Compte activé");
      void queryClient.invalidateQueries({ queryKey: ["ad-my-team-accounts"] });
    },
    onError: () => toast.error("Échec de l'activation"),
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) => adApi.myTeamAd.resetPassword(id),
    onSuccess: () => toast.success("Mot de passe réinitialisé"),
    onError: () => toast.error("Échec de la réinitialisation"),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
        <p>Impossible de charger les comptes AD.</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void refetch()}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Réessayer
        </Button>
      </div>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Aucun compte AD dans votre équipe.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Nom</th>
            <th className="pb-2 pr-4 font-medium">SAM</th>
            <th className="pb-2 pr-4 font-medium">Statut</th>
            <th className="pb-2 pr-4 font-medium">Dernier login</th>
            <th className="pb-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {accounts.map((account) => {
            const badge = STATUS_BADGE[account.status] ?? STATUS_BADGE.pending;
            const isEnabled = account.status === "synced";
            const isMutating =
              disableMutation.isPending || enableMutation.isPending;

            return (
              <tr key={account.id} className="py-2">
                <td className="py-2 pr-4 font-medium">
                  {account.display_name}
                </td>
                <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                  {account.sam_account_name}
                </td>
                <td className="py-2 pr-4">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", badge.className)}
                  >
                    {badge.label}
                  </Badge>
                </td>
                <td className="py-2 pr-4 text-xs text-muted-foreground">
                  {account.last_login
                    ? new Date(account.last_login).toLocaleDateString("fr-FR")
                    : "—"}
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={isEnabled}
                      disabled={isMutating || account.status === "pending"}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          enableMutation.mutate(account.id);
                        } else {
                          disableMutation.mutate(account.id);
                        }
                      }}
                      aria-label={`Activer/désactiver ${account.display_name}`}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={resetMutation.isPending}
                      onClick={() => resetMutation.mutate(account.id)}
                    >
                      Reset MDP
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Computers section ─────────────────────────────────────────────────────────

function ComputersSection() {
  const {
    data: computers,
    isLoading,
    isError,
    refetch,
  } = useQuery<AdTeamComputer[]>({
    queryKey: ["ad-my-team-computers"],
    queryFn: () =>
      adApi.myTeamAd.computers().then((r) => r.data as AdTeamComputer[]),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
        <p>Impossible de charger les ordinateurs.</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void refetch()}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Réessayer
        </Button>
      </div>
    );
  }

  if (!computers || computers.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Aucun ordinateur associé à votre équipe.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {computers.map((computer) => (
        <Card key={computer.id} className="border-border">
          <CardContent className="flex flex-col gap-1 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-medium text-sm">{computer.hostname}</span>
            </div>
            <p className="text-xs text-muted-foreground pl-6">{computer.os}</p>
            {computer.last_seen && (
              <p className="text-xs text-muted-foreground pl-6">
                Dernier vu :{" "}
                {new Date(computer.last_seen).toLocaleDateString("fr-FR")}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── GPO section ───────────────────────────────────────────────────────────────

function GpoSection() {
  const [expanded, setExpanded] = useState(false);

  const {
    data: gpoData,
    isLoading,
    isError,
    refetch,
  } = useQuery<AdTeamGpo[]>({
    queryKey: ["ad-my-team-gpo"],
    queryFn: () => adApi.myTeamAd.gpo().then((r) => r.data as AdTeamGpo[]),
  });

  if (isLoading) {
    return <Skeleton className="h-16 rounded-lg" />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
        <p>Impossible de charger les GPOs.</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void refetch()}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Réessayer
        </Button>
      </div>
    );
  }

  if (!gpoData || gpoData.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Aucune GPO appliquée à votre équipe.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {gpoData.map((gpo, idx) => (
        <Card key={gpo.guid ?? idx} className="border-border">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{gpo.name}</span>
            </div>
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {expanded && gpo.settings && (
            <CardContent className="pt-0 pb-3">
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(gpo.settings, null, 2)}
              </pre>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TeamInfrastructure() {
  return (
    <div className="flex flex-col gap-8">
      {/* AD Accounts */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Comptes Active Directory
        </h2>
        <AccountsSection />
      </section>

      {/* Computers */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Ordinateurs
        </h2>
        <ComputersSection />
      </section>

      {/* GPO */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Stratégies de groupe (GPO)
        </h2>
        <GpoSection />
      </section>
    </div>
  );
}
