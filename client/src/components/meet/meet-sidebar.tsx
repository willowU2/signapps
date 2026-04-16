"use client";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useParticipants,
  useRoomContext,
} from "@livekit/components-react";
import { RoomEvent, type RemoteParticipant } from "livekit-client";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Users,
  Vote,
  HelpCircle,
  Presentation,
  X,
  MicOff,
  VideoOff,
  Hand,
  Lock,
  Plus,
  Trash2,
  Trophy,
  ArrowUp,
  Send,
} from "lucide-react";

import { meetApi } from "@/lib/api/meet";
import type { MeetPoll, MeetQuestion } from "@/lib/api/meet";

/** LiveKit data channel topic — polls create/vote/close broadcasts. */
export const POLL_TOPIC = "poll";
/** LiveKit data channel topic — Q&A ask/upvote/answer/delete broadcasts. */
export const QA_TOPIC = "qa";

interface PollBroadcast {
  type: "created" | "voted" | "closed";
  poll_id?: string;
}

interface QaBroadcast {
  type: "asked" | "upvoted" | "answered" | "deleted";
  question_id?: string;
}

// Lazy placeholders — Chat is still a stub; Whiteboard is wired to
// tldraw + Yjs. Lazy-loading keeps the tldraw bundle out of the
// critical path when participants never open the tab.
const ChatPanel = lazy(() =>
  Promise.resolve({ default: () => <Placeholder label="Chat" /> }),
);
const WhiteboardPanel = lazy(() =>
  import("./meet-whiteboard").then((m) => ({ default: m.MeetWhiteboard })),
);

