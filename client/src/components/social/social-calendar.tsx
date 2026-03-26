'use client';

import { useEffect, useState, useCallback, useMemo, DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LayoutGrid,
  Calendar,
  List,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Clock,
  Plus,
  Repeat,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  setHours,
  setMinutes,
  getHours,
} from 'date-fns';
import { useSocialStore } from '@/stores/social-store';
import { SocialPost } from '@/lib/api/social';
import { PLATFORM_COLORS, ALL_PLATFORMS } from './platform-utils';
import { ChannelSidebar } from './channel-sidebar';
import type { SocialAccount } from '@/lib/api/social';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = 'month' | 'week' | 'day' | 'list';

type EnrichedPost = SocialPost & { platform?: SocialAccount['platform'] };

const VIEW_STORAGE_KEY = 'social-calendar-view';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPlatformColor(platform: SocialAccount['platform'] | undefined) {
  if (!platform) return '#6b7280';
  return PLATFORM_COLORS[platform] ?? '#6b7280';
}

function getStatusVariant(status: SocialPost['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'published': return 'default';
    case 'scheduled': return 'secondary';
    case 'failed': return 'destructive';
    default: return 'outline';
  }
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Hour slots for the day view: 6am to 11pm
const DAY_HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

const LIST_PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Drag & Drop data helpers
// ---------------------------------------------------------------------------

function setDragData(e: DragEvent, postId: string) {
  e.dataTransfer.setData('text/plain', postId);
  e.dataTransfer.effectAllowed = 'move';
}

function getDragData(e: DragEvent): string {
  return e.dataTransfer.getData('text/plain');
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface DraggablePostCardProps {
  post: EnrichedPost;
  onSelect: (post: SocialPost) => void;
  variant: 'dot' | 'compact' | 'full';
}

function DraggablePostCard({ post, onSelect, variant }: DraggablePostCardProps) {
  const handleDragStart = (e: DragEvent<HTMLButtonElement>) => {
    setDragData(e, post.id);
    e.currentTarget.style.opacity = '0.4';
  };
  const handleDragEnd = (e: DragEvent<HTMLButtonElement>) => {
    e.currentTarget.style.opacity = '1';
  };

  if (variant === 'dot') {
    return (
      <button
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={(e) => { e.stopPropagation(); onSelect(post); }}
        className="w-full text-left group"
      >
        <div className="flex items-center gap-1">
          <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          <div
            className="flex-1 h-1.5 rounded-full opacity-80 hover:opacity-100 transition-opacity"
            style={{ backgroundColor: getPlatformColor(post.platform) }}
            title={`${post.content.slice(0, 60)}${post.repeatInterval && post.repeatInterval > 0 ? ` (repeats every ${post.repeatInterval}d)` : ''}`}
          />
          {post.repeatInterval && post.repeatInterval > 0 && (
            <Repeat className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
          )}
        </div>
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={(e) => { e.stopPropagation(); onSelect(post); }}
        className="w-full text-left p-1.5 rounded text-xs hover:opacity-80 text-white group flex items-center gap-1"
        style={{ backgroundColor: getPlatformColor(post.platform) }}
      >
        <GripVertical className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium flex items-center gap-1">
            {post.scheduledAt ? format(parseISO(post.scheduledAt), 'HH:mm') : ''}
            {post.repeatInterval && post.repeatInterval > 0 && (
              <Repeat className="h-2.5 w-2.5 opacity-80" />
            )}
          </p>
          <p className="truncate opacity-90">{post.content.slice(0, 30)}</p>
        </div>
      </button>
    );
  }

  // variant === 'full'
  return (
    <button
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={(e) => { e.stopPropagation(); onSelect(post); }}
      className="w-full text-left p-2 rounded-lg border hover:shadow-sm transition-shadow group flex items-start gap-2"
    >
      <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-grab" />
      <div
        className="w-1 min-h-[36px] rounded-full shrink-0"
        style={{ backgroundColor: getPlatformColor(post.platform) }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate flex items-center gap-1.5">
          {post.content.slice(0, 50)}
          {post.repeatInterval && post.repeatInterval > 0 && (
            <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {post.scheduledAt ? format(parseISO(post.scheduledAt), 'HH:mm') : '--:--'}
          </span>
          {post.platform && (
            <span className="text-xs text-muted-foreground capitalize">{post.platform}</span>
          )}
          {post.repeatInterval && post.repeatInterval > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Repeat className="h-2.5 w-2.5" />
              {post.repeatInterval}d
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

interface MonthDayPostsProps {
  posts: EnrichedPost[];
  onSelect: (post: SocialPost) => void;
}

function MonthDayPosts({ posts, onSelect }: MonthDayPostsProps) {
  const visible = posts.slice(0, 3);
  const hidden = posts.length - 3;
  return (
    <div className="space-y-0.5 mt-1">
      {visible.map((post) => (
        <DraggablePostCard key={post.id} post={post} onSelect={onSelect} variant="dot" />
      ))}
      {hidden > 0 && <p className="text-xs text-muted-foreground">+{hidden} more</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SocialCalendar() {
  const { posts, accounts, fetchPosts, schedulePost, deletePost, createPost } = useSocialStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === 'month' || stored === 'week' || stored === 'day' || stored === 'list') {
        return stored;
      }
    }
    return 'month';
  });
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Channel filter state
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const handleChannelSelection = useCallback((ids: string[]) => {
    setSelectedChannelIds(ids);
  }, []);

  // Drag state
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  // Confirm reschedule dialog for published posts
  const [rescheduleConfirm, setRescheduleConfirm] = useState<{
    postId: string;
    newDate: string;
  } | null>(null);

  // List view state
  const [listPage, setListPage] = useState(0);
  const [listPlatformFilter, setListPlatformFilter] = useState<string>('all');
  const [listStatusFilter, setListStatusFilter] = useState<string>('all');
  const [listSortAsc, setListSortAsc] = useState(true);

  useEffect(() => {
    fetchPosts({ status: 'scheduled' });
  }, [fetchPosts]);

  // Persist view mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    }
  }, [viewMode]);

  // Reset list page when filters change
  useEffect(() => {
    setListPage(0);
  }, [listPlatformFilter, listStatusFilter, listSortAsc]);

  const getAccountPlatform = useCallback(
    (post: SocialPost): SocialAccount['platform'] | undefined => {
      const account = accounts.find((a) => post.accounts.includes(a.id));
      return account?.platform;
    },
    [accounts]
  );

  const channelFilteredPosts = useMemo(
    () =>
      selectedChannelIds.length > 0
        ? posts.filter((p) => p.accounts.some((aid) => selectedChannelIds.includes(aid)))
        : posts,
    [posts, selectedChannelIds]
  );

  const enrichedPosts = useMemo(
    () =>
      channelFilteredPosts
        .filter((p) => p.scheduledAt)
        .map((p) => ({ ...p, platform: getAccountPlatform(p) })),
    [channelFilteredPosts, getAccountPlatform]
  );

  const scheduledEnriched = useMemo(
    () => enrichedPosts.filter((p) => p.status === 'scheduled'),
    [enrichedPosts]
  );

  const getPostsForDay = useCallback(
    (day: Date) => scheduledEnriched.filter((p) => isSameDay(parseISO(p.scheduledAt!), day)),
    [scheduledEnriched]
  );

  const getPostsForDayRaw = useCallback(
    (day: Date) =>
      channelFilteredPosts.filter(
        (p) => p.status === 'scheduled' && p.scheduledAt && isSameDay(parseISO(p.scheduledAt), day)
      ),
    [channelFilteredPosts]
  );

  const getPostsForHour = useCallback(
    (day: Date, hour: number) =>
      scheduledEnriched.filter((p) => {
        const d = parseISO(p.scheduledAt!);
        return isSameDay(d, day) && getHours(d) === hour;
      }),
    [scheduledEnriched]
  );

  // ----- Navigation -----

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const monthDays: Date[] = useMemo(() => {
    const result: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) {
      result.push(d);
      d = addDays(d, 1);
    }
    return result;
  }, [gridStart, gridEnd]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const handlePrev = () => {
    switch (viewMode) {
      case 'month': setCurrentDate(subMonths(currentDate, 1)); break;
      case 'week': setCurrentDate(subWeeks(currentDate, 1)); break;
      case 'day': setCurrentDate(addDays(currentDate, -1)); break;
      case 'list': setCurrentDate(subMonths(currentDate, 1)); break;
    }
  };

  const handleNext = () => {
    switch (viewMode) {
      case 'month': setCurrentDate(addMonths(currentDate, 1)); break;
      case 'week': setCurrentDate(addWeeks(currentDate, 1)); break;
      case 'day': setCurrentDate(addDays(currentDate, 1)); break;
      case 'list': setCurrentDate(addMonths(currentDate, 1)); break;
    }
  };

  const headerLabel = useMemo(() => {
    switch (viewMode) {
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      case 'week':
        return `${format(weekStart, 'MMM d')} \u2013 ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`;
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      case 'list':
        return format(currentDate, 'MMMM yyyy');
    }
  }, [viewMode, currentDate, weekStart]);

  // ----- Drag & Drop handlers -----

  const handleDragOverSlot = (e: DragEvent<HTMLDivElement>, slotId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget(slotId);
  };

  const handleDragLeaveSlot = () => {
    setDragOverTarget(null);
  };

  const handleDropOnDate = async (e: DragEvent<HTMLDivElement>, targetDate: Date) => {
    e.preventDefault();
    setDragOverTarget(null);
    const postId = getDragData(e);
    if (!postId) return;

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    // Keep the original time, change the date
    let newDateTime: Date;
    if (post.scheduledAt) {
      const original = parseISO(post.scheduledAt);
      newDateTime = setMinutes(
        setHours(startOfDay(targetDate), getHours(original)),
        original.getMinutes()
      );
    } else {
      newDateTime = setHours(startOfDay(targetDate), 9); // default 9am
    }

    const newDateStr = newDateTime.toISOString();

    if (post.status === 'published') {
      setRescheduleConfirm({ postId, newDate: newDateStr });
      return;
    }

    await schedulePost(postId, newDateStr);
  };

  const handleDropOnHour = async (e: DragEvent<HTMLDivElement>, targetDate: Date, hour: number) => {
    e.preventDefault();
    setDragOverTarget(null);
    const postId = getDragData(e);
    if (!postId) return;

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const newDateTime = setHours(startOfDay(targetDate), hour);
    const newDateStr = newDateTime.toISOString();

    if (post.status === 'published') {
      setRescheduleConfirm({ postId, newDate: newDateStr });
      return;
    }

    await schedulePost(postId, newDateStr);
  };

  const confirmReschedule = async () => {
    if (!rescheduleConfirm) return;
    await schedulePost(rescheduleConfirm.postId, rescheduleConfirm.newDate);
    setRescheduleConfirm(null);
  };

  // ----- List view data -----

  const listFilteredPosts = useMemo(() => {
    let filtered = enrichedPosts;

    if (listPlatformFilter !== 'all') {
      filtered = filtered.filter((p) => p.platform === listPlatformFilter);
    }
    if (listStatusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === listStatusFilter);
    }

    filtered.sort((a, b) => {
      const dateA = a.scheduledAt ? parseISO(a.scheduledAt).getTime() : 0;
      const dateB = b.scheduledAt ? parseISO(b.scheduledAt).getTime() : 0;
      return listSortAsc ? dateA - dateB : dateB - dateA;
    });

    return filtered;
  }, [enrichedPosts, listPlatformFilter, listStatusFilter, listSortAsc]);

  const listTotalPages = Math.max(1, Math.ceil(listFilteredPosts.length / LIST_PAGE_SIZE));
  const listPagePosts = listFilteredPosts.slice(
    listPage * LIST_PAGE_SIZE,
    (listPage + 1) * LIST_PAGE_SIZE
  );

  // ----- Actions -----

  const handleDuplicatePost = async (post: SocialPost) => {
    await createPost({
      content: post.content,
      accounts: post.accounts,
      mediaUrls: post.mediaUrls,
      hashtags: post.hashtags,
      status: 'draft',
    });
  };

  const handleDeletePost = async (postId: string) => {
    await deletePost(postId);
    if (selectedPost?.id === postId) setSelectedPost(null);
  };

  const handleCreatePostAtTime = (date: Date, hour: number) => {
    const targetTime = setHours(startOfDay(date), hour);
    // Open a post creation flow - for now we create a draft post
    createPost({
      content: '',
      accounts: [],
      status: 'draft',
      scheduledAt: targetTime.toISOString(),
    });
  };

  // ----- View Switcher -----

  const viewButtons: { mode: ViewMode; label: string; icon: typeof Calendar }[] = [
    { mode: 'month', label: 'Month', icon: LayoutGrid },
    { mode: 'week', label: 'Week', icon: CalendarDays },
    { mode: 'day', label: 'Day', icon: Calendar },
    { mode: 'list', label: 'List', icon: List },
  ];

  return (
    <div className="flex h-full">
      <ChannelSidebar
        selectedAccountIds={selectedChannelIds}
        onSelectionChange={handleChannelSelection}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[200px] text-center">{headerLabel}</h2>
          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
        </div>

        {/* View Switcher - segmented control */}
        <div className="flex rounded-lg border bg-muted p-0.5">
          {viewButtons.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === mode
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
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

      {/* ============================================================ */}
      {/* MONTH VIEW                                                    */}
      {/* ============================================================ */}
      {viewMode === 'month' && (
        <div className="border rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 bg-muted">
            {DAY_NAMES.map((name) => (
              <div key={name} className="p-2 text-center text-xs font-semibold text-muted-foreground">
                {name}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day, i) => {
              const dayPosts = getPostsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const slotId = `month-${format(day, 'yyyy-MM-dd')}`;
              const isDragOver = dragOverTarget === slotId;

              return (
                <div
                  key={i}
                  onClick={() =>
                    setSelectedDay(
                      isSameDay(day, selectedDay ?? new Date(0)) ? null : day
                    )
                  }
                  onDragOver={(e) => handleDragOverSlot(e, slotId)}
                  onDragLeave={handleDragLeaveSlot}
                  onDrop={(e) => handleDropOnDate(e, day)}
                  className={`min-h-[80px] p-2 border-b border-r cursor-pointer transition-colors ${
                    !isCurrentMonth ? 'bg-muted/30 text-muted-foreground' : ''
                  } ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'} ${
                    isDragOver ? 'bg-primary/10 ring-2 ring-primary/30 ring-inset' : ''
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1 ${
                      isToday(day) ? 'bg-primary text-primary-foreground' : ''
                    }`}
                  >
                    {format(day, 'd')}
                  </div>
                  <MonthDayPosts posts={dayPosts} onSelect={setSelectedPost} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* WEEK VIEW                                                     */}
      {/* ============================================================ */}
      {viewMode === 'week' && (
        <div className="border rounded-xl overflow-hidden">
          <div className="grid grid-cols-7">
            {weekDays.map((day) => {
              const dayPosts = getPostsForDay(day);
              const slotId = `week-${format(day, 'yyyy-MM-dd')}`;
              const isDragOver = dragOverTarget === slotId;

              return (
                <div
                  key={day.toISOString()}
                  onDragOver={(e) => handleDragOverSlot(e, slotId)}
                  onDragLeave={handleDragLeaveSlot}
                  onDrop={(e) => handleDropOnDate(e, day)}
                  className={`border-r last:border-r-0 p-3 min-h-[200px] ${
                    isToday(day) ? 'bg-primary/5' : ''
                  } ${isDragOver ? 'bg-primary/10 ring-2 ring-primary/30 ring-inset' : ''}`}
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
                      <DraggablePostCard
                        key={post.id}
                        post={post}
                        onSelect={setSelectedPost}
                        variant="compact"
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* DAY VIEW                                                      */}
      {/* ============================================================ */}
      {viewMode === 'day' && (
        <div className="border rounded-xl overflow-hidden">
          <div className="divide-y">
            {DAY_HOURS.map((hour) => {
              const hourPosts = getPostsForHour(currentDate, hour);
              const slotId = `day-${format(currentDate, 'yyyy-MM-dd')}-${hour}`;
              const isDragOver = dragOverTarget === slotId;
              const timeLabel = format(setHours(new Date(), hour), 'h a');

              return (
                <div
                  key={hour}
                  onDragOver={(e) => handleDragOverSlot(e, slotId)}
                  onDragLeave={handleDragLeaveSlot}
                  onDrop={(e) => handleDropOnHour(e, currentDate, hour)}
                  className={`flex min-h-[56px] transition-colors ${
                    isDragOver ? 'bg-primary/10 ring-2 ring-primary/30 ring-inset' : ''
                  }`}
                >
                  {/* Time gutter */}
                  <div className="w-20 shrink-0 p-2 text-right border-r">
                    <span className="text-xs font-medium text-muted-foreground">{timeLabel}</span>
                  </div>

                  {/* Slot content */}
                  <div className="flex-1 p-2 relative group">
                    {hourPosts.length > 0 ? (
                      <div className="space-y-1">
                        {hourPosts.map((post) => (
                          <DraggablePostCard
                            key={post.id}
                            post={post}
                            onSelect={setSelectedPost}
                            variant="full"
                          />
                        ))}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleCreatePostAtTime(currentDate, hour)}
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        <span className="text-xs">New post</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* LIST VIEW                                                     */}
      {/* ============================================================ */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={listPlatformFilter} onValueChange={setListPlatformFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All platforms</SelectItem>
                {ALL_PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={listStatusFilter} onValueChange={setListStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setListSortAsc(!listSortAsc)}
            >
              Date {listSortAsc ? '\u2191' : '\u2193'}
            </Button>

            <span className="text-xs text-muted-foreground ml-auto">
              {listFilteredPosts.length} post{listFilteredPosts.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table-like list */}
          <div className="border rounded-xl overflow-hidden divide-y">
            {/* Header row */}
            <div className="grid grid-cols-[180px_60px_1fr_100px_120px] gap-2 px-4 py-2 bg-muted text-xs font-semibold text-muted-foreground">
              <div>Date / Time</div>
              <div>Platform</div>
              <div>Content</div>
              <div>Status</div>
              <div className="text-right">Actions</div>
            </div>

            {listPagePosts.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                No posts match your filters.
              </div>
            ) : (
              listPagePosts.map((post) => {
                const account = accounts.find((a) => post.accounts.includes(a.id));
                return (
                  <div
                    key={post.id}
                    draggable
                    onDragStart={(e) => setDragData(e as unknown as DragEvent, post.id)}
                    className="grid grid-cols-[180px_60px_1fr_100px_120px] gap-2 px-4 py-3 items-center hover:bg-muted/50 transition-colors group"
                  >
                    {/* Date */}
                    <div className="text-sm">
                      {post.scheduledAt ? (
                        <>
                          <span className="font-medium">{format(parseISO(post.scheduledAt), 'MMM d, yyyy')}</span>
                          <span className="text-muted-foreground ml-1">
                            {format(parseISO(post.scheduledAt), 'HH:mm')}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No date</span>
                      )}
                    </div>

                    {/* Platform */}
                    <div className="flex items-center gap-1">
                      {post.platform ? (
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ backgroundColor: getPlatformColor(post.platform) }}
                          title={post.platform}
                        >
                          {post.platform.charAt(0).toUpperCase()}
                        </div>
                      ) : account ? (
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ backgroundColor: getPlatformColor(account.platform) }}
                          title={account.platform}
                        >
                          {account.platform.charAt(0).toUpperCase()}
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-muted" />
                      )}
                    </div>

                    {/* Content */}
                    <p className="text-sm truncate">{post.content || '(empty draft)'}</p>

                    {/* Status */}
                    <Badge variant={getStatusVariant(post.status)} className="w-fit text-xs capitalize">
                      {post.status}
                    </Badge>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedPost(post)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicatePost(post)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <Separator className="my-1" />
                          <DropdownMenuItem
                            onClick={() => handleDeletePost(post.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {listTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setListPage(Math.max(0, listPage - 1))}
                disabled={listPage === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {listPage + 1} of {listTotalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setListPage(Math.min(listTotalPages - 1, listPage + 1))}
                disabled={listPage >= listTotalPages - 1}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* SELECTED DAY PANEL (Month view)                               */}
      {/* ============================================================ */}
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
                    style={{
                      backgroundColor: account
                        ? getPlatformColor(account.platform)
                        : '#6b7280',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{post.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {account && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {account.platform}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {post.scheduledAt
                          ? format(parseISO(post.scheduledAt), 'HH:mm')
                          : ''}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* POST DETAIL PANEL                                             */}
      {/* ============================================================ */}
      {selectedPost && (
        <div className="border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Post Detail</h3>
            <Button variant="ghost" size="sm" onClick={() => setSelectedPost(null)}>
              Close
            </Button>
          </div>
          <p className="text-sm">{selectedPost.content}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge>{selectedPost.status}</Badge>
            {selectedPost.scheduledAt && (
              <span className="text-xs text-muted-foreground">
                Scheduled: {format(parseISO(selectedPost.scheduledAt), 'PPP p')}
              </span>
            )}
            {selectedPost.repeatInterval && selectedPost.repeatInterval > 0 && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Repeat className="h-3 w-3" />
                Every {selectedPost.repeatInterval} day{selectedPost.repeatInterval !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* RESCHEDULE CONFIRM DIALOG (published posts)                   */}
      {/* ============================================================ */}
      <AlertDialog
        open={!!rescheduleConfirm}
        onOpenChange={(open) => {
          if (!open) setRescheduleConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reschedule published post?</AlertDialogTitle>
            <AlertDialogDescription>
              This post has already been published. Rescheduling will change its scheduled date to{' '}
              <strong>
                {rescheduleConfirm
                  ? format(parseISO(rescheduleConfirm.newDate), 'PPP p')
                  : ''}
              </strong>
              . The published version will remain live.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReschedule}>
              Reschedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
