"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePageTitle } from "@/hooks/use-page-title";
import { AppLayout } from "@/components/layout/app-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Video,
  ArrowRight,
  Plus,
  Clock,
  Users,
  Circle,
  Calendar as CalendarIcon,
  Loader2,
  CalendarClock,
  DoorOpen,
  Sparkles,
  Download,
  Radio,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { meetApi, Room, MeetingHistory, Recording } from "@/lib/api/meet";
import { calendarApi } from "@/lib/api/calendar";
import type { Event as CalendarEvent } from "@/types/calendar";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDuration(seconds?: number): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (m > 0) return `${m} min`;
  return `${seconds}s`;
}

function fmtDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtRelative(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "À l'instant";
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
}

/** Recording + the room it belongs to, useful for dashboard listing. */
type RecordingWithRoom = Recording & { room_name: string; room_code: string };

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function MeetPage() {
  usePageTitle("Réunions");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [history, setHistory] = useState<MeetingHistory[]>([]);
  const [recordings, setRecordings] = useState<RecordingWithRoom[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingRecordings, setLoadingRecordings] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const [joinCode, setJoinCode] = useState("");
  const [startingInstant, setStartingInstant] = useState(false);
  const [joiningCode, setJoiningCode] = useState(false);

  // Load rooms
  const loadRooms = useCallback(async (): Promise<Room[]> => {
    setLoadingRooms(true);
    try {
      const res = await meetApi.listRooms();
      setRooms(res.data);
      return res.data;
    } catch {
      // silently fail — dashboard still usable
      setRooms([]);
      return [];
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await meetApi.listHistory();
      // Filter to last 7 days
      const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
      const recent = res.data.filter(
        (h) => new Date(h.started_at).getTime() >= sevenDaysAgo,
      );
      setHistory(recent);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const loadRecordings = useCallback(async (roomList: Room[]) => {
    setLoadingRecordings(true);
    try {
      if (roomList.length === 0) {
        setRecordings([]);
        return;
      }
      const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
      // Aggregate in parallel across the user's rooms, filter to last 7d.
      const lists = await Promise.all(
        roomList.map((room) =>
          meetApi.recordings
            .listByRoom(room.id)
            .then((res) =>
              res.data.map<RecordingWithRoom>((r) => ({
                ...r,
                room_name: room.name,
                room_code: room.room_code,
              })),
            )
            .catch(() => [] as RecordingWithRoom[]),
        ),
      );
      const flat = lists.flat();
      const recent = flat.filter(
        (r) => new Date(r.started_at).getTime() >= sevenDaysAgo,
      );
      recent.sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
      );
      setRecordings(recent.slice(0, 20));
    } catch {
      setRecordings([]);
    } finally {
      setLoadingRecordings(false);
    }
  }, []);

  const loadUpcomingEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 14);
      // Try to list from the default calendar. If not available, degrade gracefully.
      const calRes = await calendarApi.get<{ id: string }[]>("/calendars");
      const cals = calRes.data;
      if (!cals || cals.length === 0) {
        setUpcomingEvents([]);
        return;
      }
      const lists = await Promise.all(
        cals.slice(0, 5).map((c) =>
          calendarApi
            .listEvents(c.id, start, end)
            .then((r) => r.data)
            .catch(() => [] as CalendarEvent[]),
        ),
      );
      const all = lists.flat();
      // Keep only events that have a meet room association
      const withMeet = all.filter((e) => {
        const anyE = e as unknown as { has_meet_room?: boolean; meet_room_code?: string };
        return anyE.has_meet_room === true || Boolean(anyE.meet_room_code);
      });
      withMeet.sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      );
      setUpcomingEvents(withMeet.slice(0, 5));
    } catch {
      setUpcomingEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    loadRooms().then((roomList) => {
      loadRecordings(roomList);
    });
    loadHistory();
    loadUpcomingEvents();
  }, [loadRooms, loadHistory, loadRecordings, loadUpcomingEvents]);

  // Support legacy ?room=XXX autoload
  useEffect(() => {
    const roomQuery = searchParams.get("room");
    if (roomQuery) setJoinCode(roomQuery);
  }, [searchParams]);

  // ── Actions ────────────────────────────────────────────────────────────

  const startInstantMeeting = async () => {
    setStartingInstant(true);
    try {
      const res = await meetApi.createInstantRoom();
      const code = res.data.code;
      toast.success("Salle créée");
      router.push(`/meet/${code}/lobby`);
    } catch {
      toast.error(
        "Impossible de créer un appel instantané. Le service Meet est peut-être indisponible.",
      );
    } finally {
      setStartingInstant(false);
    }
  };

  const joinWithCode = async () => {
    const code = joinCode.trim();
    if (!code) return;
    setJoiningCode(true);
    try {
      // Check lobby presence first (non-blocking — on error we still navigate)
      await meetApi.getLobby(code).catch(() => null);
      router.push(`/meet/${encodeURIComponent(code)}/lobby`);
    } catch {
      toast.error("Code invalide ou salle introuvable");
    } finally {
      setJoiningCode(false);
    }
  };

  const openRoom = (code: string) => {
    router.push(`/meet/${encodeURIComponent(code)}/lobby`);
  };

  // ── Derived ────────────────────────────────────────────────────────────

  const permanentRooms = rooms.filter((r) => {
    const settings = r.settings as { permanent?: boolean } | undefined;
    return settings?.permanent === true || r.scheduled_start === undefined;
  });

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-6xl flex flex-col gap-8 p-6 lg:p-8">
        {/* Hero */}
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Réunions vidéo
          </h1>
          <p className="text-muted-foreground">
            Lance un appel instantané ou rejoins une salle
          </p>
        </header>

        {/* Hero cards — instant + join */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Start instant */}
          <div className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Video className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Démarrer un appel instantané
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Génère une salle et partage le lien avec ton équipe.
                </p>
              </div>
            </div>
            <div className="mt-6">
              <Button
                size="lg"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 gap-2"
                onClick={startInstantMeeting}
                disabled={startingInstant}
              >
                {startingInstant ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
                {startingInstant ? "Création..." : "Démarrer maintenant"}
              </Button>
            </div>
          </div>

          {/* Join by code */}
          <div className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-foreground">
                <DoorOpen className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Rejoindre avec un code
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Saisis le code de salle pour rejoindre le lobby.
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <Input
                placeholder="Ex: abc-defg-hij"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") joinWithCode();
                }}
                className="h-12 bg-background"
              />
              <Button
                variant="outline"
                size="lg"
                className="h-12 border-border text-foreground hover:bg-muted/50 gap-2"
                onClick={joinWithCode}
                disabled={!joinCode.trim() || joiningCode}
              >
                {joiningCode ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Rejoindre
              </Button>
            </div>
          </div>
        </section>

        {/* Upcoming agenda */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                À venir (agenda)
              </h2>
            </div>
          </div>
          {loadingEvents ? (
            <UpcomingSkeleton />
          ) : upcomingEvents.length === 0 ? (
            <EmptyCard
              icon={CalendarIcon}
              title="Aucune réunion planifiée"
              description="Les événements du calendrier avec une salle Meet apparaîtront ici."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {upcomingEvents.map((ev) => {
                const anyE = ev as unknown as { meet_room_code?: string };
                const code = anyE.meet_room_code;
                return (
                  <button
                    key={ev.id}
                    onClick={() => code && openRoom(code)}
                    className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/30"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                      <CalendarIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {ev.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDateTime(ev.start_time)} · {fmtTime(ev.end_time)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-border text-foreground hover:bg-muted/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (code) openRoom(code);
                      }}
                      disabled={!code}
                    >
                      Rejoindre
                    </Button>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Permanent rooms */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Mes salles permanentes
              </h2>
            </div>
          </div>
          {loadingRooms ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-28 rounded-lg" />
              ))}
            </div>
          ) : permanentRooms.length === 0 ? (
            <EmptyCard
              icon={Users}
              title="Tu n'as pas encore de salle permanente"
              description="Crée une salle réutilisable pour tes standups ou réunions récurrentes."
              actionLabel="Créer ma première salle"
              onAction={startInstantMeeting}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {permanentRooms.map((room) => {
                const active = room.status === "active";
                const count = room.participant_count ?? 0;
                return (
                  <div
                    key={room.id}
                    className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:bg-muted/20"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-semibold text-foreground">
                          {room.name}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {room.room_code}
                        </div>
                      </div>
                      {active && (
                        <Badge
                          variant="outline"
                          className="border-border bg-primary/10 text-primary gap-1"
                        >
                          <Circle className="h-2 w-2 fill-current" />
                          En cours
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {count} {count > 1 ? "participants" : "participant"}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => openRoom(room.room_code)}
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        Rejoindre
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent (7 days) — meeting history */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Récentes (7 jours)
              </h2>
            </div>
          </div>
          {loadingHistory ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <EmptyCard
              icon={Clock}
              title="Aucune réunion récente"
              description="Les réunions terminées au cours des 7 derniers jours apparaîtront ici."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
                    <Video className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {h.room_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fmtRelative(h.started_at)} · {fmtDuration(h.duration_seconds)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className="border-border text-foreground gap-1"
                    >
                      <Users className="h-3 w-3" />
                      {h.participant_count}
                    </Badge>
                    {h.had_recording && (
                      <Badge
                        variant="outline"
                        className="border-border bg-muted/50 text-foreground gap-1"
                      >
                        <Circle className="h-2 w-2 fill-destructive text-destructive" />
                        Enregistrée
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recordings (7 days) */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Enregistrements (7 jours)
              </h2>
            </div>
          </div>
          {loadingRecordings ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : recordings.length === 0 ? (
            <EmptyCard
              icon={Radio}
              title="Aucun enregistrement récent"
              description="Les enregistrements de tes réunions apparaîtront ici une fois arrêtés."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {recordings.map((r) => (
                <RecordingRow key={r.id} recording={r} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function EmptyCard({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/10 px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-sm font-medium text-foreground">{title}</div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {description}
          </p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button
          size="sm"
          onClick={onAction}
          className="mt-1 gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

function UpcomingSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-14 rounded-lg" />
      ))}
    </div>
  );
}

function RecordingRow({ recording }: { recording: RecordingWithRoom }) {
  const statusLabel =
    recording.status === "recording"
      ? "En cours"
      : recording.status === "processing"
        ? "Traitement"
        : recording.status === "ready"
          ? "Prêt"
          : "Échec";
  const statusClass =
    recording.status === "recording"
      ? "bg-destructive/10 text-destructive border-destructive/40"
      : recording.status === "ready"
        ? "bg-primary/10 text-primary border-primary/40"
        : recording.status === "failed"
          ? "bg-destructive/10 text-destructive border-destructive/40"
          : "bg-muted text-muted-foreground border-border";

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
        <Radio className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">
          {recording.room_name}
        </div>
        <div className="text-xs text-muted-foreground">
          {fmtDateTime(recording.started_at)} ·{" "}
          {fmtDuration(recording.duration_seconds)}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge
          variant="outline"
          className={`gap-1 ${statusClass}`}
        >
          {statusLabel}
        </Badge>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled
                className="border-border text-foreground gap-1"
              >
                <Download className="h-3.5 w-3.5" />
                Télécharger
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Téléchargement disponible après intégration du stockage
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
