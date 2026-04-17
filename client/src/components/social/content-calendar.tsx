"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Columns,
  Repeat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PLATFORM_COLORS: Record<string, string> = {
  twitter: "#1DA1F2",
  facebook: "#1877F2",
  instagram: "#E4405F",
  linkedin: "#0A66C2",
  mastodon: "#6364FF",
  bluesky: "#0085FF",
};

const DAYS_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

export interface ScheduledPost {
  id: string;
  content: string;
  platform: string;
  scheduledAt: Date;
  status: "scheduled" | "published" | "failed";
  repeatInterval?: number;
}

interface ContentCalendarProps {
  posts?: ScheduledPost[];
  onNewPost?: (date: Date) => void;
  onReschedule?: (postId: string, newDate: Date) => void;
  onPostClick?: (post: ScheduledPost) => void;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const SAMPLE_POSTS: ScheduledPost[] = (() => {
  const now = new Date();
  return [
    {
      id: "sp1",
      content: "Introducing AI-powered content generation in SignApps Social!",
      platform: "twitter",
      scheduledAt: addDays(now, 1),
      status: "scheduled",
    },
    {
      id: "sp2",
      content: "How our Rust backend handles 10k req/s with zero downtime",
      platform: "linkedin",
      scheduledAt: addDays(now, 2),
      status: "scheduled",
    },
    {
      id: "sp3",
      content: "Behind the scenes: building a fully local AI platform",
      platform: "instagram",
      scheduledAt: addDays(now, 3),
      status: "scheduled",
    },
    {
      id: "sp4",
      content: "Weekly update: new features shipped this week",
      platform: "facebook",
      scheduledAt: addDays(now, -1),
      status: "published",
    },
    {
      id: "sp5",
      content: "Open source Friday: contribute to SignApps on GitHub",
      platform: "mastodon",
      scheduledAt: addDays(now, 5),
      status: "scheduled",
    },
  ];
})();

function PostPill({
  post,
  onClick,
}: {
  post: ScheduledPost;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const color = PLATFORM_COLORS[post.platform] ?? "#888";
  return (
    <button
      onClick={onClick}
      className="w-full text-left text-xs px-1.5 py-0.5 rounded truncate transition-opacity hover:opacity-80 flex items-center gap-1"
      style={{
        backgroundColor: color + "22",
        borderLeft: `2px solid ${color}`,
        color,
      }}
      title={`${post.content}${post.repeatInterval && post.repeatInterval > 0 ? ` (repeats every ${post.repeatInterval}d)` : ""}`}
    >
      {post.repeatInterval && post.repeatInterval > 0 && (
        <Repeat className="h-2.5 w-2.5 shrink-0" />
      )}
      <span className="truncate">{post.content.slice(0, 40)}</span>
    </button>
  );
}

export function ContentCalendar({
  posts = SAMPLE_POSTS,
  onNewPost,
  onReschedule,
  onPostClick,
}: ContentCalendarProps) {
  const [view, setView] = useState<"month" | "week">("month");
  const [current, setCurrent] = useState(new Date());
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Month view
  const monthDays = useMemo(() => {
    const start = startOfMonth(current);
    const firstDay = start.getDay(); // 0=Sun
    const days: Array<Date | null> = Array(firstDay).fill(null);
    const daysInMonth = new Date(
      current.getFullYear(),
      current.getMonth() + 1,
      0,
    ).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(current.getFullYear(), current.getMonth(), i));
    }
    // Pad to full weeks
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [current]);

  // Week view
  const weekDays = useMemo(() => {
    const start = startOfWeek(current);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [current]);

  const postsForDay = (date: Date) =>
    posts.filter((p) => sameDay(p.scheduledAt, date));

  const postsForSlot = (date: Date, hour: number) =>
    posts.filter(
      (p) => sameDay(p.scheduledAt, date) && p.scheduledAt.getHours() === hour,
    );

  const navigate = (dir: -1 | 1) => {
    if (view === "month") {
      setCurrent(new Date(current.getFullYear(), current.getMonth() + dir, 1));
    } else {
      setCurrent(addDays(current, dir * 7));
    }
  };

  const handleDrop = (date: Date, hour?: number) => {
    if (!draggedId) return;
    const post = posts.find((p) => p.id === draggedId);
    if (!post) return;
    const newDate = new Date(date);
    if (hour !== undefined) newDate.setHours(hour, 0, 0, 0);
    onReschedule?.(draggedId, newDate);
    setDraggedId(null);
  };

  const headerLabel =
    view === "month"
      ? current.toLocaleDateString("en", { month: "long", year: "numeric" })
      : `${weekDays[0].toLocaleDateString("en", { month: "short", day: "numeric" })} – ${weekDays[6].toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span>{headerLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <Tabs
                value={view}
                onValueChange={(v) => setView(v as "month" | "week")}
              >
                <TabsList className="h-7">
                  <TabsTrigger value="month" className="text-xs h-6 px-2">
                    <Calendar className="w-3 h-3 mr-1" /> Month
                  </TabsTrigger>
                  <TabsTrigger value="week" className="text-xs h-6 px-2">
                    <Columns className="w-3 h-3 mr-1" /> Week
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => navigate(-1)}
                aria-label="Précédent"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => navigate(1)}
                aria-label="Suivant"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {view === "month" ? (
            <div className="min-w-[500px]">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b">
                {DAYS_WEEK.map((d) => (
                  <div
                    key={d}
                    className="text-center text-xs font-medium text-muted-foreground py-2"
                  >
                    {d}
                  </div>
                ))}
              </div>
              {/* Day cells */}
              <div className="grid grid-cols-7">
                {monthDays.map((day, i) => {
                  const isToday = day && sameDay(day, new Date());
                  const dayPosts = day ? postsForDay(day) : [];
                  return (
                    <div
                      key={i}
                      className={`min-h-[80px] border-b border-r p-1 ${
                        !day
                          ? "bg-muted/20"
                          : "hover:bg-muted/30 cursor-pointer"
                      } transition-colors ${draggedId && day && dragOverDate === day.toDateString() ? "ring-2 ring-blue-400 bg-blue-50/40 dark:bg-blue-900/10" : ""}`}
                      onClick={() => day && onNewPost?.(day)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (day) setDragOverDate(day.toDateString());
                      }}
                      onDragLeave={() => setDragOverDate(null)}
                      onDrop={() => {
                        day && handleDrop(day);
                        setDragOverDate(null);
                      }}
                    >
                      {day && (
                        <>
                          <span
                            className={`text-xs inline-flex w-5 h-5 items-center justify-center rounded-full ${
                              isToday
                                ? "bg-blue-500 text-white font-bold"
                                : "text-muted-foreground"
                            }`}
                          >
                            {day.getDate()}
                          </span>
                          <div className="mt-1 space-y-0.5">
                            {dayPosts.slice(0, 2).map((p) => (
                              <div
                                key={p.id}
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  setDraggedId(p.id);
                                }}
                                onDragEnd={() => setDraggedId(null)}
                              >
                                <PostPill
                                  post={p}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPost(p);
                                    onPostClick?.(p);
                                  }}
                                />
                              </div>
                            ))}
                            {dayPosts.length > 2 && (
                              <span className="text-xs text-muted-foreground pl-1">
                                +{dayPosts.length - 2} more
                              </span>
                            )}
                          </div>
                          {dayPosts.length === 0 && (
                            <div className="flex items-center justify-center h-8 opacity-0 hover:opacity-100 transition-opacity">
                              <Plus className="w-3 h-3 text-muted-foreground" />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // Week view
            <div className="min-w-[600px]">
              {/* Header row */}
              <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b sticky top-0 bg-background z-10">
                <div />
                {weekDays.map((d, i) => {
                  const isToday = sameDay(d, new Date());
                  return (
                    <div key={i} className="text-center py-2 border-l">
                      <p className="text-xs text-muted-foreground">
                        {DAYS_WEEK[d.getDay()]}
                      </p>
                      <p
                        className={`text-sm font-medium ${
                          isToday ? "text-blue-500" : ""
                        }`}
                      >
                        {d.getDate()}
                      </p>
                    </div>
                  );
                })}
              </div>
              {/* Hour rows */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="grid grid-cols-[50px_repeat(7,1fr)] border-b min-h-[48px]"
                >
                  <div className="text-xs text-muted-foreground text-right pr-2 pt-1">
                    {hour}:00
                  </div>
                  {weekDays.map((d, di) => {
                    const slotPosts = postsForSlot(d, hour);
                    return (
                      <div
                        key={di}
                        className="border-l p-0.5 space-y-0.5 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => {
                          const date = new Date(d);
                          date.setHours(hour, 0, 0, 0);
                          onNewPost?.(date);
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDrop(d, hour)}
                      >
                        {slotPosts.map((p) => (
                          <div
                            key={p.id}
                            draggable
                            onDragStart={() => setDraggedId(p.id)}
                            onDragEnd={() => setDraggedId(null)}
                          >
                            <PostPill
                              post={p}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPost(p);
                                onPostClick?.(p);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform legend */}
      <div className="flex flex-wrap gap-3 px-1 pt-1">
        {Object.entries(PLATFORM_COLORS).map(([p, color]) => (
          <span
            key={p}
            className="flex items-center gap-1 text-xs text-muted-foreground capitalize"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            {p}
          </span>
        ))}
      </div>

      {/* Post detail dialog */}
      {selectedPost && (
        <Dialog
          open={!!selectedPost}
          onOpenChange={() => setSelectedPost(null)}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: PLATFORM_COLORS[selectedPost.platform],
                  }}
                />
                <span className="capitalize">{selectedPost.platform}</span>
                <Badge
                  variant={
                    selectedPost.status === "published"
                      ? "default"
                      : selectedPost.status === "failed"
                        ? "destructive"
                        : "secondary"
                  }
                  className="text-xs"
                >
                  {selectedPost.status}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm">{selectedPost.content}</p>
            <p className="text-xs text-muted-foreground">
              {selectedPost.scheduledAt.toLocaleString()}
            </p>
            {selectedPost.repeatInterval && selectedPost.repeatInterval > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Repeat className="h-3 w-3" />
                <span>
                  Repeats every {selectedPost.repeatInterval} day
                  {selectedPost.repeatInterval !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
