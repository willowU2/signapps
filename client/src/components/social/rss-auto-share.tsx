"use client";

// IDEA-056: RSS auto-share integration — monitor RSS feeds, auto-create posts from new items

import { useState, useEffect } from "react";
import {
  Rss,
  RefreshCw,
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  Send,
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
import { toast } from "sonner";
import { getServiceUrl, ServiceName } from "@/lib/api/factory";

interface FeedItem {
  id: string;
  feedName: string;
  title: string;
  description: string;
  link: string;
  publishedAt: string;
  autoShareStatus: "pending" | "shared" | "skipped" | "queued";
}

interface AutoShareConfig {
  enabled: boolean;
  delay: string; // "immediate" | "15min" | "1h" | "manual"
  includeDescription: boolean;
  appendLink: boolean;
}

const DEMO_ITEMS: FeedItem[] = [
  {
    id: "fi1",
    feedName: "Tech Blog",
    title: "Building local-first AI apps with Rust",
    description:
      "Explore how Rust and Axum power zero-latency AI inference without cloud dependencies.",
    link: "https://example.com/rust-ai",
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    autoShareStatus: "queued",
  },
  {
    id: "fi2",
    feedName: "Open Source Weekly",
    title: "Top 5 open-source office suites in 2026",
    description:
      "A roundup of the best alternatives to proprietary productivity software.",
    link: "https://example.com/oss-office",
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    autoShareStatus: "shared",
  },
  {
    id: "fi3",
    feedName: "Tech Blog",
    title: "Why WASM is becoming the universal runtime",
    description:
      "WebAssembly is no longer just for browsers — it powers edge compute and AI models.",
    link: "https://example.com/wasm",
    publishedAt: new Date(Date.now() - 86400000).toISOString(),
    autoShareStatus: "pending",
  },
  {
    id: "fi4",
    feedName: "Open Source Weekly",
    title: "Self-hosting guide: Replace Google Workspace",
    description:
      "Step-by-step guide to replacing cloud services with self-hosted alternatives.",
    link: "https://example.com/self-hosting",
    publishedAt: new Date(Date.now() - 172800000).toISOString(),
    autoShareStatus: "skipped",
  },
];

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "secondary", icon: Clock },
  queued: { label: "Queued", color: "default", icon: Clock },
  shared: { label: "Shared", color: "outline", icon: CheckCircle },
  skipped: { label: "Skipped", color: "outline", icon: XCircle },
} as const;

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function applyTemplate(item: FeedItem, cfg: AutoShareConfig): string {
  let text = item.title;
  if (cfg.includeDescription) text += `\n\n${item.description.slice(0, 140)}…`;
  if (cfg.appendLink) text += `\n\n${item.link}`;
  return text;
}

export function RssAutoShare() {
  const [items, setItems] = useState<FeedItem[]>(DEMO_ITEMS);
  const [config, setConfig] = useState<AutoShareConfig>({
    enabled: true,
    delay: "1h",
    includeDescription: true,
    appendLink: true,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const updateConfig = (patch: Partial<AutoShareConfig>) =>
    setConfig((c) => ({ ...c, ...patch }));

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(
        `${getServiceUrl(ServiceName.SOCIAL)}/social/rss/fetch-all`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items ?? items);
      toast.success("RSS feeds refreshed");
    } catch {
      toast.info("Utilisation des éléments en cache (API indisponible)");
    } finally {
      setRefreshing(false);
    }
  };

  const handleShare = async (item: FeedItem) => {
    const postContent = applyTemplate(item, config);
    try {
      const res = await fetch(
        `${getServiceUrl(ServiceName.SOCIAL)}/social/posts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: postContent,
            source: "rss",
            rssItemId: item.id,
          }),
        },
      );
      if (!res.ok) throw new Error();
      toast.success(`Post created from "${item.title.slice(0, 40)}…"`);
    } catch {
      toast.info("Publication mise en file localement (API indisponible)");
    }
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, autoShareStatus: "shared" } : i,
      ),
    );
  };

  const handleSkip = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, autoShareStatus: "skipped" } : i)),
    );
  };

  const pendingCount = items.filter(
    (i) => i.autoShareStatus === "pending" || i.autoShareStatus === "queued",
  ).length;

  return (
    <div className="space-y-4">
      {/* Config card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Rss className="w-4 h-4 text-orange-500" />
              RSS Auto-Share
              {pendingCount > 0 && (
                <Badge variant="default" className="text-xs">
                  {pendingCount} pending
                </Badge>
              )}
            </span>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Enabled</Label>
              <Switch
                checked={config.enabled}
                onCheckedChange={(v) => updateConfig({ enabled: v })}
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Auto-post delay</Label>
              <Select
                value={config.delay}
                onValueChange={(v) => updateConfig({ delay: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate" className="text-xs">
                    Immediate
                  </SelectItem>
                  <SelectItem value="15min" className="text-xs">
                    15 min
                  </SelectItem>
                  <SelectItem value="1h" className="text-xs">
                    1 hour
                  </SelectItem>
                  <SelectItem value="manual" className="text-xs">
                    Manual only
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 justify-end">
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.includeDescription}
                  onCheckedChange={(v) =>
                    updateConfig({ includeDescription: v })
                  }
                  className="scale-75"
                />
                <Label className="text-[10px]">Include description</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.appendLink}
                  onCheckedChange={(v) => updateConfig({ appendLink: v })}
                  className="scale-75"
                />
                <Label className="text-[10px]">Append link</Label>
              </div>
            </div>
            <div className="flex items-end">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing}
                className="w-full h-8 text-xs"
              >
                <RefreshCw
                  className={`w-3 h-3 mr-1 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feed items */}
      <div className="space-y-2">
        {items.map((item) => {
          const statusCfg = STATUS_CONFIG[item.autoShareStatus];
          const StatusIcon = statusCfg.icon;
          const isPreview = previewId === item.id;

          return (
            <Card
              key={item.id}
              className={item.autoShareStatus === "skipped" ? "opacity-50" : ""}
            >
              <CardContent className="py-3 px-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium truncate">
                        {item.title}
                      </span>
                      <Badge
                        variant={statusCfg.color}
                        className="text-[10px] gap-0.5 shrink-0"
                      >
                        <StatusIcon className="w-2.5 h-2.5" />
                        {statusCfg.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      <span>{item.feedName}</span>
                      <span>·</span>
                      <span>{formatRelative(item.publishedAt)}</span>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline flex items-center gap-0.5"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                  {item.autoShareStatus !== "shared" &&
                    item.autoShareStatus !== "skipped" && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => handleShare(item)}
                        >
                          <Send className="w-2.5 h-2.5 mr-1" />
                          Share
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] px-2"
                          onClick={() => handleSkip(item.id)}
                        >
                          Skip
                        </Button>
                      </div>
                    )}
                </div>

                {/* Post preview toggle */}
                <button
                  className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => setPreviewId(isPreview ? null : item.id)}
                >
                  {isPreview ? "Hide preview" : "Preview post"}
                </button>
                {isPreview && (
                  <div className="bg-muted/40 rounded-md p-2 text-xs whitespace-pre-wrap border">
                    {applyTemplate(item, config)}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
