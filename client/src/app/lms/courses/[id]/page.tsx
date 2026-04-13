"use client";

import { useState, use } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Pause,
  CheckCircle2,
  Circle,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  Clock,
  BookOpen,
  List,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Chapter {
  id: string;
  title: string;
  duration: number;
  type: "video" | "text" | "quiz";
  completed: boolean;
  bookmarked: boolean;
}

interface CourseData {
  id: string;
  title: string;
  description: string;
  instructor: string;
  level: string;
  totalDuration: number;
  chapters: Chapter[];
}

const COURSE_DATA: CourseData = {
  id: "1",
  title: "Introduction to SignApps Platform",
  description:
    "Master the SignApps Platform from the ground up. Learn core modules, user management, and best practices.",
  instructor: "Alice Martin",
  level: "Beginner",
  totalDuration: 180,
  chapters: [
    {
      id: "c1",
      title: "Getting Started with SignApps",
      duration: 15,
      type: "video",
      completed: true,
      bookmarked: false,
    },
    {
      id: "c2",
      title: "Dashboard Overview",
      duration: 20,
      type: "video",
      completed: true,
      bookmarked: true,
    },
    {
      id: "c3",
      title: "User Management Basics",
      duration: 25,
      type: "video",
      completed: false,
      bookmarked: false,
    },
    {
      id: "c4",
      title: "Document Workflows",
      duration: 30,
      type: "video",
      completed: false,
      bookmarked: false,
    },
    {
      id: "c5",
      title: "Module 1 Assessment",
      duration: 10,
      type: "quiz",
      completed: false,
      bookmarked: false,
    },
    {
      id: "c6",
      title: "Advanced Features",
      duration: 35,
      type: "video",
      completed: false,
      bookmarked: false,
    },
    {
      id: "c7",
      title: "Security & Permissions",
      duration: 25,
      type: "text",
      completed: false,
      bookmarked: false,
    },
    {
      id: "c8",
      title: "Final Assessment",
      duration: 20,
      type: "quiz",
      completed: false,
      bookmarked: false,
    },
  ],
};

export default function CoursePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  usePageTitle("Formation");
  const [course, setCourse] = useState<CourseData>(COURSE_DATA);
  const [activeChapter, setActiveChapter] = useState<Chapter>(
    course.chapters[0],
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);

  const completed = course.chapters.filter((c) => c.completed).length;
  const progress = Math.round((completed / course.chapters.length) * 100);

  const markComplete = (cid: string) => {
    setCourse((prev) => ({
      ...prev,
      chapters: prev.chapters.map((c) =>
        c.id === cid ? { ...c, completed: true } : c,
      ),
    }));
    toast.success("Chapter completed!");
    const next = course.chapters.find(
      (c, i) => !c.completed && i > course.chapters.indexOf(activeChapter),
    );
    if (next) setActiveChapter(next);
  };

  const toggleBookmark = (cid: string) => {
    setCourse((prev) => ({
      ...prev,
      chapters: prev.chapters.map((c) =>
        c.id === cid ? { ...c, bookmarked: !c.bookmarked } : c,
      ),
    }));
    const ch = course.chapters.find((c) => c.id === cid);
    toast.success(ch?.bookmarked ? "Bookmark removed" : "Bookmarked!");
  };

  const typeColor = (type: string) =>
    type === "quiz"
      ? "text-orange-500"
      : type === "text"
        ? "text-blue-500"
        : "text-green-500";

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/lms/catalog">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Catalog
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl bg-slate-900 aspect-video flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
              <div className="relative z-10 flex flex-col items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-card/10 backdrop-blur-sm">
                  {activeChapter.type === "video" ? (
                    <button onClick={() => setIsPlaying(!isPlaying)}>
                      {isPlaying ? (
                        <Pause className="h-8 w-8 text-white" />
                      ) : (
                        <Play className="h-8 w-8 text-white ml-1" />
                      )}
                    </button>
                  ) : (
                    <BookOpen className="h-8 w-8 text-white" />
                  )}
                </div>
                <span className="text-white font-semibold">
                  {activeChapter.title}
                </span>
                <Badge variant="secondary" className="text-xs capitalize">
                  {activeChapter.type}
                </Badge>
              </div>
              {activeChapter.type === "video" && (
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div
                    className="h-1 bg-card/20 rounded-full cursor-pointer"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setPlayProgress(
                        ((e.clientX - rect.left) / rect.width) * 100,
                      );
                    }}
                  >
                    <div
                      className="h-1 bg-card rounded-full transition-all"
                      style={{ width: `${playProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-white/60 mt-1">
                    <span>
                      {Math.round(
                        (playProgress * activeChapter.duration) / 100,
                      )}
                      m
                    </span>
                    <span>{activeChapter.duration}m</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold">{activeChapter.title}</h1>
                <p className="text-sm text-muted-foreground">
                  {course.instructor} · <Clock className="h-3 w-3 inline" />{" "}
                  {activeChapter.duration} min
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleBookmark(activeChapter.id)}
                >
                  {activeChapter.bookmarked ? (
                    <BookmarkCheck className="h-4 w-4 mr-1 text-primary" />
                  ) : (
                    <Bookmark className="h-4 w-4 mr-1" />
                  )}
                  {activeChapter.bookmarked ? "Saved" : "Bookmark"}
                </Button>
                {!activeChapter.completed && (
                  <Button
                    size="sm"
                    onClick={() => markComplete(activeChapter.id)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Mark Complete
                  </Button>
                )}
              </div>
            </div>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  {course.description}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge variant="outline">{course.level}</Badge>
                  <Badge variant="outline">
                    <Clock className="h-3 w-3 mr-1" />
                    {course.totalDuration} min total
                  </Badge>
                  <Badge variant="outline">
                    <List className="h-3 w-3 mr-1" />
                    {course.chapters.length} chapters
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chapter List */}
          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Course Progress</CardTitle>
                  <span className="text-sm font-bold text-primary">
                    {progress}%
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {completed} of {course.chapters.length} chapters
                </p>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Chapters</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {course.chapters.map((ch, idx) => (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChapter(ch)}
                    className={cn(
                      "w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors border-b last:border-b-0",
                      activeChapter.id === ch.id && "bg-primary/5",
                    )}
                  >
                    <div className="shrink-0">
                      {ch.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium truncate",
                          activeChapter.id === ch.id && "text-primary",
                        )}
                      >
                        {idx + 1}. {ch.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className={typeColor(ch.type)}>{ch.type}</span>
                        <span>·</span>
                        <span>{ch.duration}m</span>
                      </div>
                    </div>
                    {ch.bookmarked && (
                      <Bookmark className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
