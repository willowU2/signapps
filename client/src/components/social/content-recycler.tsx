"use client";

import { useState, useEffect, useMemo } from "react";
import {
  RefreshCw,
  TrendingUp,
  Settings,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSocialStore } from "@/stores/social-store";
import { PLATFORM_COLORS, PLATFORM_LABELS } from "./platform-utils";
import { toast } from "sonner";
import { formatDistanceToNow, addDays, format } from "date-fns";
import type { SocialPost } from "@/lib/api/social";

const STORAGE_KEY = "signapps_recycle_config";

interface RecycleConfig {
  postId: string;
  enabled: boolean;
  intervalDays: number;
  prefix: string;
}

function loadConfigs(): Record<string, RecycleConfig> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveConfigs(configs: Record<string, RecycleConfig>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

function getEngagement(post: SocialPost): number {
  return (
    (post.likesCount ?? 0) +
    (post.sharesCount ?? 0) +
    (post.commentsCount ?? 0) +
    (post.engagementCount ?? 0)
  );
}

export function ContentRecycler() {
  const { posts, fetchPosts, createPost, schedulePost } = useSocialStore();
  const [configs, setConfigs] =
    useState<Record<string, RecycleConfig>>(loadConfigs);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts({ status: "published" });
  }, [fetchPosts]);

  const publishedPosts = useMemo(
    () =>
      posts
        .filter((p) => p.status === "published")
        .sort((a, b) => getEngagement(b) - getEngagement(a)),
    [posts],
  );

  const toggleRecycle = (post: SocialPost, enabled: boolean) => {
    const next = {
      ...configs,
      [post.id]: {
        postId: post.id,
        enabled,
        intervalDays: configs[post.id]?.intervalDays ?? 30,
        prefix: configs[post.id]?.prefix ?? "🔄",
      },
    };
    setConfigs(next);
    saveConfigs(next);
    toast.success(
      enabled ? "Recycling enabled for this post" : "Recycling disabled",
    );
  };

  const setInterval = (postId: string, days: number) => {
    const next = {
      ...configs,
      [postId]: {
        ...configs[postId],
        postId,
        enabled: configs[postId]?.enabled ?? false,
        intervalDays: days,
        prefix: configs[postId]?.prefix ?? "🔄",
      },
    };
    setConfigs(next);
    saveConfigs(next);
  };

  const handleRecycleNow = async (post: SocialPost) => {
    const config = configs[post.id];
    const intervalDays = config?.intervalDays ?? 30;
    const prefix = config?.prefix ?? "🔄";

    setSchedulingId(post.id);
    try {
      const hashtags = Array.isArray(post.hashtags) ? post.hashtags : [];
      // Shuffle hashtags slightly for variety
      const shuffled = [...hashtags].sort(() => Math.random() - 0.5);
      const newContent = `${prefix} ${post.content}`;
      const scheduledDate = addDays(new Date(), intervalDays);

      const newPost = await createPost({
        content: newContent,
        hashtags: shuffled,
        mediaUrls: post.mediaUrls,
        accountIds: post.accountIds,
        status: "draft",
      });
      await schedulePost(newPost.id, scheduledDate.toISOString());
      toast.success(
        `Recycled post scheduled for ${format(scheduledDate, "MMM d, yyyy")}`,
      );
    } catch {
      toast.error("Failed to recycle post");
    } finally {
      setSchedulingId(null);
    }
  };

  const recycledCount = Object.values(configs).filter((c) => c.enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Content Recycler</h2>
          <p className="text-sm text-muted-foreground">
            Re-schedule your best performing posts automatically
          </p>
        </div>
        {recycledCount > 0 && (
          <Badge variant="secondary" className="gap-1">
            <RefreshCw className="w-3 h-3" />
            {recycledCount} recycling
          </Badge>
        )}
      </div>

      {publishedPosts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <RotateCcw className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No published posts yet</p>
            <p className="text-sm mt-1">
              Published posts sorted by engagement will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {publishedPosts.map((post) => {
            const config = configs[post.id];
            const enabled = config?.enabled ?? false;
            const intervalDays = config?.intervalDays ?? 30;
            const engagement = getEngagement(post);

            return (
              <Card
                key={post.id}
                className={
                  enabled ? "border-green-200 dark:border-green-800" : ""
                }
              >
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {Array.isArray(post.accountIds) &&
                          post.accountIds.slice(0, 3).map((id) => {
                            const platform = post.platform ?? "twitter";
                            return (
                              <span
                                key={id}
                                className="text-xs px-1.5 py-0.5 rounded-full text-white"
                                style={{
                                  backgroundColor:
                                    PLATFORM_COLORS[platform] ?? "#6b7280",
                                }}
                              >
                                {PLATFORM_LABELS[platform] ?? platform}
                              </span>
                            );
                          })}
                        {engagement > 0 && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <TrendingUp className="w-3 h-3 text-green-500" />
                            {engagement} engagements
                          </span>
                        )}
                        {post.publishedAt && (
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(post.publishedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-sm line-clamp-2">{post.content}</p>
                      {Array.isArray(post.hashtags) &&
                        post.hashtags.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {(post.hashtags as string[])
                              .map((h) => `#${h}`)
                              .join(" ")}
                          </p>
                        )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`recycle-${post.id}`}
                          className="text-xs cursor-pointer"
                        >
                          Recycle
                        </Label>
                        <Switch
                          id={`recycle-${post.id}`}
                          checked={enabled}
                          onCheckedChange={(v) => toggleRecycle(post, v)}
                        />
                      </div>

                      {enabled && (
                        <>
                          <Select
                            value={String(intervalDays)}
                            onValueChange={(v) =>
                              setInterval(post.id, Number(v))
                            }
                          >
                            <SelectTrigger className="w-28 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="30">Every 30 days</SelectItem>
                              <SelectItem value="60">Every 60 days</SelectItem>
                              <SelectItem value="90">Every 90 days</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            disabled={schedulingId === post.id}
                            onClick={() => handleRecycleNow(post)}
                          >
                            {schedulingId === post.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                            Recycle now
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
