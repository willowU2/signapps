"use client";

import { useState } from "react";
import { Heart, Zap, Smile, Lightbulb, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReactionCounts {
  like: number;
  love: number;
  celebrate: number;
  insightful: number;
  curious: number;
}

interface ReactionBarProps {
  reactions: ReactionCounts;
  onReactionToggle?: (reaction: keyof ReactionCounts) => void;
  userReaction?: keyof ReactionCounts | null;
}

const REACTIONS = [
  { key: "like", icon: Heart, label: "Like", color: "text-red-500" },
  { key: "love", icon: Heart, label: "Love", color: "text-pink-500" },
  { key: "celebrate", icon: Zap, label: "Celebrate", color: "text-yellow-500" },
  {
    key: "insightful",
    icon: Lightbulb,
    label: "Insightful",
    color: "text-blue-500",
  },
  { key: "curious", icon: HelpCircle, label: "Curious", color: "text-purple-500" },
] as const;

export function ReactionBar({
  reactions,
  onReactionToggle,
  userReaction,
}: ReactionBarProps) {
  return (
    <div className="flex gap-1 flex-wrap">
      {REACTIONS.map(({ key, icon: Icon, label, color }) => {
        const count = reactions[key as keyof ReactionCounts];
        const isActive = userReaction === key;

        return (
          <Button
            key={key}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => onReactionToggle?.(key as keyof ReactionCounts)}
            title={label}
            className={`gap-1 ${isActive ? color : ""}`}
          >
            <Icon
              className={`w-3 h-3 ${isActive ? "" : color}`}
              fill={isActive ? "currentColor" : "none"}
            />
            {count > 0 && <span className="text-xs">{count}</span>}
          </Button>
        );
      })}
    </div>
  );
}
