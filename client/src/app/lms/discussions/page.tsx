"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  ThumbsUp,
  Reply,
  Pin,
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
  BookOpen,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/use-page-title";
import { lmsApi, type LessonThread, type LmsComment } from "@/lib/api/lms";

// ── View model (camelCase mapping from snake_case API) ──────────────────────

interface CommentView {
  id: string;
  author: string;
  initials: string;
  content: string;
  likes: number;
  liked: boolean;
  createdAt: Date;
  replies: CommentView[];
  isPinned: boolean;
}

interface ThreadView {
  id: string;
  courseTitle: string;
  lessonTitle: string;
  lessonNumber: number;
  comments: CommentView[];
}

function toCommentView(c: LmsComment): CommentView {
  return {
    id: c.id,
    author: c.author,
    initials: c.initials,
    content: c.content,
    likes: c.likes,
    liked: c.liked,
    createdAt: new Date(c.created_at),
    replies: c.replies.map(toCommentView),
    isPinned: c.is_pinned,
  };
}

function toThreadView(t: LessonThread): ThreadView {
  return {
    id: t.id,
    courseTitle: t.course_title,
    lessonTitle: t.lesson_title,
    lessonNumber: t.lesson_number,
    comments: t.comments.map(toCommentView),
  };
}

export default function LMSDiscussionsPage() {
  usePageTitle("Discussions");
  const queryClient = useQueryClient();

  // ── Data fetching ───────────────────────────────────────
  const {
    data: threads = [],
    isLoading,
    isError,
  } = useQuery<ThreadView[]>({
    queryKey: ["lms-discussions"],
    queryFn: async () => {
      const res = await lmsApi.listDiscussions();
      return res.data.map(toThreadView);
    },
  });

  // ── Mutations ───────────────────────────────────────────
  const postCommentMutation = useMutation({
    mutationFn: ({
      threadId,
      content,
    }: {
      threadId: string;
      content: string;
    }) => lmsApi.createComment(threadId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lms-discussions"] });
      setNewComment("");
      toast.success("Commentaire publie !");
    },
    onError: () => toast.error("Failed to post comment"),
  });

  const replyMutation = useMutation({
    mutationFn: ({
      threadId,
      commentId,
      content,
    }: {
      threadId: string;
      commentId: string;
      content: string;
    }) => lmsApi.replyToComment(threadId, commentId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lms-discussions"] });
      setReplyText("");
      setReplyingTo(null);
      toast.success("Reponse publiee !");
    },
    onError: () => toast.error("Failed to post reply"),
  });

  const likeMutation = useMutation({
    mutationFn: ({
      threadId,
      commentId,
    }: {
      threadId: string;
      commentId: string;
    }) => lmsApi.toggleLike(threadId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lms-discussions"] });
    },
  });

  // ── Local state ─────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [expandedComments, setExpandedComments] = useState<
    Record<string, boolean>
  >({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [newComment, setNewComment] = useState("");
  const [selectedThread, setSelectedThread] = useState<string | null>(null);

  // Auto-select first thread when data loads
  const effectiveSelectedThread =
    selectedThread ?? (threads.length > 0 ? threads[0].id : null);
  const activeThread = threads.find((t) => t.id === effectiveSelectedThread);

  const toggleLike = (commentId: string) => {
    if (effectiveSelectedThread) {
      likeMutation.mutate({ threadId: effectiveSelectedThread, commentId });
    }
  };

  const handleReply = (commentId: string) => {
    if (!replyText.trim() || !effectiveSelectedThread) return;
    replyMutation.mutate({
      threadId: effectiveSelectedThread,
      commentId,
      content: replyText,
    });
  };

  const handlePost = () => {
    if (!newComment.trim() || !effectiveSelectedThread) return;
    postCommentMutation.mutate({
      threadId: effectiveSelectedThread,
      content: newComment,
    });
  };

  const CommentItem = ({
    comment,
    depth = 0,
  }: {
    comment: CommentView;
    depth?: number;
  }) => (
    <div
      className={cn(
        "space-y-2",
        depth > 0 && "ml-8 border-l-2 border-muted pl-4",
      )}
    >
      <div
        className={cn(
          "rounded-lg p-3",
          comment.isPinned
            ? "bg-primary/5 border border-primary/20"
            : "bg-muted/30",
        )}
      >
        {comment.isPinned && (
          <div className="flex items-center gap-1 text-xs text-primary mb-1">
            <Pin className="h-3 w-3" />
            Pinned
          </div>
        )}
        <div className="flex items-center gap-2 mb-1.5">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs">
              {comment.initials}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{comment.author}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm">{comment.content}</p>
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() => toggleLike(comment.id)}
            className={cn(
              "flex items-center gap-1 text-xs hover:text-primary transition-colors",
              comment.liked && "text-primary",
            )}
          >
            <ThumbsUp
              className={cn("h-3.5 w-3.5", comment.liked && "fill-current")}
            />
            {comment.likes}
          </button>
          {depth === 0 && (
            <button
              onClick={() => {
                setReplyingTo(replyingTo === comment.id ? null : comment.id);
                setReplyText("");
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Reply className="h-3.5 w-3.5" />
              Reply
            </button>
          )}
        </div>
      </div>
      {replyingTo === comment.id && (
        <div className="ml-8 flex gap-2">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            rows={2}
            className="text-sm"
          />
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              onClick={() => handleReply(comment.id)}
              disabled={replyMutation.isPending}
            >
              Post
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setReplyingTo(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {comment.replies.length > 0 && (
        <div className="space-y-2">
          {(expandedComments[comment.id]
            ? comment.replies
            : comment.replies.slice(0, 1)
          ).map((r) => (
            <CommentItem key={r.id} comment={r} depth={depth + 1} />
          ))}
          {comment.replies.length > 1 && (
            <button
              onClick={() =>
                setExpandedComments((prev) => ({
                  ...prev,
                  [comment.id]: !prev[comment.id],
                }))
              }
              className="ml-8 text-xs text-primary flex items-center gap-1"
            >
              {expandedComments[comment.id] ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  {comment.replies.length - 1} more replies
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Course Discussions</h1>
            <p className="text-sm text-muted-foreground">
              Ask questions and engage with lesson content
            </p>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-3 space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-20 w-full" />
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-3 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <Card className="border-destructive">
            <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mb-2 text-destructive opacity-60" />
              <p>Failed to load discussions</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ["lms-discussions"],
                  })
                }
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!isLoading && !isError && threads.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
              <p>No discussions yet</p>
              <p className="text-xs">
                Discussions will appear as lessons are created
              </p>
            </CardContent>
          </Card>
        )}

        {/* Data loaded */}
        {!isLoading && !isError && threads.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Thread list */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="pl-9 text-sm"
                />
              </div>
              {threads
                .filter(
                  (t) =>
                    !search ||
                    t.lessonTitle.toLowerCase().includes(search.toLowerCase()),
                )
                .map((t) => (
                  <Card
                    key={t.id}
                    className={cn(
                      "cursor-pointer hover:shadow-md transition-shadow",
                      effectiveSelectedThread === t.id && "border-primary",
                    )}
                    onClick={() => setSelectedThread(t.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                        <BookOpen className="h-3 w-3" />
                        Lesson {t.lessonNumber}
                      </div>
                      <p className="text-sm font-medium">{t.lessonTitle}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.courseTitle}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        {t.comments.length} comment
                        {t.comments.length !== 1 ? "s" : ""}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>

            {/* Active thread */}
            <div className="lg:col-span-2 space-y-4">
              {activeThread ? (
                <>
                  <div>
                    <h2 className="font-bold">{activeThread.lessonTitle}</h2>
                    <p className="text-sm text-muted-foreground">
                      {activeThread.courseTitle}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Ask a question or share a thought about this lesson..."
                      rows={3}
                    />
                    <div className="flex justify-end">
                      <Button
                        onClick={handlePost}
                        disabled={
                          !newComment.trim() || postCommentMutation.isPending
                        }
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Post Comment
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {activeThread.comments.map((c) => (
                      <CommentItem key={c.id} comment={c} />
                    ))}
                    {activeThread.comments.length === 0 && (
                      <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center py-10 text-muted-foreground">
                          <MessageSquare className="h-6 w-6 mb-1 opacity-30" />
                          <p className="text-sm">
                            No comments yet — be the first!
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                    <p>Select a lesson to view discussion</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
