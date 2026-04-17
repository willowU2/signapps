"use client";

import { useState } from "react";
import {
  Leaf,
  Trash2,
  Plus,
  History,
  Settings,
  GripVertical,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { getServiceUrl, ServiceName } from "@/lib/api/factory";

interface EvergreenPost {
  id: string;
  content: string;
  platforms: string[];
  timesRepublished: number;
  lastPublishedAt: string | null;
  addedAt: string;
}

interface QueueSettings {
  minIntervalDays: number;
  randomizeOrder: boolean;
  enabled: boolean;
}

interface EvergreenQueueProps {
  posts?: EvergreenPost[];
  settings?: QueueSettings;
  onAddPost?: (postId: string) => void;
  onRemovePost?: (postId: string) => void;
  onSettingsChange?: (settings: QueueSettings) => void;
}

const PLATFORM_COLORS: Record<string, string> = {
  twitter: "#1DA1F2",
  facebook: "#1877F2",
  instagram: "#E4405F",
  linkedin: "#0A66C2",
  mastodon: "#6364FF",
  bluesky: "#0085FF",
};

const DEFAULT_POSTS: EvergreenPost[] = [
  {
    id: "1",
    content:
      "Did you know SignApps is 100% local and free? No data leaves your network.",
    platforms: ["twitter", "linkedin"],
    timesRepublished: 5,
    lastPublishedAt: "2026-03-10",
    addedAt: "2025-10-01",
  },
  {
    id: "2",
    content:
      "Top 5 reasons to switch from proprietary office suites to open-source alternatives...",
    platforms: ["facebook", "linkedin"],
    timesRepublished: 3,
    lastPublishedAt: "2026-02-28",
    addedAt: "2025-11-15",
  },
];

export function EvergreenQueue({
  posts: initialPosts,
  settings: initialSettings,
  onAddPost,
  onRemovePost,
  onSettingsChange,
}: EvergreenQueueProps) {
  const [posts, setPosts] = useState<EvergreenPost[]>(
    initialPosts ?? DEFAULT_POSTS,
  );
  const [settings, setSettings] = useState<QueueSettings>(
    initialSettings ?? {
      minIntervalDays: 30,
      randomizeOrder: true,
      enabled: true,
    },
  );
  const [newPostId, setNewPostId] = useState("");
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const handleSettingsChange = (patch: Partial<QueueSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    onSettingsChange?.(next);
  };

  const handleAdd = async () => {
    const id = newPostId.trim();
    if (!id) return;
    setLoading("add");
    try {
      await fetch(
        `${getServiceUrl(ServiceName.SOCIAL)}/social/posts/${id}/evergreen`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_evergreen: true }),
        },
      );
      onAddPost?.(id);
      toast.success("Publication ajoutée à la file evergreen");
    } catch {
      toast.error(
        "Impossible de mettre à jour la publication — vérifiez l'API",
      );
    } finally {
      setLoading(null);
      setNewPostId("");
    }
  };

  const handleRemove = async (post: EvergreenPost) => {
    setLoading(post.id);
    try {
      await fetch(
        `${getServiceUrl(ServiceName.SOCIAL)}/social/posts/${post.id}/evergreen`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_evergreen: false }),
        },
      );
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      onRemovePost?.(post.id);
      toast.success("Retiré from evergreen queue");
    } catch {
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      toast.warning("Retiré locally (API unavailable)");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-green-500" />
            Evergreen Queue
            <Badge
              variant={settings.enabled ? "default" : "secondary"}
              className="text-xs"
            >
              {settings.enabled ? "Active" : "Paused"}
            </Badge>
          </span>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Paramètres"
              >
                <Settings className="w-3 h-3" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>Queue Settings</SheetTitle>
              </SheetHeader>
              <div className="space-y-5 pt-6">
                <div className="flex items-center justify-between">
                  <Label>Enable Queue</Label>
                  <Switch
                    checked={settings.enabled}
                    onCheckedChange={(v) =>
                      handleSettingsChange({ enabled: v })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Randomize Order</Label>
                  <Switch
                    checked={settings.randomizeOrder}
                    onCheckedChange={(v) =>
                      handleSettingsChange({ randomizeOrder: v })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min. Interval Between Reposts</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={settings.minIntervalDays}
                      onChange={(e) =>
                        handleSettingsChange({
                          minIntervalDays: Number(e.target.value),
                        })
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Post ID to add..."
            value={newPostId}
            onChange={(e) => setNewPostId(e.target.value)}
            className="h-8 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleAdd}
            disabled={loading === "add"}
          >
            {loading === "add" ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Plus className="w-3 h-3" />
            )}
          </Button>
        </div>

        {posts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No evergreen posts yet. Add posts to recycle them automatically.
          </p>
        ) : (
          <div className="space-y-2">
            {posts.map((post) => (
              <div
                key={post.id}
                className="group flex items-start gap-2 p-2 rounded-md border bg-muted/30 hover:bg-muted/60 transition-colors"
              >
                <GripVertical className="w-3 h-3 mt-1 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs line-clamp-2">{post.content}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {post.platforms.map((p) => (
                      <span
                        key={p}
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: PLATFORM_COLORS[p] ?? "#888",
                        }}
                        title={p}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground">
                      Republished {post.timesRepublished}x
                    </span>
                    {post.lastPublishedAt && (
                      <span className="text-xs text-muted-foreground">
                        · Last: {post.lastPublishedAt}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="View history"
                    onClick={() =>
                      setShowHistory(showHistory === post.id ? null : post.id)
                    }
                    aria-label="View history"
                  >
                    <History className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => handleRemove(post)}
                    disabled={loading === post.id}
                  >
                    {loading === post.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {posts.length} post{posts.length !== 1 ? "s" : ""} in queue ·{" "}
          {settings.minIntervalDays}d min interval
        </p>
      </CardContent>
    </Card>
  );
}
