'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { usersApi, type User } from '@/lib/api/identity';
import { timeItemsApi, type TimeItem } from '@/lib/api/scheduler';

// ============================================================================
// Types
// ============================================================================

export interface TeamMember {
  user: User;
  color: string;
  visible: boolean;
}

export interface TeamOverlayProps {
  /** Range start for fetching events */
  rangeStart: Date;
  /** Range end for fetching events */
  rangeEnd: Date;
  /** Callback when overlay events change */
  onOverlayEventsChange?: (events: Map<string, TimeItem[]>) => void;
  className?: string;
}

// ============================================================================
// Color palette for team members
// ============================================================================

const MEMBER_COLORS = [
  '#4285F4', // Blue
  '#EA4335', // Red
  '#34A853', // Green
  '#FBBC04', // Yellow
  '#FF6D01', // Orange
  '#46BDC6', // Teal
  '#7B1FA2', // Purple
  '#C2185B', // Pink
  '#00897B', // Dark teal
  '#6D4C41', // Brown
];

// ============================================================================
// Component
// ============================================================================

export function TeamOverlay({
  rangeStart,
  rangeEnd,
  onOverlayEventsChange,
  className,
}: TeamOverlayProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [overlayEvents, setOverlayEvents] = useState<Map<string, TimeItem[]>>(
    new Map()
  );

  // Load team members
  useEffect(() => {
    const loadMembers = async () => {
      try {
        const response = await usersApi.list(1, 50);
        const users = response.data?.users || response.data || [];
        const teamMembers: TeamMember[] = users.map((user: User, index: number) => ({
          user,
          color: MEMBER_COLORS[index % MEMBER_COLORS.length],
          visible: false,
        }));
        setMembers(teamMembers);
      } catch {
        // Silently fail - team overlay is optional
      }
    };

    loadMembers();
  }, []);

  // Fetch events for visible members
  const fetchMemberEvents = useCallback(async () => {
    const visibleMembers = members.filter((m) => m.visible);
    if (visibleMembers.length === 0) {
      setOverlayEvents(new Map());
      onOverlayEventsChange?.(new Map());
      return;
    }

    setIsLoading(true);
    try {
      const userIds = visibleMembers.map((m) => m.user.id);
      const response = await timeItemsApi.queryUsersEvents(
        userIds,
        rangeStart.toISOString(),
        rangeEnd.toISOString()
      );
      const items = response.data?.items || [];

      // Group events by user_id
      const grouped = new Map<string, TimeItem[]>();
      for (const item of items) {
        const existing = grouped.get(item.owner_id) || [];
        existing.push(item);
        grouped.set(item.owner_id, existing);
      }

      setOverlayEvents(grouped);
      onOverlayEventsChange?.(grouped);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [members, rangeStart, rangeEnd, onOverlayEventsChange]);

  // Refetch when visible members or date range changes
  useEffect(() => {
    fetchMemberEvents();
  }, [fetchMemberEvents]);

  const toggleMember = (userId: string) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.user.id === userId ? { ...m, visible: !m.visible } : m
      )
    );
  };

  const toggleAll = () => {
    const anyVisible = members.some((m) => m.visible);
    setMembers((prev) =>
      prev.map((m) => ({ ...m, visible: !anyVisible }))
    );
  };

  const visibleCount = members.filter((m) => m.visible).length;

  return (
    <div className={cn('border-b', className)}>
      {/* Header toggle */}
      <button
        className="flex items-center justify-between w-full py-2 px-2 hover:bg-muted dark:hover:bg-gray-800 rounded cursor-pointer group transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-[#3c4043] dark:text-foreground">
            Agendas d&apos;equipe
          </span>
          {visibleCount > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {visibleCount}
            </span>
          )}
        </div>
        {isLoading && (
          <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
      </button>

      {/* Expanded member list */}
      {isExpanded && (
        <div className="pb-2">
          {/* Toggle all */}
          {members.length > 1 && (
            <button
              className="flex items-center gap-2 w-full px-4 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={toggleAll}
            >
              {members.some((m) => m.visible) ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
              {members.some((m) => m.visible) ? 'Masquer tous' : 'Afficher tous'}
            </button>
          )}

          <ScrollArea className="max-h-[200px]">
            <div className="flex flex-col gap-0.5 px-2">
              {members.map((member) => (
                <TeamMemberItem
                  key={member.user.id}
                  member={member}
                  eventCount={overlayEvents.get(member.user.id)?.length || 0}
                  onToggle={() => toggleMember(member.user.id)}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TeamMemberItem sub-component
// ============================================================================

interface TeamMemberItemProps {
  member: TeamMember;
  eventCount: number;
  onToggle: () => void;
}

function TeamMemberItem({ member, eventCount, onToggle }: TeamMemberItemProps) {
  const { user, color, visible } = member;
  const displayName = user.display_name || user.username;

  return (
    <label className="flex items-center gap-3 py-1 cursor-pointer group rounded hover:bg-muted dark:hover:bg-gray-800 -mx-1 px-1 transition-colors">
      <div className="relative flex items-center justify-center">
        <input
          type="checkbox"
          className="peer appearance-none w-4 h-4 border-2 rounded-[3px] border-[#5f6368] checked:border-transparent checked:bg-current transition-colors"
          style={{ color }}
          checked={visible}
          onChange={onToggle}
        />
        <svg
          className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <Avatar className="h-5 w-5">
        <AvatarImage src={user.avatar_url} />
        <AvatarFallback
          className="text-[10px]"
          style={{ backgroundColor: color, color: 'white' }}
        >
          {displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <span className="text-sm text-[#3c4043] dark:text-foreground truncate leading-tight flex-1">
        {displayName}
      </span>

      {visible && eventCount > 0 && (
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {eventCount}
        </span>
      )}
    </label>
  );
}

export default TeamOverlay;
