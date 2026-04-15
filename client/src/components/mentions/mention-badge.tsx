"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface MentionBadgeProps {
  username: string;
  displayName?: string;
  avatarUrl?: string;
  userId?: string;
  onClick?: (userId: string) => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function MentionBadge({
  username,
  displayName,
  avatarUrl,
  userId,
  onClick,
  className,
}: MentionBadgeProps) {
  const handleClick = () => {
    if (userId && onClick) {
      onClick(userId);
    }
  };

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md",
            "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
            "hover:bg-blue-200 dark:hover:bg-blue-900/50",
            "font-medium text-sm transition-colors cursor-pointer",
            className,
          )}
          onClick={handleClick}
        >
          <span>@{username}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-64" align="start">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback>
              {(displayName || username).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm truncate">
              {displayName || username}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              @{username}
            </span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * Parses text content and replaces @username patterns with MentionBadge components.
 * Returns an array of React nodes.
 */
export function parseMentions(
  text: string,
  onMentionClick?: (userId: string) => void,
): React.ReactNode[] {
  const mentionRegex = /@(\w+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Add the mention badge
    parts.push(
      <MentionBadge
        key={`mention-${match.index}`}
        username={match[1]}
        onClick={onMentionClick}
      />,
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export default MentionBadge;
