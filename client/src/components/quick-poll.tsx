"use client";

import { useState } from "react";

interface QuickPollProps {
  question: string;
  options: string[];
  onVote?: (option: string) => void;
}

export function QuickPoll({ question, options, onVote }: QuickPollProps) {
  const [voted, setVoted] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    options.forEach((o) => {
      init[o] = Math.floor(Math.random() * 10);
    });
    return init;
  });

  function vote(option: string) {
    if (voted) return;
    setVoted(option);
    setVotes((v) => ({ ...v, [option]: (v[option] || 0) + 1 }));
    onVote?.(option);
  }

  const total = Object.values(votes).reduce((a, b) => a + b, 0);

  return (
    <div className="border rounded-lg p-4 space-y-3 max-w-sm">
      <p className="font-medium text-sm">{question}</p>
      <div className="space-y-2">
        {options.map((o) => {
          const pct = total > 0 ? Math.round((votes[o] / total) * 100) : 0;
          return (
            <button
              key={o}
              onClick={() => vote(o)}
              disabled={!!voted}
              className="w-full text-left relative overflow-hidden rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-default"
            >
              {voted && (
                <div
                  className="absolute inset-y-0 left-0 bg-primary/10 transition-all"
                  style={{ width: `${pct}%` }}
                />
              )}
              <span className="relative flex justify-between">
                <span>{o}</span>
                {voted && <span className="text-muted-foreground">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      {voted && <p className="text-xs text-muted-foreground">{total} votes</p>}
    </div>
  );
}
