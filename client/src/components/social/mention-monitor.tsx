"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  Bell,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSocialStore } from "@/stores/social-store";
import { PLATFORM_COLORS, PLATFORM_LABELS } from "./platform-utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const KEYWORDS_KEY = "signapps_mention_keywords";

function loadKeywords(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEYWORDS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveKeywords(keywords: string[]) {
  localStorage.setItem(KEYWORDS_KEY, JSON.stringify(keywords));
}

type Sentiment = "positive" | "negative" | "neutral";

const POSITIVE_WORDS = [
  "merci",
  "super",
  "bravo",
  "love",
  "amazing",
  "great",
  "excellent",
  "fantastic",
  "awesome",
  "perfect",
  "wonderful",
  "brilliant",
  "outstanding",
];
const NEGATIVE_WORDS = [
  "problème",
  "bug",
  "nul",
  "horrible",
  "complaint",
  "issue",
  "bad",
  "terrible",
  "awful",
  "broken",
  "error",
  "fail",
  "disappointed",
  "hate",
];

function analyzeSentiment(text: string): Sentiment {
  const lower = text.toLowerCase();
  const posCount = POSITIVE_WORDS.filter((w) => lower.includes(w)).length;
  const negCount = NEGATIVE_WORDS.filter((w) => lower.includes(w)).length;
  if (posCount > negCount) return "positive";
  if (negCount > posCount) return "negative";
  return "neutral";
}

const SENTIMENT_CONFIG: Record<
  Sentiment,
  { emoji: string; label: string; className: string }
> = {
  positive: {
    emoji: "😊",
    label: "Positive",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
  negative: {
    emoji: "😠",
    label: "Negative",
    className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  },
  neutral: {
    emoji: "😐",
    label: "Neutral",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
};

function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const cfg = SENTIMENT_CONFIG[sentiment];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}
    >
      {cfg.emoji} {cfg.label}
    </span>
  );
}

interface MentionItem {
  id: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  platform: string;
  createdAt: string;
  matchedKeyword: string;
  sentiment: Sentiment;
  read: boolean;
}

