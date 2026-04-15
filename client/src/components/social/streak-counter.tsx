"use client";

import { useMemo, useEffect } from "react";
import { Flame } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSocialStore } from "@/stores/social-store";
import { startOfDay, subDays, isSameDay, parseISO } from "date-fns";

function computeStreak(publishedDates: Date[]): number {
  if (publishedDates.length === 0) return 0;

  // Get unique days that have at least one published post
  const uniqueDays = new Set<string>();
  for (const date of publishedDates) {
    uniqueDays.add(startOfDay(date).toISOString());
  }

  // Count consecutive days backwards from today
  let streak = 0;
  const today = startOfDay(new Date());

  // Check today first
  if (uniqueDays.has(today.toISOString())) {
    streak = 1;
  } else {
    // If nothing published today, check if yesterday had a post (streak still alive)
    const yesterday = startOfDay(subDays(today, 1));
    if (!uniqueDays.has(yesterday.toISOString())) {
      return 0;
    }
    // Start counting from yesterday
    streak = 1;
    let checkDate = subDays(yesterday, 1);
    while (uniqueDays.has(startOfDay(checkDate).toISOString())) {
      streak++;
      checkDate = subDays(checkDate, 1);
    }
    return streak;
  }

  // Continue counting backwards from yesterday
  let checkDate = subDays(today, 1);
  while (uniqueDays.has(startOfDay(checkDate).toISOString())) {
    streak++;
    checkDate = subDays(checkDate, 1);
  }

  return streak;
}

export function StreakCounter() {
  const { posts, fetchPosts } = useSocialStore();

  useEffect(() => {
    if (posts.length === 0) {
      fetchPosts();
    }
  }, [posts.length, fetchPosts]);

  const streak = useMemo(() => {
    const publishedDates = posts
      .filter((p) => p.status === "published" && p.publishedAt)
      .map((p) => parseISO(p.publishedAt!));

    return computeStreak(publishedDates);
  }, [posts]);

  const isGold = streak > 7;
  const isActive = streak > 0;

  const flameColorClass = isGold
    ? "text-yellow-400"
    : isActive
      ? "text-orange-500"
      : "text-muted-foreground";

  const tooltipText = isActive
    ? `You've posted for ${streak} consecutive day${streak !== 1 ? "s" : ""}!`
    : "Start your streak!";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 border cursor-default select-none">
            <Flame
              className={`h-5 w-5 ${flameColorClass} ${
                isActive ? "animate-pulse" : ""
              } ${isGold ? "drop-shadow-[0_0_4px_rgba(250,204,21,0.5)]" : ""}`}
              fill={isActive ? "currentColor" : "none"}
            />
            <span
              className={`text-sm font-bold tabular-nums ${
                isGold
                  ? "text-yellow-500"
                  : isActive
                    ? "text-foreground"
                    : "text-muted-foreground"
              }`}
            >
              {streak}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
