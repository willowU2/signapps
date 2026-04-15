"use client";

/**
 * MR2 — Auto meeting preparation
 *
 * For each meeting in the next 24h, shows agenda, attached documents,
 * notes from last meeting with same participants, and AI-generated talking points.
 */

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Clock,
  Users,
  FileText,
  Sparkles,
  Link2,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { calendarApi, aiApi } from "@/lib/api";
import { linksApi } from "@/lib/api/crosslinks";
import type { Event } from "@/types/calendar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttachedDoc {
  id: string;
  name: string;
  url?: string;
}

interface MeetingPrepData {
  event: Event;
  attachedDocs: AttachedDoc[];
  lastMeetingNotes: string | null;
  talkingPoints: string[];
  loadingAi: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ─── Sub-component: meeting card ─────────────────────────────────────────────

function MeetingPrepCard({
  prep,
  onGenerateAi,
}: {
  prep: MeetingPrepData;
  onGenerateAi: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { event } = prep;

  const attendees: string[] =
    event.attendees?.map((a) => a.email ?? a.name ?? "") ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{event.title}</CardTitle>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(event.start_time)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(event.start_time)} – {formatTime(event.end_time)}
              </span>
              {attendees.length > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {attendees.length} participant
                  {attendees.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Réduire" : "Développer"}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Agenda */}
          {event.description && (
            <div>
              <p className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                Ordre du jour
              </p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {event.description}
              </p>
            </div>
          )}

          {/* Attached documents */}
          {prep.attachedDocs.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Link2 className="w-4 h-4" />
                Documents liés
              </p>
              <div className="flex flex-wrap gap-2">
                {prep.attachedDocs.map((doc) => (
                  <Badge
                    key={doc.id}
                    variant="outline"
                    className="cursor-pointer"
                  >
                    {doc.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Last meeting notes */}
          {prep.lastMeetingNotes && (
            <div>
              <p className="text-sm font-semibold mb-1">
                Notes de la dernière réunion
              </p>
              <p className="text-sm text-muted-foreground bg-muted/40 rounded p-2 whitespace-pre-line">
                {prep.lastMeetingNotes}
              </p>
            </div>
          )}

          <Separator />

          {/* AI talking points */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                Points à aborder (IA)
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onGenerateAi(event.id)}
                disabled={prep.loadingAi}
              >
                {prep.loadingAi ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span className="ml-1 text-xs">Générer</span>
              </Button>
            </div>

            {prep.loadingAi ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ) : prep.talkingPoints.length > 0 ? (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {prep.talkingPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-0.5">•</span>
                    {pt}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Cliquez sur &ldquo;Générer&rdquo; pour obtenir des suggestions
                IA.
              </p>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MeetingPrep() {
  const [preps, setPreps] = useState<MeetingPrepData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const cals = await calendarApi.listCalendars();
        const allCals: any[] = cals.data ?? [];
        if (!allCals.length) return;

        const now = new Date();
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const eventArrays = await Promise.all(
          allCals.map((cal) =>
            calendarApi
              .listEvents(cal.id, now, in24h)
              .then((r) => r.data ?? []),
          ),
        );
        const events: Event[] = (eventArrays.flat() as Event[]).filter(
          (e) => new Date(e.start_time) >= now,
        );

        const prepList: MeetingPrepData[] = await Promise.all(
          events.map(async (event) => {
            // Fetch linked documents
            let attachedDocs: AttachedDoc[] = [];
            try {
              const links = await linksApi.find("event", event.id);
              attachedDocs = (
                (links.data as Array<{
                  id: string;
                  url?: string;
                  title?: string;
                  target_id?: string;
                }>) ?? []
              ).map((l) => ({
                id: l.id,
                name: l.target_id ?? l.id,
              }));
            } catch {}

            return {
              event,
              attachedDocs,
              lastMeetingNotes: null,
              talkingPoints: [],
              loadingAi: false,
            };
          }),
        );

        setPreps(prepList);
      } catch {
        toast.error("Impossible de charger les réunions");
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
  }, []);

  const handleGenerateAi = useCallback(
    async (eventId: string) => {
      setPreps((prev) =>
        prev.map((p) =>
          p.event.id === eventId
            ? { ...p, loadingAi: true, talkingPoints: [] }
            : p,
        ),
      );

      try {
        const prep = preps.find((p) => p.event.id === eventId);
        if (!prep) return;

        const attendees: string[] =
          prep.event.attendees?.map((a) => a.email ?? a.name ?? "") ?? [];
        const prompt = `Tu es un assistant de préparation de réunion.
Réunion: "${prep.event.title}"
Date: ${formatDate(prep.event.start_time)} à ${formatTime(prep.event.start_time)}
Participants: ${attendees.join(", ") || "inconnus"}
Ordre du jour: ${prep.event.description ?? "non précisé"}

Génère 5 points concis à aborder lors de cette réunion. Réponds uniquement avec une liste JSON de strings.`;

        const res = await aiApi.chat(prompt);
        const answer: string = (res.data as { answer?: string })?.answer ?? "";

        let points: string[] = [];
        try {
          const match = answer.match(/\[[\s\S]*\]/);
          if (match) points = JSON.parse(match[0]);
        } catch {
          points = answer
            .split("\n")
            .filter((l) => l.trim().match(/^[-•*\d]/))
            .map((l) => l.replace(/^[-•*\d.]+\s*/, "").trim())
            .filter(Boolean);
        }

        setPreps((prev) =>
          prev.map((p) =>
            p.event.id === eventId
              ? { ...p, talkingPoints: points, loadingAi: false }
              : p,
          ),
        );
      } catch {
        toast.error("Erreur IA");
        setPreps((prev) =>
          prev.map((p) =>
            p.event.id === eventId ? { ...p, loadingAi: false } : p,
          ),
        );
      }
    },
    [preps],
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!preps.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
          <Calendar className="w-10 h-10" />
          <p>Aucune réunion dans les prochaines 24h</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {preps.length} réunion{preps.length > 1 ? "s" : ""} dans les prochaines
        24h
      </p>
      {preps.map((prep) => (
        <MeetingPrepCard
          key={prep.event.id}
          prep={prep}
          onGenerateAi={handleGenerateAi}
        />
      ))}
    </div>
  );
}
