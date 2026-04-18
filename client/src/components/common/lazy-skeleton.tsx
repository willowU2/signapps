"use client";

/**
 * Skeletons shown while heavy client components (Tiptap, Monaco, LiveKit,
 * MediaPipe) finish loading. All visually consistent with the existing
 * shadcn/ui `<Skeleton />` primitive.
 */

import { Skeleton } from "@/components/ui/skeleton";

export function EditorSkeleton() {
  return (
    <div
      className="flex flex-col gap-3 p-4"
      aria-busy="true"
      aria-label="Chargement de l'éditeur"
    >
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function MeetingRoomSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-4 p-4"
      aria-busy="true"
      aria-label="Connexion à la salle de réunion"
    >
      <Skeleton className="aspect-video" />
      <Skeleton className="aspect-video" />
      <Skeleton className="aspect-video" />
      <Skeleton className="aspect-video" />
    </div>
  );
}

export function MonacoSkeleton() {
  return (
    <div
      className="h-full w-full"
      aria-busy="true"
      aria-label="Chargement de l'éditeur de code"
    >
      <Skeleton className="h-full w-full" />
    </div>
  );
}
