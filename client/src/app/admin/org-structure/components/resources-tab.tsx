"use client";

/**
 * SO8 — Resources tab embedded in the org-structure DetailPanel.
 *
 * Node mode   : shows every resource assigned to the node (not children).
 * Person mode : shows every resource assigned to that person, grouped by kind.
 *
 * Offers a quick action button to rendre (retourner) or marquer en maintenance
 * for the top-most common workflows. Full CRUD lives on `/admin/resources`.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";
import { orgApi } from "@/lib/api/org";
import type { Resource, ResourceKind, ResourceStatus } from "@/types/org";
import {
  Package,
  Car,
  Key as KeyIcon,
  IdCard,
  Camera,
  Sofa,
  Smartphone,
  FileCode2,
  CircleHelp,
  ExternalLink,
  Undo2,
  Wrench,
} from "lucide-react";

export interface ResourcesTabProps {
  mode: "node" | "person";
  nodeId?: string;
  personId?: string;
}

const KIND_ICON: Record<
  ResourceKind,
  React.ComponentType<{ className?: string }>
> = {
  it_device: Package,
  vehicle: Car,
  key_physical: KeyIcon,
  badge: IdCard,
  av_equipment: Camera,
  furniture: Sofa,
  mobile_phone: Smartphone,
  license_software: FileCode2,
  other: CircleHelp,
};

const KIND_LABEL: Record<ResourceKind, string> = {
  it_device: "IT & informatique",
  vehicle: "Véhicules",
  key_physical: "Clés physiques",
  badge: "Badges",
  av_equipment: "Équipement AV",
  furniture: "Mobilier",
  mobile_phone: "Téléphones",
  license_software: "Licences logiciel",
  other: "Autres",
};

const STATUS_LABEL: Record<ResourceStatus, string> = {
  ordered: "Commandé",
  active: "En service",
  loaned: "Prêté",
  in_maintenance: "Maintenance",
  returned: "Rendu",
  retired: "Retiré",
};

const STATUS_VARIANT: Record<
  ResourceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ordered: "outline",
  active: "default",
  loaned: "secondary",
  in_maintenance: "secondary",
  returned: "outline",
  retired: "destructive",
};

export function ResourcesTab({ mode, nodeId, personId }: ResourcesTabProps) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useMemo(
    () => async () => {
      setLoading(true);
      try {
        const params: Parameters<typeof orgApi.resources.list>[0] = {};
        if (mode === "node" && nodeId) params.assigned_to_node_id = nodeId;
        if (mode === "person" && personId)
          params.assigned_to_person_id = personId;
        const res = await orgApi.resources.list(params);
        setResources(res.data ?? []);
      } catch (e) {
        toast.error("Erreur de chargement des ressources");
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [mode, nodeId, personId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const by: Partial<Record<ResourceKind, Resource[]>> = {};
    for (const r of resources) {
      const k = r.kind;
      if (!by[k]) by[k] = [];
      by[k]!.push(r);
    }
    return by;
  }, [resources]);

  const handleTransition = async (
    id: string,
    to: ResourceStatus,
    reason: string,
  ) => {
    setBusyId(id);
    try {
      await orgApi.resources.transition(id, { to, reason });
      toast.success("Ressource mise à jour");
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Transition refusée ou erreur serveur");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Chargement…</div>;
  }

  if (resources.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Aucune ressource rattachée
        {mode === "person" ? " à cette personne" : " à ce noeud"}.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {(Object.keys(grouped) as ResourceKind[]).map((kind) => {
        const items = grouped[kind] ?? [];
        const Icon = KIND_ICON[kind];
        return (
          <div key={kind} className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">{KIND_LABEL[kind]}</h4>
              <Badge variant="outline" className="text-xs">
                {items.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {items.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start justify-between gap-2 rounded-md border border-border bg-card p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/resources/${r.id}`}
                        className="text-sm font-medium hover:underline truncate"
                      >
                        {r.name}
                      </Link>
                      <Badge
                        variant={STATUS_VARIANT[r.status]}
                        className="text-xs shrink-0"
                      >
                        {STATUS_LABEL[r.status]}
                      </Badge>
                    </div>
                    {r.serial_or_ref && (
                      <p className="text-xs text-muted-foreground truncate">
                        {r.serial_or_ref}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {mode === "person" && r.status === "active" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === r.id}
                        onClick={() =>
                          handleTransition(r.id, "returned", "Quick return")
                        }
                        title="Rendre"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    )}
                    {r.status === "active" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === r.id}
                        onClick={() =>
                          handleTransition(
                            r.id,
                            "in_maintenance",
                            "Issue reported",
                          )
                        }
                        title="Déclarer un problème"
                      >
                        <Wrench className="h-4 w-4" />
                      </Button>
                    )}
                    <Link href={`/admin/resources/${r.id}`} title="Détails">
                      <Button size="sm" variant="ghost" asChild>
                        <span>
                          <ExternalLink className="h-4 w-4" />
                        </span>
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
