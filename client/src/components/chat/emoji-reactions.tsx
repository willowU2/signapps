"use client";

import { useState } from "react";

interface Reaction {
  emoji: string;
  users: string[];
}

interface EmojiReactionsProps {
  reactions: Reaction[];
  currentUser: string;
  onReact: (emoji: string) => void;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🎉"];

export function EmojiReactions({
  reactions,
  currentUser,
  onReact,
}: EmojiReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {reactions
        .filter((r) => r.users.length > 0)
        .map((r) => {
          const isMine = r.users.includes(currentUser);
          return (
            <button
              key={r.emoji}
              onClick={() => onReact(r.emoji)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                isMine
                  ? "bg-primary/10 border-primary/30"
                  : "bg-muted/50 border-transparent hover:border-muted-foreground/20"
              }`}
            >
              <span>{r.emoji}</span>
              <span className="font-medium">{r.users.length}</span>
            </button>
          );
        })}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="w-6 h-6 rounded-full bg-muted/50 hover:bg-muted text-xs flex items-center justify-center transition-colors"
        >
          +
        </button>
        {showPicker && (
          <div className="absolute bottom-full left-0 mb-1 flex gap-0.5 bg-popover border rounded-lg shadow-lg p-1.5 z-50">
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => {
                  onReact(e);
                  setShowPicker(false);
                }}
                className="w-7 h-7 rounded hover:bg-accent flex items-center justify-center text-base transition-colors"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
