'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, CalendarDays, LayoutGrid } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  addWeeks,
  subWeeks,
} from 'date-fns';
import { useSocialStore } from '@/stores/social-store';
import { SocialPost } from '@/lib/api/social';
import { PLATFORM_COLORS } from './platform-utils';
import type { SocialAccount } from '@/lib/api/social';

type ViewMode = 'month' | 'week';

function getPlatformColor(platform: SocialAccount['platform'] | undefined) {
  if (!platform) return '#6b7280';
  return PLATFORM_COLORS[platform] ?? '#6b7280';
}

interface DayPostsProps {
  posts: (SocialPost & { platform?: SocialAccount['platform'] })[];
  onSelect: (post: SocialPost) => void;
}

function DayPosts({ posts, onSelect }: DayPostsProps) {
  const visible = posts.slice(0, 3);
  const hidden = posts.length - 3;
  return (
    <div className="space-y-0.5 mt-1">
      {visible.map((post) => (
        <button
          key={post.id}
          onClick={(e) => { e.stopPropagation(); onSelect(post); }}
          className="w-full text-left"
        >
          <div
            className="w-full h-1.5 rounded-full opacity-80 hover:opacity-100 transition-opacity"
            style={{ backgroundColor: getPlatformColor(post.platform) }}
            title={post.content.slice(0, 60)}
          />
        </button>
      ))}
      {hidden > 0 && <p className="text-xs text-muted-foreground">+{hidden} more</p>}
    </div>
  );
}

export function SocialCalendar() {
  const { posts, accounts, fetchPosts } = useSocialStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    fetchPosts({ status: 'scheduled' });
  }, [fetchPosts]);

  const getAccountPlatform = useCallback(
    (post: SocialPost): SocialAccount['platform'] | undefined => {
      const account = accounts.find((a) => post.accounts.includes(a.id));
      return account?.platform;
    },
    [accounts]
  );

  const enrichedPosts = posts
    .filter((p) => p.status === 'scheduled' && p.scheduledAt)
    .map((p) => ({ ...p, platform: getAccountPlatform(p) }));

  const getPostsForDay = (day: Date) =>
    enrichedPosts.filter((p) => isSameDay(parseISO(p.scheduledAt!), day));

  const getPostsForDayRaw = (day: Date) =>
    posts.filter((p) => p.status === 'scheduled' && p.scheduledAt && isSameDay(parseISO(p.scheduledAt), day));

  // Month grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let d = gridStart;
  while (d <= gridEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  // Week grid
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const handlePrev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(subWeeks(currentDate, 1));
  };
  const handleNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addWeeks(currentDate, 1));
  };

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[160px] text-center">
            {viewMode === 'month'
              ? format(currentDate, 'MMMM yyyy')
              : `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`}
          </h2>
          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
        </div>
        <div className="flex gap-1">
          <Button
            variant={viewMode === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('month')}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />Month
          </Button>
          <Button
            variant={viewMode === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('week')}
          >
            <CalendarDays className="h-4 w-4 mr-1" />Week
          </Button>
        </div>
      </div>

      {/* Platform Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(PLATFORM_COLORS).map(([platform, color]) => (
          <div key={platform} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-muted-foreground capitalize">{platform}</span>
          </div>
        ))}
      </div>

      {/* Month View */}
      {viewMode === 'month' && (
        <div className="border rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 bg-muted">
            {dayNames.map((name) => (
              <div key={name} className="p-2 text-center text-xs font-semibold text-muted-foreground">
                {name}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const dayPosts = getPostsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              return (
                <div
                  key={i}
                  onClick={() => setSelectedDay(isSameDay(day, selectedDay ?? new Date(0)) ? null : day)}
                  className={`min-h-[80px] p-2 border-b border-r cursor-pointer transition-colors ${
                    !isCurrentMonth ? 'bg-muted/30 text-muted-foreground' : ''
                  } ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1 ${
                      isToday(day)
                        ? 'bg-primary text-primary-foreground'
                        : ''
                    }`}
                  >
                    {format(day, 'd')}
                  </div>
                  <DayPosts posts={dayPosts} onSelect={setSelectedPost} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="border rounded-xl overflow-hidden">
          <div className="grid grid-cols-7">
            {weekDays.map((day) => {
              const dayPosts = getPostsForDay(day);
              return (
                <div
                  key={day.toISOString()}
                  className={`border-r last:border-r-0 p-3 min-h-[200px] ${isToday(day) ? 'bg-primary/5' : ''}`}
                >
                  <div className="text-center mb-2">
                    <p className="text-xs text-muted-foreground">{format(day, 'EEE')}</p>
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold mx-auto ${
                        isToday(day) ? 'bg-primary text-primary-foreground' : ''
                      }`}
                    >
                      {format(day, 'd')}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {dayPosts.map((post) => (
                      <button
                        key={post.id}
                        onClick={() => setSelectedPost(post)}
                        className="w-full text-left p-1.5 rounded text-xs hover:opacity-80 text-white"
                        style={{ backgroundColor: getPlatformColor(post.platform) }}
                      >
                        <p className="font-medium">{post.scheduledAt ? format(parseISO(post.scheduledAt), 'HH:mm') : ''}</p>
                        <p className="truncate opacity-90">{post.content.slice(0, 30)}…</p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Day Panel */}
      {selectedDay && viewMode === 'month' && (
        <div className="border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold">{format(selectedDay, 'EEEE, MMMM d')}</h3>
          {getPostsForDayRaw(selectedDay).length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts scheduled for this day.</p>
          ) : (
            getPostsForDayRaw(selectedDay).map((post) => {
              const account = accounts.find((a) => post.accounts.includes(a.id));
              return (
                <div key={post.id} className="flex items-start gap-3 p-2 rounded-lg border">
                  <div
                    className="w-2 h-full min-h-[40px] rounded-full"
                    style={{ backgroundColor: account ? getPlatformColor(account.platform) : '#6b7280' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{post.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {account && (
                        <Badge variant="outline" className="text-xs capitalize">{account.platform}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {post.scheduledAt ? format(parseISO(post.scheduledAt), 'HH:mm') : ''}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Post Detail */}
      {selectedPost && (
        <div className="border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Post Detail</h3>
            <Button variant="ghost" size="sm" onClick={() => setSelectedPost(null)}>Close</Button>
          </div>
          <p className="text-sm">{selectedPost.content}</p>
          <div className="flex items-center gap-2">
            <Badge>{selectedPost.status}</Badge>
            {selectedPost.scheduledAt && (
              <span className="text-xs text-muted-foreground">
                Scheduled: {format(parseISO(selectedPost.scheduledAt), 'PPP p')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
