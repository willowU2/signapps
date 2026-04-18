"use client";

/**
 * Lazy wrapper around `@livekit/components-react`. The LiveKit bundle is
 * heavy and only needed on `/meet/*` routes — this wrapper ensures the
 * container components ship as a separate chunk, loaded on demand.
 *
 * Only React components can be wrapped with `next/dynamic`. Hooks
 * (`useTracks`, `useLocalParticipant`, ...) still need to be imported
 * directly from `@livekit/components-react` by consumers that need
 * imperative access — they will share the same chunk as the first
 * dynamic component that resolves.
 */

import dynamic from "next/dynamic";
import { MeetingRoomSkeleton } from "@/components/common/lazy-skeleton";

export const LiveKitRoom = dynamic(
  () => import("@livekit/components-react").then((m) => m.LiveKitRoom),
  { ssr: false, loading: () => <MeetingRoomSkeleton /> },
);

export const VideoConference = dynamic(
  () => import("@livekit/components-react").then((m) => m.VideoConference),
  { ssr: false, loading: () => <MeetingRoomSkeleton /> },
);

export const RoomAudioRenderer = dynamic(
  () => import("@livekit/components-react").then((m) => m.RoomAudioRenderer),
  { ssr: false },
);

export const ControlBar = dynamic(
  () => import("@livekit/components-react").then((m) => m.ControlBar),
  { ssr: false },
);
