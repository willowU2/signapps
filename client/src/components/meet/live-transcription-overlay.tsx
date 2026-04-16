'use client';

// Phase 3b: Real-time transcription overlay.
// Subscribes to the "transcription" LiveKit data-channel topic, hydrates
// on mount from `GET /meet/rooms/:code/transcription/history`, and renders
// the last few captions with a 10-second fade-out. A floating overlay
// sitting on top of the video grid — the semi-transparent black/white
// styling is intentional (tokens like `bg-card`/`text-foreground` would
// be unreadable over video; plan explicitly allows this exception).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent, type RemoteParticipant } from 'livekit-client';
import { Download, Subtitles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    meetApi,
    type TranscriptionChunk,
    type TranscriptionExportFormat,
} from '@/lib/api/meet';

/** Max number of captions kept in memory / rendered simultaneously. */
const MAX_CAPTIONS = 6;
/** How long a caption stays visible after its `timestamp_ms`. */
const FADE_OUT_MS = 10_000;
/** LiveKit data-channel topic used to broadcast transcription chunks. */
export const TRANSCRIPTION_TOPIC = 'transcription';

export interface RenderedCaption extends TranscriptionChunk {
    /** Synthetic unique key for React lists. */
    key: string;
    /** Human-readable display name (falls back to identity). */
    displayName: string;
}

interface LiveTranscriptionOverlayProps {
    /** Room code — used to hydrate history and to build the export URL. */
    roomCode: string;
    /** Whether the overlay is rendered. Parent controls this toggle. */
    visible: boolean;
    className?: string;
}

export function LiveTranscriptionOverlay({
    roomCode,
    visible,
    className,
}: LiveTranscriptionOverlayProps) {
    const room = useRoomContext();
    const [captions, setCaptions] = useState<RenderedCaption[]>([]);
    const [, forceTick] = useState(0);
    const hydratedRef = useRef(false);

    // ── Helpers ────────────────────────────────────────────────────────────

    const identityToName = useCallback(
        (identity: string): string => {
            if (!room) return identity;
            if (room.localParticipant?.identity === identity) {
                return room.localParticipant.name || identity;
            }
            const remote = room.remoteParticipants?.get(identity);
            return remote?.name || identity;
        },
        [room],
    );

    const pushCaption = useCallback(
        (chunk: TranscriptionChunk) => {
            const key = `${chunk.speaker_identity}-${chunk.timestamp_ms}-${Math.random()
                .toString(36)
                .slice(2, 8)}`;
            const displayName = identityToName(chunk.speaker_identity);
            setCaptions((prev) =>
                [...prev, { ...chunk, key, displayName }].slice(-MAX_CAPTIONS),
            );
        },
        [identityToName],
    );

    // ── 1. Hydrate history on open ────────────────────────────────────────

    useEffect(() => {
        if (!visible || !roomCode || hydratedRef.current) return;
        hydratedRef.current = true;
        meetApi.transcription
            .history(roomCode, MAX_CAPTIONS)
            .then((res) => {
                // Only keep the tail — recent entries.
                const recent = res.data.slice(-MAX_CAPTIONS);
                setCaptions(
                    recent.map((e) => ({
                        speaker_identity: e.speaker_identity,
                        text: e.text,
                        timestamp_ms: e.timestamp_ms,
                        language: e.language,
                        key: e.id,
                        displayName: identityToName(e.speaker_identity),
                    })),
                );
            })
            .catch(() => {
                // Silent — the overlay keeps working from the live stream only.
            });
    }, [visible, roomCode, identityToName]);

    // ── 2. Subscribe to the LiveKit data-channel topic ───────────────────

    useEffect(() => {
        if (!room) return;
        const decoder = new TextDecoder();
        const onData = (
            payload: Uint8Array,
            participant?: RemoteParticipant,
            _kind?: unknown,
            topic?: string,
        ) => {
            if (topic !== TRANSCRIPTION_TOPIC) return;
            try {
                const json = JSON.parse(decoder.decode(payload)) as TranscriptionChunk;
                // The broadcaster already posted its own chunk through
                // `ingest`, but other peers might broadcast without
                // ingesting (e.g. a guest). Trust the payload for the
                // overlay and keep the persistence server-side.
                if (!json.text || !json.speaker_identity) return;
                // Skip echoes from ourselves — we've already rendered them
                // when we broadcast. `participant` is undefined for local.
                if (participant && participant.identity === room.localParticipant?.identity) {
                    return;
                }
                pushCaption(json);
            } catch {
                // Bad payload — ignore.
            }
        };
        room.on(RoomEvent.DataReceived, onData);
        return () => {
            room.off(RoomEvent.DataReceived, onData);
        };
    }, [room, pushCaption]);

    // ── 3. Fade-out ticker ───────────────────────────────────────────────

    useEffect(() => {
        if (!visible) return;
        const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
        return () => window.clearInterval(id);
    }, [visible]);

    // Drop captions older than FADE_OUT_MS so the DOM stays small.
    useEffect(() => {
        if (captions.length === 0) return;
        const now = Date.now();
        const oldest = captions[0];
        if (now - oldest.timestamp_ms > FADE_OUT_MS + 2000) {
            setCaptions((prev) =>
                prev.filter((c) => now - c.timestamp_ms <= FADE_OUT_MS + 2000),
            );
        }
    }, [captions]);

    const exportHref = useMemo(
        () => (format: TranscriptionExportFormat) =>
            meetApi.transcription.exportUrl(roomCode, format),
        [roomCode],
    );

    if (!visible) return null;

    const now = Date.now();

    return (
        <div
            data-testid="live-transcription-overlay"
            className={cn(
                'pointer-events-none absolute inset-x-0 bottom-24 z-30 flex flex-col items-center gap-1 px-4',
                className,
            )}
        >
            <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur-sm">
                <Subtitles className="h-3.5 w-3.5" aria-hidden />
                <span>Transcription live</span>
                <a
                    href={exportHref('txt')}
                    download
                    className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10"
                    title="Télécharger (TXT)"
                    aria-label="Télécharger la transcription au format texte"
                >
                    <Download className="h-3 w-3" />
                </a>
            </div>
            <div className="flex max-w-3xl flex-col items-center gap-1">
                {captions.map((c) => {
                    const age = now - c.timestamp_ms;
                    const opacity = Math.max(
                        0,
                        Math.min(1, 1 - (age - (FADE_OUT_MS - 2000)) / 2000),
                    );
                    return (
                        <div
                            key={c.key}
                            className="rounded-lg bg-black/60 px-3 py-1.5 text-center text-sm text-white shadow-lg backdrop-blur-sm"
                            style={{ opacity }}
                        >
                            <span className="font-semibold">{c.displayName}</span>
                            <span className="mx-1 text-white/60">·</span>
                            <span>{c.text}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
