"use client";

/**
 * SO8 — /me/inventory : dashboard utilisateur qui liste toutes les ressources
 * rattachées à l'user connecté, groupées par kind.
 *
 * Actions rapides par ressource : Déclarer un problème (→ in_maintenance),
 * Rendre (→ returned). Accessible à tout user authentifié (role >= 0).
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/use-page-title";
import { orgApi } from "@/lib/api/org";
import type {
  InventoryResponse,
  Resource,
  ResourceKind,
  ResourceStatus,
} from "@/types/org";
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
  Undo2,
  Wrench,
  ExternalLink,
} from "lucide-react";

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
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

const KIND_LABEL: Record<string, string> = {
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

const STATUS_LABELS: Record<ResourceStatus, string> = {
  ordered: "Commandée",
  active: "En service",
  loaned: "Prêtée",
  in_maintenance: "En maintenance",
  returned: "Rendue",
  retired: "Retirée",
};

export default function MyInventoryPage() {
  usePageTitle("Mon inventaire");

  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useMemo(
    () => async () => {
      setLoading(true);
      try {
        const res = await orgApi.inventory.mine();
        setData(res.data);
      } catch (e) {
        console.error(e);
        toast.error("Erreur de chargement");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const handleAction = async (
    resource: Resource,
    to: ResourceStatus,
    reason: string,
  ) => {
    setBusy(resource.id);
    try {
      await orgApi.resources.transition(resource.id, { to, reason });
      toast.success("Ressource mise à jour");
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Transition refusée ou erreur serveur");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 text-muted-foreground">Chargement…</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 p-4">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Mon inventaire</h1>
            <p className="text-sm text-muted-foreground">
              {data?.total ?? 0} ressources rattachées
            </p>
          </div>
        </div>

        {(!data || data.total === 0) && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Aucune ressource rattachée à votre profil.
            </CardContent>
          </Card>
        )}

        {data?.by_kind.map((bucket) => {
          const Icon = KIND_ICON[bucket.kind] ?? CircleHelp;
          return (
            <Card key={bucket.kind}>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {KIND_LABEL[bucket.kind] ?? bucket.kind}
                  <Badge variant="outline" className="text-xs">
                    {bucket.resources.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {bucket.resources.map((r) => (
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
                        <Badge variant="outline" className="text-xs shrink-0">
                          {STATUS_LABELS[r.status]}
                        </Badge>
                      </div>
                      {r.serial_or_ref && (
                        <p className="text-xs text-muted-foreground truncate">
                          {r.serial_or_ref}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {r.status === "active" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy === r.id}
                            onClick={() =>
                              handleAction(r, "returned", "Quick return")
                            }
                            title="Rendre"
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy === r.id}
                            onClick={() =>
                              handleAction(
                                r,
                                "in_maintenance",
                                "Issue reported by user",
                              )
                            }
                            title="Déclarer un problème"
                          >
                            <Wrench className="h-4 w-4" />
                          </Button>
                        </>
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppLayout>
  );
}
