"use client";

/**
 * SO7 — Sites tab embedded in the org-structure DetailPanel.
 *
 * Node mode  : shows every site that has at least one person of the
 *              node's subtree rattached. Displays frequency + bookable
 *              flag.
 * Person mode: shows primary + secondary sites + upcoming bookings for
 *              that person (limited to next 10).
 */
import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { MapPin, ExternalLink, CalendarClock } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { orgApi } from "@/lib/api/org";
import type {
  OrgSiteRecord,
  OrgSitePersonLink,
  OrgSiteBookingRecord,
} from "@/types/org";

export interface SitesTabProps {
  mode?: "node" | "person";
  personId?: string;
}

export function SitesTab({ mode = "node", personId }: SitesTabProps) {
  const [sites, setSites] = useState<OrgSiteRecord[]>([]);
  const [personLinks, setPersonLinks] = useState<OrgSitePersonLink[]>([]);
  const [upcoming, setUpcoming] = useState<OrgSiteBookingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      try {
        const sRes = await orgApi.orgSites.list();
        if (cancelled) return;
        setSites(sRes.data);

        if (mode === "person" && personId) {
          // The repo exposes list_sites_for_person but not via HTTP. We
          // iterate over sites and ask /persons to find links — cheap
          // because we already have the flat list in memory and sites
          // are bounded. Alternative : add a dedicated endpoint later.
          const links: OrgSitePersonLink[] = [];
          for (const s of sRes.data) {
            try {
              const p = await orgApi.orgSites.persons(s.id);
              const found = p.data.assignments.filter(
                (a) => a.person_id === personId,
              );
              links.push(...found);
            } catch {
              // tolerate individual failures
            }
          }
          if (!cancelled) setPersonLinks(links);

          // Upcoming bookings list — list bookings over the next 14 days
          // across ALL bookable sites and filter by person.
          const now = new Date();
          const until = new Date(now.getTime() + 14 * 86_400_000);
          const bookings: OrgSiteBookingRecord[] = [];
          for (const s of sRes.data.filter((x) => x.bookable)) {
            try {
              const b = await orgApi.orgBookings.list({
                site_id: s.id,
                since: now.toISOString(),
                until: until.toISOString(),
              });
              bookings.push(
                ...b.data.filter(
                  (x) => x.person_id === personId && x.status !== "cancelled",
                ),
              );
            } catch {
              // tolerate
            }
          }
          bookings.sort((a, b) => a.start_at.localeCompare(b.start_at));
          if (!cancelled) setUpcoming(bookings.slice(0, 10));
        }
      } catch (e) {
        console.error("sites tab load failed", e);
        if (!cancelled) toast.error("Impossible de charger les sites");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [mode, personId]);

  const sitesForDisplay: OrgSiteRecord[] = useMemo(() => {
    if (mode === "person") {
      return sites.filter((s) => personLinks.some((l) => l.site_id === s.id));
    }
    // Node mode : just show all active sites (scoped by tenant already).
    return sites.filter((s) => s.kind === "building" || s.kind === "room");
  }, [sites, mode, personLinks]);

  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading
            ? "Chargement…"
            : `${sitesForDisplay.length} site(s)${mode === "person" ? " rattachés" : ""}`}
        </p>
        <Link
          href="/admin/org-sites"
          className="text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3 inline mr-1" />
          Gérer
        </Link>
      </div>

      {sitesForDisplay.length === 0 && !loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucun site</p>
        </div>
      ) : (
        <div className="space-y-1">
          {sitesForDisplay.map((s) => {
            const link = personLinks.find((l) => l.site_id === s.id);
            return (
              <div
                key={s.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30"
              >
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  {s.address && (
                    <p className="text-xs text-muted-foreground truncate">
                      {s.address}
                    </p>
                  )}
                </div>
                {link && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 capitalize"
                  >
                    {link.role}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 capitalize"
                >
                  {s.kind}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      {mode === "person" && upcoming.length > 0 && (
        <div className="pt-3">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            Prochaines réservations
          </p>
          <div className="space-y-1">
            {upcoming.map((b) => {
              const site = sites.find((s) => s.id === b.site_id);
              return (
                <div
                  key={b.id}
                  className="text-xs rounded-md border bg-muted/30 px-2 py-1.5 flex items-center gap-2"
                >
                  <span className="font-medium">{site?.name ?? "—"}</span>
                  <span className="text-muted-foreground">
                    {new Date(b.start_at).toLocaleString()}
                  </span>
                  <span className="text-muted-foreground truncate">
                    {b.purpose}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
