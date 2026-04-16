"use client";

import { lazy, Suspense, useMemo, useState } from "react";
import { useParticipants } from "@livekit/components-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
} from "lucide-react";

// Lazy placeholders — Polls/Q&A wired in Phase 3c follow-up commits
const ChatPanel = lazy(() =>
  Promise.resolve({ default: () => <Placeholder label="Chat" /> }),
);
const PollsPanel = lazy(() =>
  Promise.resolve({ default: () => <Placeholder label="Polls" /> }),
);
const QAPanel = lazy(() =>
  Promise.resolve({ default: () => <Placeholder label="Q&A" /> }),
);
const WhiteboardPanel = lazy(() =>
  Promise.resolve({ default: () => <Placeholder label="Whiteboard" /> }),
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
  isHost,
  raisedSet,
  onLowerOther,
}: MeetSidebarProps) {
  const participants = useParticipants();

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
              <PollsPanel />
            </TabsContent>
            <TabsContent value="qa" className="m-0">
              <QAPanel />
            </TabsContent>
            <TabsContent value="whiteboard" className="m-0">
              <WhiteboardPanel />
            </TabsContent>
          </Suspense>
        </div>
      </Tabs>
    </aside>
  );
}
