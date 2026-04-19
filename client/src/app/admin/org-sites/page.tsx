"use client";

/**
 * SO7 — Sites physiques admin page.
 *
 * Left panel : hierarchical tree (building > floor > room > desk).
 * Right panel : detail of the selected site with tabs (détails, persons,
 * bookings, occupancy).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { usePageTitle } from "@/hooks/use-page-title";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Building2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { orgApi } from "@/lib/api/org";
import type {
  OrgSiteRecord,
  Person,
  OrgSitePersonsResponse,
} from "@/types/org";
import { SiteTree } from "@/components/sites/site-tree";
import { BookingList } from "@/components/sites/booking-list";
import { OccupancyHeatmap } from "@/components/sites/occupancy-heatmap";

export default function OrgSitesPage() {
  usePageTitle("Sites physiques");

  const [sites, setSites] = useState<OrgSiteRecord[]>([]);
  const [selected, setSelected] = useState<OrgSiteRecord | null>(null);
  const [sitePersons, setSitePersons] = useState<OrgSitePersonsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orgApi.orgSites.list();
      setSites(res.data);
      // Keep the current selection if still present, else pick first building.
      setSelected((prev) => {
        if (prev) {
          const match = res.data.find((s) => s.id === prev.id);
          if (match) return match;
        }
        return (
          res.data.find((s) => s.kind === "building") ?? res.data[0] ?? null
        );
      });
    } catch (e) {
      console.error("sites list failed", e);
      toast.error("Impossible de charger les sites");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!selected) {
      setSitePersons(null);
      return;
    }
    let cancelled = false;
    orgApi.orgSites
      .persons(selected.id)
      .then((res) => {
        if (!cancelled) setSitePersons(res.data);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("site persons load failed", e);
          setSitePersons({ assignments: [], persons: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  return (
    <AppLayout>
      <div className="w-full space-y-4 h-full flex flex-col">
        <PageHeader
          title="Sites physiques"
          description="Hiérarchie building > floor > room > desk + réservations."
          icon={<MapPin className="h-5 w-5" />}
          actions={
            <Button disabled title="Création UI à venir">
              <Plus className="h-4 w-4" />
              Nouveau bâtiment
            </Button>
          }
        />

        <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
          {/* Tree panel */}
          <div className="col-span-4 border rounded-md bg-card overflow-y-auto p-2">
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground italic">
                Chargement…
              </p>
            ) : (
              <SiteTree
                sites={sites}
                selectedId={selected?.id}
                onSelect={setSelected}
              />
            )}
          </div>

          {/* Detail panel */}
          <div className="col-span-8 border rounded-md bg-card overflow-y-auto">
            {selected ? (
              <SiteDetail
                site={selected}
                persons={sitePersons?.persons ?? []}
                onRefresh={reload}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 p-8">
                <Building2 className="h-12 w-12 opacity-20" />
                <p className="text-sm">Sélectionne un site dans l'arbre.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Site detail ──────────────────────────────────────────────────────

function SiteDetail({
  site,
  persons,
  onRefresh,
}: {
  site: OrgSiteRecord;
  persons: Person[];
  onRefresh: () => void;
}) {
  const gps = site.gps as { lat: number; lng: number } | null;
  const gMaps = useMemo(() => {
    if (!gps) return null;
    return `https://www.google.com/maps?q=${gps.lat},${gps.lng}`;
  }, [gps]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{site.name}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="text-xs capitalize">
              {site.kind}
            </Badge>
            {site.capacity != null && (
              <span className="text-xs text-muted-foreground">
                Capacité {site.capacity}
              </span>
            )}
            {site.bookable && (
              <Badge className="text-xs bg-emerald-500/15 text-emerald-700">
                Bookable
              </Badge>
            )}
            {site.timezone && (
              <span className="text-xs text-muted-foreground">
                {site.timezone}
              </span>
            )}
          </div>
          {site.address && (
            <p className="text-sm text-muted-foreground mt-1">{site.address}</p>
          )}
          {gMaps && (
            <a
              href={gMaps}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Voir sur Google Maps
            </a>
          )}
        </div>
      </div>

      <Tabs defaultValue="persons" className="w-full">
        <TabsList>
          <TabsTrigger value="persons">
            Personnes ({persons.length})
          </TabsTrigger>
          <TabsTrigger value="bookings">Réservations</TabsTrigger>
          <TabsTrigger value="occupancy">Occupation</TabsTrigger>
          <TabsTrigger value="equipment">Équipement</TabsTrigger>
        </TabsList>

        <TabsContent value="persons" className="pt-3">
          {persons.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">
              Aucune personne rattachée.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {persons.map((p) => (
                <li
                  key={p.id}
                  className="rounded-md border bg-muted/30 px-3 py-2"
                >
                  <span className="font-medium">
                    {p.first_name} {p.last_name}
                  </span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {p.email}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="bookings" className="pt-3">
          <BookingList site={site} persons={persons} onChanged={onRefresh} />
        </TabsContent>

        <TabsContent value="occupancy" className="pt-3">
          <OccupancyHeatmap site={site} />
        </TabsContent>

        <TabsContent value="equipment" className="pt-3">
          <pre className="rounded-md border bg-muted/40 p-3 text-xs overflow-x-auto">
            {JSON.stringify(site.equipment ?? {}, null, 2)}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}