function Placeholder({ label }: { label: string }) {
  return (
    <div className="p-6 text-center text-sm text-muted-foreground">
      {label} — bientôt disponible
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Participants tab (with host raised-hands panel)
// ─────────────────────────────────────────────────────────────────────────────

function ParticipantsTab({
  raisedSet,
  isHost,
  onLowerOther,
}: {
  raisedSet: Set<string>;
  isHost: boolean;
  onLowerOther: (identity: string) => Promise<void>;
}) {
  const participants = useParticipants();
  const identityToParticipant = useMemo(() => {
    const m = new Map<string, { name?: string; identity: string }>();
    for (const p of participants) {
      m.set(p.identity, { name: p.name, identity: p.identity });
    }
    return m;
  }, [participants]);

  const raisedList = Array.from(raisedSet);
  const [busy, setBusy] = useState<string | null>(null);

  const handleLower = async (identity: string) => {
    setBusy(identity);
    try {
      await onLowerOther(identity);
      toast.success("Main baissée");
    } catch {
      toast.error("Action impossible");
    } finally {
      setBusy(null);
    }
  };

  if (participants.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Aucun participant connecté
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Host-only raised hands panel */}
      {isHost && raisedList.length > 0 && (
        <section
          data-testid="raised-hands-panel"
          className="rounded-lg border border-border bg-card p-3 shadow-sm"
        >
          <header className="flex items-center justify-between gap-2 pb-2">
            <div className="flex items-center gap-2">
              <Hand className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                Mains levées
              </span>
              <Badge variant="outline" className="border-border">
                {raisedList.length}
              </Badge>
            </div>
          </header>
          <ul className="flex flex-col divide-y divide-border">
            {raisedList.map((identity) => {
              const info = identityToParticipant.get(identity);
              const name = info?.name || identity;
              return (
                <li
                  key={identity}
                  className="flex items-center gap-2 py-2 first:pt-0 last:pb-0"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-[11px]">
                      {initials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-foreground">
                      {name}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleLower(identity)}
                    disabled={busy === identity}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Baisser
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Participants list */}
      <div className="flex flex-col gap-1">
        {participants.map((p) => {
          const micOff = !p.isMicrophoneEnabled;
          const camOff = !p.isCameraEnabled;
          const name = p.name || p.identity || "Anonyme";
          const handRaised = raisedSet.has(p.identity);
          return (
            <div
              key={p.sid}
              className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/40"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">
                  {name}
                  {p.isLocal && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      (vous)
                    </span>
                  )}
                </div>
                {p.isSpeaking && (
                  <div className="text-xs text-primary">parle…</div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {handRaised && (
                  <Hand
                    className="h-3.5 w-3.5 text-primary"
                    aria-label="main levée"
                  />
                )}
                {micOff && (
                  <MicOff
                    className="h-3.5 w-3.5 text-destructive"
                    aria-label="micro coupé"
                  />
                )}
                {camOff && (
                  <VideoOff
                    className="h-3.5 w-3.5 text-muted-foreground"
                    aria-label="caméra coupée"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Polls tab
// ─────────────────────────────────────────────────────────────────────────────

function CreatePollDialog({
  roomCode,
  onCreated,
}: {
  roomCode: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  const canAdd = options.length < 6;

  const reset = () => {
    setQuestion("");
    setOptions(["", ""]);
  };

  const submit = async () => {
    const trimmedQuestion = question.trim();
    const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!trimmedQuestion) {
      toast.error("La question ne peut pas être vide");
      return;
    }
    if (trimmedOptions.length < 2) {
      toast.error("Au moins 2 options sont requises");
      return;
    }
    setSubmitting(true);
    try {
      await meetApi.polls.create(roomCode, {
        question: trimmedQuestion,
        options: trimmedOptions,
      });
      toast.success("Sondage créé");
      setOpen(false);
      reset();
      onCreated();
    } catch {
      toast.error("Création impossible");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Créer un sondage
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Nouveau sondage</DialogTitle>
          <DialogDescription>
            2 à 6 options maximum. Les résultats s&apos;actualisent en
            direct.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Question</span>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex: Quand se retrouve-t-on ?"
              maxLength={200}
            />
          </label>
          <div className="flex flex-col gap-2">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={opt}
                  onChange={(e) => {
                    const next = [...options];
                    next[idx] = e.target.value;
                    setOptions(next);
                  }}
                  placeholder={`Option ${idx + 1}`}
                  maxLength={120}
                />
                {options.length > 2 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setOptions(options.filter((_, i) => i !== idx))
                    }
                    aria-label="Supprimer l'option"
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {canAdd && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOptions([...options, ""])}
                className="gap-1.5 self-start"
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter une option
              </Button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Création…" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PollCard({
  poll,
  localIdentity,
  isHost,
  onMutated,
}: {
  poll: MeetPoll;
  localIdentity: string;
  isHost: boolean;
  onMutated: () => void;
}) {
  const closed = !!poll.closed_at;
  const options: string[] = Array.isArray(poll.options)
    ? (poll.options as string[])
    : [];
  const votes = poll.votes || {};
  const voteValues = Object.values(votes);
  const totalVotes = voteValues.length;
  const counts = options.map(
    (_, idx) => voteValues.filter((v) => Number(v) === idx).length,
  );
  const myVote =
    localIdentity && localIdentity in votes
      ? Number(votes[localIdentity])
      : -1;
  const [voting, setVoting] = useState(false);

  const handleVote = async (idx: number) => {
    if (closed || voting) return;
    setVoting(true);
    try {
      await meetApi.polls.vote(poll.id, { option_index: idx });
      onMutated();
    } catch {
      toast.error("Vote impossible");
    } finally {
      setVoting(false);
    }
  };

  const handleClose = async () => {
    if (!confirm("Clôturer ce sondage ? Cette action est définitive.")) return;
    try {
      await meetApi.polls.close(poll.id);
      toast.success("Sondage clôturé");
      onMutated();
    } catch {
      toast.error("Clôture impossible");
    }
  };

  const maxCount = Math.max(1, ...counts);
  const winnerIdx = closed
    ? counts.findIndex((c) => c === maxCount && c > 0)
    : -1;

  return (
    <article
      className={`rounded-lg border bg-card p-3 shadow-sm ${
        closed ? "opacity-80" : ""
      } border-border`}
      data-testid="poll-card"
    >
      <header className="flex items-start justify-between gap-2 pb-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-foreground">
            {poll.question}
          </h4>
          <p className="text-[11px] text-muted-foreground">
            {totalVotes} vote{totalVotes > 1 ? "s" : ""}
            {closed && <> · clôturé</>}
          </p>
        </div>
        {closed && (
          <Badge variant="outline" className="border-border gap-1">
            <Lock className="h-3 w-3" />
            <span className="text-[11px]">clos</span>
          </Badge>
        )}
      </header>
      <ul className="flex flex-col gap-1.5">
        {options.map((opt, idx) => {
          const pct = totalVotes
            ? Math.round((counts[idx] / totalVotes) * 100)
            : 0;
          const selected = myVote === idx;
          const isWinner = winnerIdx === idx;
          return (
            <li key={idx}>
              <button
                type="button"
                disabled={closed || voting}
                onClick={() => handleVote(idx)}
                className={`relative block w-full overflow-hidden rounded-md border px-3 py-1.5 text-left text-xs transition-colors ${
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:bg-muted/40"
                } ${closed ? "cursor-default" : "cursor-pointer"}`}
                aria-pressed={selected}
              >
                <span
                  className={`absolute inset-y-0 left-0 -z-0 ${
                    selected ? "bg-primary/15" : "bg-muted"
                  }`}
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
                <span className="relative z-10 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0 truncate font-medium text-foreground">
                    {isWinner && (
                      <Trophy
                        className="h-3 w-3 text-primary shrink-0"
                        aria-label="gagnant"
                      />
                    )}
                    <span className="truncate">{opt}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    {counts[idx]} · {pct}%
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {isHost && !closed && (
        <footer className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClose}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            Clôturer
          </Button>
        </footer>
      )}
    </article>
  );
}

function PollsTab({
  roomCode,
  isHost,
  localIdentity,
}: {
  roomCode: string;
  isHost: boolean;
  localIdentity: string;
}) {
  const room = useRoomContext();
  const [polls, setPolls] = useState<MeetPoll[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await meetApi.polls.list(roomCode);
      setPolls(res.data);
    } catch {
      // keep previous state
    } finally {
      setLoading(false);
    }
  }, [roomCode]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!room) return;
    const decoder = new TextDecoder();
    const onData = (
      payload: Uint8Array,
      _participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic !== POLL_TOPIC) return;
      try {
        const json = JSON.parse(decoder.decode(payload)) as PollBroadcast;
        if (json?.type) refresh();
      } catch {
        // ignore
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, refresh]);

  const broadcastRefresh = useCallback(
    async (payload: PollBroadcast) => {
      if (!room?.localParticipant) return;
      try {
        const encoder = new TextEncoder();
        await room.localParticipant.publishData(
          encoder.encode(JSON.stringify(payload)),
          { reliable: true, topic: POLL_TOPIC },
        );
      } catch {
        // non-fatal
      }
    },
    [room],
  );

  const handleMutated = useCallback(() => {
    refresh();
    void broadcastRefresh({ type: "voted" });
  }, [broadcastRefresh, refresh]);

  const handleCreated = useCallback(() => {
    refresh();
    void broadcastRefresh({ type: "created" });
  }, [broadcastRefresh, refresh]);

  const open = polls.filter((p) => !p.closed_at);
  const closed = polls.filter((p) => !!p.closed_at);

  return (
    <div className="flex flex-col gap-3 p-3">
      {isHost && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Hôte
          </span>
          <CreatePollDialog roomCode={roomCode} onCreated={handleCreated} />
        </div>
      )}
      {loading && polls.length === 0 && (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Chargement…
        </div>
      )}
      {!loading && polls.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Aucun sondage pour l&apos;instant
          {isHost && <div className="text-[11px]">Lancez-en un ci-dessus.</div>}
        </div>
      )}
      {open.map((p) => (
        <PollCard
          key={p.id}
          poll={p}
          localIdentity={localIdentity}
          isHost={isHost}
          onMutated={handleMutated}
        />
      ))}
      {closed.length > 0 && (
        <div className="flex flex-col gap-2 pt-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Clôturés
          </span>
          {closed.map((p) => (
            <PollCard
              key={p.id}
              poll={p}
              localIdentity={localIdentity}
              isHost={isHost}
              onMutated={handleMutated}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Q&A tab
// ─────────────────────────────────────────────────────────────────────────────

function AnswerDialog({
  question,
  onAnswered,
}: {
  question: MeetQuestion;
  onAnswered: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState(question.answer ?? "");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const trimmed = answer.trim();
    if (!trimmed) {
      toast.error("La réponse ne peut pas être vide");
      return;
    }
    setSubmitting(true);
    try {
      await meetApi.questions.answer(question.id, { answer: trimmed });
      toast.success("Réponse publiée");
      setOpen(false);
      onAnswered();
    } catch {
      toast.error("Impossible de répondre");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
        >
          {question.answer ? "Modifier la réponse" : "Répondre"}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Répondre à la question</DialogTitle>
          <DialogDescription>
            <span className="text-foreground">{question.question}</span>
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Votre réponse"
          rows={4}
          className="resize-none"
        />
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Envoi…" : "Publier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QaCard({
  question,
  isHost,
  localIdentity,
  upvoted,
  onUpvote,
  onDelete,
  onMutated,
}: {
  question: MeetQuestion;
  isHost: boolean;
  localIdentity: string;
  upvoted: boolean;
  onUpvote: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMutated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const mine = question.asked_by === localIdentity;
  const canDelete = isHost || mine;

  const handleUpvote = async () => {
    if (upvoted || busy) return;
    setBusy(true);
    try {
      await onUpvote(question.id);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer cette question ?")) return;
    setBusy(true);
    try {
      await onDelete(question.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      data-testid="qa-card"
      className="flex gap-2 rounded-lg border border-border bg-card p-3 shadow-sm"
    >
      <button
        type="button"
        onClick={handleUpvote}
        disabled={upvoted || busy}
        aria-pressed={upvoted}
        className={`flex shrink-0 flex-col items-center justify-center gap-0 rounded-md px-2 py-1 text-xs ${
          upvoted
            ? "bg-primary/15 text-primary"
            : "bg-muted text-foreground hover:bg-muted/70"
        } ${upvoted || busy ? "cursor-default" : "cursor-pointer"}`}
        aria-label={upvoted ? "Déjà voté" : "Voter"}
      >
        <ArrowUp className="h-3.5 w-3.5" />
        <span className="font-semibold">{question.upvotes}</span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{question.question}</p>
        {question.answer && (
          <div className="mt-1.5 rounded-md bg-muted/40 p-2 text-xs text-foreground">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              Réponse
            </span>
            <p>{question.answer}</p>
          </div>
        )}
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="truncate">
            {mine ? "vous" : question.asked_by}
          </span>
          <span>·</span>
          <span>
            {new Date(question.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {isHost && (
              <AnswerDialog question={question} onAnswered={onMutated} />
            )}
            {canDelete && (
              <Button
                size="icon"
                variant="ghost"
                onClick={handleDelete}
                disabled={busy}
                aria-label="Supprimer"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function QaTab({
  roomCode,
  isHost,
  localIdentity,
}: {
  roomCode: string;
  isHost: boolean;
  localIdentity: string;
}) {
  const room = useRoomContext();
  const [questions, setQuestions] = useState<MeetQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const upvotedRef = useRef<Set<string>>(new Set());
  const [, forceTick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await meetApi.questions.list(roomCode);
      setQuestions(res.data);
    } catch {
      // keep previous
    } finally {
      setLoading(false);
    }
  }, [roomCode]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!room) return;
    const decoder = new TextDecoder();
    const onData = (
      payload: Uint8Array,
      _p?: RemoteParticipant,
      _k?: unknown,
      topic?: string,
    ) => {
      if (topic !== QA_TOPIC) return;
      try {
        const json = JSON.parse(decoder.decode(payload)) as QaBroadcast;
        if (json?.type) refresh();
      } catch {
        // ignore
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, refresh]);

  const broadcast = useCallback(
    async (payload: QaBroadcast) => {
      if (!room?.localParticipant) return;
      try {
        const encoder = new TextEncoder();
        await room.localParticipant.publishData(
          encoder.encode(JSON.stringify(payload)),
          { reliable: true, topic: QA_TOPIC },
        );
      } catch {
        // non-fatal
      }
    },
    [room],
  );

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await meetApi.questions.ask(roomCode, { question: trimmed });
      setText("");
      await refresh();
      void broadcast({ type: "asked" });
    } catch {
      toast.error("Envoi impossible");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpvote = useCallback(
    async (id: string) => {
      if (upvotedRef.current.has(id)) return;
      upvotedRef.current.add(id);
      forceTick((n) => n + 1);
      try {
        await meetApi.questions.upvote(id);
        await refresh();
        void broadcast({ type: "upvoted", question_id: id });
      } catch {
        upvotedRef.current.delete(id);
        forceTick((n) => n + 1);
        toast.error("Vote impossible");
      }
    },
    [broadcast, refresh],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await meetApi.questions.delete(id);
        await refresh();
        void broadcast({ type: "deleted", question_id: id });
      } catch {
        toast.error("Suppression impossible");
      }
    },
    [broadcast, refresh],
  );

  // Sort: unanswered first, answered below; within each group by upvotes DESC, created ASC.
  const sorted = useMemo(() => {
    const byRank = (a: MeetQuestion, b: MeetQuestion) => {
      if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
      return a.created_at.localeCompare(b.created_at);
    };
    const unanswered = questions.filter((q) => !q.answer).sort(byRank);
    const answered = questions.filter((q) => !!q.answer).sort(byRank);
    return { unanswered, answered };
  }, [questions]);

  return (
    <div className="flex h-full flex-col">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-b border-border bg-card p-3"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Poser une question…"
          maxLength={500}
          disabled={submitting}
        />
        <Button
          type="submit"
          size="icon"
          disabled={submitting || !text.trim()}
          aria-label="Envoyer la question"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
      <div className="flex-1 overflow-y-auto p-3">
        {loading && questions.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Chargement…
          </div>
        )}
        {!loading && questions.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Aucune question pour l&apos;instant
          </div>
        )}
        {sorted.unanswered.length > 0 && (
          <div className="flex flex-col gap-2">
            {sorted.unanswered.map((q) => (
              <QaCard
                key={q.id}
                question={q}
                isHost={isHost}
                localIdentity={localIdentity}
                upvoted={upvotedRef.current.has(q.id)}
                onUpvote={handleUpvote}
                onDelete={handleDelete}
                onMutated={refresh}
              />
            ))}
          </div>
        )}
        {sorted.answered.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Répondues
            </span>
            {sorted.answered.map((q) => (
              <QaCard
                key={q.id}
                question={q}
                isHost={isHost}
                localIdentity={localIdentity}
                upvoted={upvotedRef.current.has(q.id)}
                onUpvote={handleUpvote}
                onDelete={handleDelete}
                onMutated={refresh}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface MeetSidebarProps {
  onClose: () => void;
  defaultTab?: string;
  roomCode: string;
  isHost: boolean;
  raisedSet: Set<string>;
  onLowerOther: (identity: string) => Promise<void>;
}

export function MeetSidebar({
  onClose,
  defaultTab = "participants",
  roomCode,
  isHost,
  raisedSet,
  onLowerOther,
}: MeetSidebarProps) {
  const participants = useParticipants();
  const room = useRoomContext();
  const localIdentity = room?.localParticipant?.identity ?? "";

  return (
    <aside className="w-full md:w-[360px] shrink-0 bg-card border-l border-border flex flex-col h-full">
      <div className="flex items-center justify-between h-12 px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Panneau</h3>
          <Badge variant="outline" className="border-border gap-1">
            <Users className="h-3 w-3" />
            {participants.length}
          </Badge>
          {raisedSet.size > 0 && (
            <Badge className="bg-primary/15 text-primary gap-1">
              <Hand className="h-3 w-3" />
              {raisedSet.size}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Fermer le panneau"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs
        defaultValue={defaultTab}
        className="flex-1 min-h-0 flex flex-col gap-0"
      >
        <TabsList
          variant="line"
          className="w-full justify-start rounded-none border-b border-border bg-transparent px-2 h-11 shrink-0"
        >
          <TabsTrigger value="chat" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Chat</span>
          </TabsTrigger>
          <TabsTrigger value="participants" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Participants</span>
          </TabsTrigger>
          <TabsTrigger value="polls" className="gap-1.5">
            <Vote className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Polls</span>
          </TabsTrigger>
          <TabsTrigger value="qa" className="gap-1.5">
            <HelpCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Q&A</span>
          </TabsTrigger>
          <TabsTrigger value="whiteboard" className="gap-1.5">
            <Presentation className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tableau</span>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <Suspense fallback={<Placeholder label="Chargement" />}>
            <TabsContent value="chat" className="m-0">
              <ChatPanel />
            </TabsContent>
            <TabsContent value="participants" className="m-0">
              <ParticipantsTab
                raisedSet={raisedSet}
                isHost={isHost}
                onLowerOther={onLowerOther}
              />
            </TabsContent>
            <TabsContent value="polls" className="m-0">
              <PollsTab
                roomCode={roomCode}
                isHost={isHost}
                localIdentity={localIdentity}
              />
            </TabsContent>
            <TabsContent value="qa" className="m-0 h-full">
              <QaTab
                roomCode={roomCode}
                isHost={isHost}
                localIdentity={localIdentity}
              />
            </TabsContent>
            <TabsContent
              value="whiteboard"
              className="m-0 h-[70vh] md:h-[600px]"
            >
              <WhiteboardPanel roomCode={roomCode} />
            </TabsContent>
          </Suspense>
        </div>
      </Tabs>
    </aside>
  );
}