export function MentionMonitor() {
  const { inboxItems, accounts, fetchInbox } = useSocialStore();
  const [keywords, setKeywords] = useState<string[]>(loadKeywords);
  const [newKeyword, setNewKeyword] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<"all" | Sentiment>(
    "all",
  );
  const [showReadItems, setShowReadItems] = useState(false);

  useEffect(() => {
    fetchInbox({ type: "mention" });
  }, [fetchInbox]);

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (!kw) return;
    if (keywords.includes(kw)) {
      toast.error("Keyword already exists");
      return;
    }
    const next = [...keywords, kw];
    setKeywords(next);
    saveKeywords(next);
    setNewKeyword("");
    toast.success(`Keyword "${kw}" added`);
  };

  const removeKeyword = (kw: string) => {
    const next = keywords.filter((k) => k !== kw);
    setKeywords(next);
    saveKeywords(next);
  };

  // Filter inbox items by keywords and enrich with sentiment
  const mentions = useMemo((): MentionItem[] => {
    if (keywords.length === 0) return [];

    return inboxItems
      .filter((item) => {
        const text = (item.content ?? "").toLowerCase();
        return keywords.some((kw) => text.includes(kw));
      })
      .map((item) => {
        const matchedKeyword =
          keywords.find((kw) =>
            (item.content ?? "").toLowerCase().includes(kw),
          ) ?? "";
        const sentiment = analyzeSentiment(item.content ?? "");
        return {
          id: item.id,
          authorName: item.authorName ?? "Unknown",
          authorAvatar: item.authorAvatar,
          content: item.content ?? "",
          platform: item.platform ?? "unknown",
          createdAt: item.createdAt,
          matchedKeyword,
          sentiment,
          read: item.read ?? item.isRead ?? false,
        };
      });
  }, [inboxItems, keywords]);

  const filtered = useMemo(
    () =>
      mentions
        .filter(
          (m) => sentimentFilter === "all" || m.sentiment === sentimentFilter,
        )
        .filter((m) => showReadItems || !m.read),
    [mentions, sentimentFilter, showReadItems],
  );

  const sentimentCounts = useMemo(
    () => ({
      positive: mentions.filter((m) => m.sentiment === "positive").length,
      negative: mentions.filter((m) => m.sentiment === "negative").length,
      neutral: mentions.filter((m) => m.sentiment === "neutral").length,
    }),
    [mentions],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Mention Monitor</h2>
        <p className="text-sm text-muted-foreground">
          Track brand keywords across platforms and analyze sentiment
        </p>
      </div>

      {/* Keywords management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="w-4 h-4" />
            Tracked Keywords
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Brand name, product, hashtag…"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addKeyword()}
              className="h-8 text-sm"
            />
            <Button size="sm" onClick={addKeyword} className="gap-1 shrink-0">
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </div>
          {keywords.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No keywords yet. Add your brand name, product names or hashtags.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {keywords.map((kw) => (
                <div
                  key={kw}
                  className="flex items-center gap-1 bg-muted rounded-full px-3 py-1"
                >
                  <span className="text-xs font-medium">{kw}</span>
                  <button
                    type="button"
                    onClick={() => removeKeyword(kw)}
                    className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sentiment overview */}
      {mentions.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {(["positive", "negative", "neutral"] as Sentiment[]).map((s) => {
            const cfg = SENTIMENT_CONFIG[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() =>
                  setSentimentFilter(sentimentFilter === s ? "all" : s)
                }
                className={`p-3 rounded-xl border text-center transition-all hover:shadow-sm ${
                  sentimentFilter === s
                    ? "ring-2 ring-primary/40 bg-muted/50"
                    : "hover:bg-muted/30"
                }`}
              >
                <div className="text-2xl mb-1">{cfg.emoji}</div>
                <div className="text-lg font-bold">{sentimentCounts[s]}</div>
                <div className="text-xs text-muted-foreground">{cfg.label}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Filters bar */}
      {mentions.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">
            {filtered.length} mention{filtered.length !== 1 ? "s" : ""}
            {sentimentFilter !== "all" && ` — ${sentimentFilter}`}
          </p>
          <div className="flex items-center gap-2">
            <Switch
              id="show-read"
              checked={showReadItems}
              onCheckedChange={setShowReadItems}
            />
            <Label htmlFor="show-read" className="text-sm cursor-pointer">
              Show read
            </Label>
          </div>
        </div>
      )}

      {/* Mentions list */}
      {keywords.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Add keywords to start monitoring</p>
          <p className="text-sm mt-1">
            We'll scan your inbox for mentions matching your keywords
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No mentions found matching your keywords</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-2"
            onClick={() => fetchInbox({ type: "mention" })}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((mention) => (
            <Card key={mention.id} className={mention.read ? "opacity-70" : ""}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start gap-3">
                  {mention.authorAvatar ? (
                    <Image
                      src={mention.authorAvatar}
                      alt=""
                      width={36}
                      height={36}
                      className="rounded-full shrink-0"
                    />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
                      style={{
                        backgroundColor:
                          PLATFORM_COLORS[mention.platform] ?? "#6b7280",
                      }}
                    >
                      {mention.authorName.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-sm">
                        {mention.authorName}
                      </span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full text-white capitalize"
                        style={{
                          backgroundColor:
                            PLATFORM_COLORS[mention.platform] ?? "#6b7280",
                        }}
                      >
                        {PLATFORM_LABELS[mention.platform] ?? mention.platform}
                      </span>
                      <SentimentBadge sentiment={mention.sentiment} />
                      <Badge variant="outline" className="text-xs h-4 px-1.5">
                        #{mention.matchedKeyword}
                      </Badge>
                    </div>
                    <p className="text-sm">{mention.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(mention.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1 text-xs h-7"
                    asChild
                  >
                    <a href="/social/inbox">
                      <MessageSquare className="w-3 h-3" />
                      Reply
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
