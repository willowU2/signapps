"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, X, Users, UserPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { orgApi } from "@/lib/api/org";
import { AddSitePersonDialog } from "./dialogs/add-site-person-dialog";
import type {
  OrgSiteRecord,
  OrgSitePersonsResponse,
  OrgSiteBookingRecord,
  Person,
} from "@/types/org";
import { avatarTint, personInitials } from "./avatar-helpers";

export interface SiteDetailCardProps {
  siteId: string;
  persons: Person[];
  onClose: () => void;
}

const KIND_LABELS: Record<string, string> = {
  building: "Bâtiment",
  floor: "Étage",
  room: "Salle",
  desk: "Bureau",
};

const KIND_COLORS: Record<string, string> = {
  building: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  floor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  room: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  desk: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

export function SiteDetailCard({
  siteId,
  persons,
  onClose,
}: SiteDetailCardProps) {
  const [site, setSite] = useState<OrgSiteRecord | null>(null);
  const [children, setChildren] = useState<OrgSiteRecord[]>([]);
  const [sitePersons, setSitePersons] = useState<OrgSitePersonsResponse | null>(
    null,
  );
  const [bookings, setBookings] = useState<OrgSiteBookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = () => setReloadTick((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      orgApi.orgSites.get(siteId),
      orgApi.orgSites.tree(siteId),
      orgApi.orgSites.persons(siteId),
      // list() requires a time window — default to [-7d, +21d] for a
      // reasonable demo view of recent and upcoming bookings.
      orgApi.orgBookings
        .list({
          site_id: siteId,
          since: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
          until: new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString(),
        })
        .catch(() => ({ data: [] as OrgSiteBookingRecord[] })),
    ])
      .then(([s, t, sp, b]) => {
        if (cancelled) return;
        setSite(s.data);
        const rest = (t.data ?? []).filter((n) => n.id !== siteId);
        setChildren(rest);
        setSitePersons(sp.data);
        setBookings(b.data ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setSite(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId, reloadTick]);

  const handleDetach = async (linkId: string) => {
    setRemoving(linkId);
    try {
      await orgApi.orgSites.detachPerson(linkId);
      toast.success("Rattachement retiré");
      reload();
    } catch (err) {
      toast.error(`Erreur : ${(err as Error).message}`);
    } finally {
      setRemoving(null);
    }
  };

  const personsById = new Map(persons.map((p) => [p.id, p]));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Chargement...
      </div>
    );
  }

  if (!site) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Site introuvable.
      </div>
    );
  }

  const kindLabel = KIND_LABELS[site.kind] ?? site.kind;
  const kindColor = KIND_COLORS[site.kind] ?? "bg-muted";
  const assignedPersons = sitePersons?.assignments ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between p-4 border-b border-border">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <h2 className="text-base font-semibold truncate">{site.name}</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-[10px] ${kindColor} border-0`}>
              {kindLabel}
            </Badge>
            {site.bookable && (
              <Badge variant="outline" className="text-[10px]">
                Bookable
              </Badge>
            )}
            {typeof site.capacity === "number" && (
              <span className="text-[10px] text-muted-foreground">
                Cap. {site.capacity}
              </span>
            )}
          </div>
          {site.address && (
            <p className="text-xs text-muted-foreground mt-2">{site.address}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {children.length > 0 && (
          <div className="p-4 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {children.length} enfant{children.length > 1 ? "s" : ""}
            </p>
            <div className="space-y-1">
              {children.slice(0, 20).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 p-1.5 text-xs rounded hover:bg-muted/50"
                >
                  <Badge
                    className={`text-[9px] ${KIND_COLORS[c.kind] ?? "bg-muted"} border-0`}
                  >
                    {KIND_LABELS[c.kind] ?? c.kind}
                  </Badge>
                  <span className="truncate flex-1">{c.name}</span>
                  {typeof c.capacity === "number" && (
                    <span className="text-[10px] text-muted-foreground">
                      {c.capacity}p
                    </span>
                  )}
                </div>
              ))}
              {children.length > 20 && (
                <p className="text-[10px] text-muted-foreground italic">
                  + {children.length - 20} autres
                </p>
              )}
            </div>
          </div>
        )}

        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              {assignedPersons.length} personne
              {assignedPersons.length > 1 ? "s" : ""} rattachée
              {assignedPersons.length > 1 ? "s" : ""}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setAddOpen(true)}
              title="Rattacher une personne"
            >
              <UserPlus className="h-3 w-3 mr-1" />
              Rattacher
            </Button>
          </div>
          <div className="space-y-2">
            {assignedPersons.slice(0, 15).map((link) => {
              const p = personsById.get(link.person_id);
              return (
                <div
                  key={link.id}
                  className="group flex items-center gap-2 p-1.5 rounded hover:bg-muted/50"
                >
                  <span
                    className={`text-[10px] rounded-full w-7 h-7 flex items-center justify-center font-semibold ${avatarTint(link.person_id)}`}
                  >
                    {personInitials(p)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate font-medium">
                      {p
                        ? `${p.first_name} ${p.last_name}`
                        : "Personne inconnue"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {link.role === "primary" ? "Principal" : "Secondaire"}
                      {p?.email ? ` · ${p.email}` : ""}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDetach(link.id)}
                    disabled={removing === link.id}
                    title="Détacher"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
            {assignedPersons.length > 15 && (
              <p className="text-[10px] text-muted-foreground italic">
                + {assignedPersons.length - 15} autres
              </p>
            )}
            {assignedPersons.length === 0 && (
              <p className="text-xs text-muted-foreground italic">—</p>
            )}
          </div>
        </div>

        <div className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {bookings.length} réservation{bookings.length > 1 ? "s" : ""}
          </p>
          <div className="space-y-1">
            {bookings.slice(0, 10).map((b) => {
              const p = personsById.get(b.person_id);
              const start = new Date(b.start_at);
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-2 p-1.5 text-xs rounded bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {b.purpose ?? "(sans objet)"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {start.toLocaleString("fr-FR", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {p ? p.first_name + " " + p.last_name : "—"}
                    </p>
                  </div>
                  <Badge
                    variant={b.status === "confirmed" ? "default" : "outline"}
                    className="text-[9px] shrink-0"
                  >
                    {b.status}
                  </Badge>
                </div>
              );
            })}
            {bookings.length === 0 && (
              <p className="text-xs text-muted-foreground italic">—</p>
            )}
          </div>
        </div>
      </div>

      <AddSitePersonDialog
        site={addOpen ? site : null}
        persons={persons}
        onClose={() => setAddOpen(false)}
        onAdded={reload}
      />
    </div>
  );
}
