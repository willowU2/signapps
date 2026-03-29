"use client";

import { use } from "react";
import dynamic from "next/dynamic";

const PollVoteView = dynamic(
  () => import("@/components/calendar/scheduling-poll").then((m) => m.PollVoteView),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-64">Chargement...</div> }
);

interface PollPageProps {
  params: Promise<{ id: string }>;
}

export default function PollPage({ params }: PollPageProps) {
  const { id } = use(params);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary shadow-sm">
            <span className="text-sm font-bold text-primary-foreground">S</span>
          </div>
          <span className="text-sm font-semibold text-muted-foreground">SignApps Poll</span>
        </div>
      </div>
      <PollVoteView pollId={id} />
    </div>
  );
}
