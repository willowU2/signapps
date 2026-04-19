"use client";

/**
 * SO7 — Booking list + create form (simplified calendar).
 *
 * The spec mentions FullCalendar but it's not in `package.json`. A full
 * drag-drop calendar is over-kill for MVP ; instead we render :
 *
 *  - A day picker (input type="date")
 *  - A 30-minute grid (00:00 → 23:30) with availability from the
 *    `/availability` endpoint.
 *  - A "Nouveau booking" button that opens a form (start, end, purpose).
 *  - A simple list of upcoming bookings below.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CalendarDays, Plus, X } from "lucide-react";
import { orgApi } from "@/lib/api/org";
import type {
  OrgSiteBookingRecord,
  OrgAvailabilityResponse,
  OrgSiteRecord,
  Person,
} from "@/types/org";

export interface BookingListProps {
  site: OrgSiteRecord;
  persons: Person[];
  onChanged?: () => void;
}

function isoToLocalDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

function todayYMD(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function BookingList({ site, persons, onChanged }: BookingListProps) {
  const [day, setDay] = useState<string>(() => todayYMD());
  const [availability, setAvailability] =
    useState<OrgAvailabilityResponse | null>(null);
  const [bookings, setBookings] = useState<OrgSiteBookingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<{
    open: boolean;
    startAt?: string;
  }>({ open: false });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [av, b] = await Promise.all([
        orgApi.orgSites.availability(site.id, { day, slot_minutes: 30 }),
        orgApi.orgBookings.list({
          site_id: site.id,
          since: new Date(day + "T00:00:00Z").toISOString(),
          until: new Date(
            new Date(day + "T00:00:00Z").getTime() + 86_400_000,
          ).toISOString(),
        }),
      ]);
      setAvailability(av.data);
      setBookings(b.data);
    } catch (e) {
      console.error("booking load failed", e);
      toast.error("Impossible de charger les réservations");
    } finally {
      setLoading(false);
    }
  }, [site.id, day]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const cancel = useCallback(
    async (booking: OrgSiteBookingRecord) => {
      if (!window.confirm(`Annuler la réservation ${booking.purpose ?? ""} ?`))
        return;
      try {
        await orgApi.orgBookings.cancel(booking.id);
        toast.success("Réservation annulée");
        await reload();
        onChanged?.();
      } catch (e) {
        console.error("cancel failed", e);
        toast.error("Impossible d'annuler");
      }
    },
    [reload, onChanged],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <Input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="w-40"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setDialog({
              open: true,
              startAt: new Date(day + "T09:00:00Z").toISOString(),
            })
          }
          disabled={!site.bookable}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Nouveau booking
        </Button>
        {!site.bookable && (
          <span className="text-xs text-muted-foreground italic">
            Ce site n'accepte pas les réservations.
          </span>
        )}
      </div>

      {/* Availability grid (24h × 30-min slots — 48 buckets). */}
      <SlotsGrid
        availability={availability}
        onSelectSlot={(startAt) => setDialog({ open: true, startAt })}
        disabled={!site.bookable}
      />

      {/* Upcoming bookings list. */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">
          {loading ? "Chargement…" : `${bookings.length} booking(s) ce jour`}
        </p>
        {bookings.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            Aucune réservation.
          </p>
        ) : (
          <div className="space-y-1">
            {bookings.map((b) => {
              const p = persons.find((x) => x.id === b.person_id);
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
                >
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {b.status}
                  </Badge>
                  <span className="font-medium">{b.purpose ?? "—"}</span>
                  <span className="text-muted-foreground">
                    {isoToLocalDate(b.start_at)} → {isoToLocalDate(b.end_at)}
                  </span>
                  <span className="ml-auto text-xs">
                    {p
                      ? `${p.first_name} ${p.last_name}`
                      : b.person_id.slice(0, 8)}
                  </span>
                  {b.status !== "cancelled" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive"
                      onClick={() => cancel(b)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BookingDialog
        open={dialog.open}
        startAt={dialog.startAt}
        site={site}
        persons={persons}
        onClose={() => setDialog({ open: false })}
        onCreated={async () => {
          setDialog({ open: false });
          await reload();
          onChanged?.();
        }}
      />
    </div>
  );
}

// ─── Grid (48 × 30-min slots) ─────────────────────────────────────────

function SlotsGrid({
  availability,
  onSelectSlot,
  disabled,
}: {
  availability: OrgAvailabilityResponse | null;
  onSelectSlot: (startAt: string) => void;
  disabled: boolean;
}) {
  if (!availability) {
    return (
      <div className="h-32 rounded-md border bg-muted/20 flex items-center justify-center text-xs text-muted-foreground">
        Chargement…
      </div>
    );
  }
  // Keep business hours 08:00 → 20:00 to reduce visual noise.
  const visible = availability.slots.filter((s) => {
    const h = new Date(s.start_at).getUTCHours();
    return h >= 8 && h < 20;
  });
  return (
    <div className="grid grid-cols-12 gap-1">
      {visible.map((slot, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelectSlot(slot.start_at)}
          disabled={disabled}
          title={`${slot.start_at} → ${slot.end_at}`}
          className={`h-7 rounded text-[10px] border ${
            slot.available
              ? "bg-emerald-500/15 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-700"
              : "bg-rose-500/15 border-rose-500/30 text-rose-700 cursor-not-allowed"
          }`}
        >
          {new Date(slot.start_at).toISOString().slice(11, 16)}
        </button>
      ))}
    </div>
  );
}

// ─── Create dialog ────────────────────────────────────────────────────

function BookingDialog({
  open,
  startAt,
  site,
  persons,
  onClose,
  onCreated,
}: {
  open: boolean;
  startAt?: string;
  site: OrgSiteRecord;
  persons: Person[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [personId, setPersonId] = useState<string>("");
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [purpose, setPurpose] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && startAt) {
      setStart(startAt.slice(0, 16));
      const endDate = new Date(new Date(startAt).getTime() + 30 * 60_000);
      setEnd(endDate.toISOString().slice(0, 16));
    }
  }, [open, startAt]);

  const sortedPersons = useMemo(
    () =>
      [...persons].sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(
          `${b.first_name} ${b.last_name}`,
        ),
      ),
    [persons],
  );

  const submit = useCallback(async () => {
    if (!personId || !start || !end) {
      toast.error("Remplis tous les champs");
      return;
    }
    setSubmitting(true);
    try {
      await orgApi.orgBookings.create({
        site_id: site.id,
        person_id: personId,
        start_at: new Date(start).toISOString(),
        end_at: new Date(end).toISOString(),
        purpose: purpose || undefined,
        status: "confirmed",
      });
      toast.success("Réservation créée");
      onCreated();
    } catch (e) {
      console.error("booking create failed", e);
      const msg =
        (e as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail ?? "Créneau déjà pris ou erreur";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [personId, start, end, purpose, site.id, onCreated]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réserver {site.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Personne</Label>
            <select
              className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
            >
              <option value="">— sélectionner —</option>
              {sortedPersons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Début</Label>
              <Input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <Label>Fin</Label>
              <Input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Motif</Label>
            <Input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Réunion de projet"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={submitting}>
            Réserver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
