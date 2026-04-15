"use client";

/**
 * PlatformPreview — Shows how a post will look on each selected platform.
 * Renders platform-styled cards: Twitter, LinkedIn, Instagram, Facebook.
 * For other platforms, falls back to the generic PostPreview.
 */

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Share2,
  ThumbsUp,
  Bookmark,
  MoreHorizontal,
  Globe,
  Eye,
  Send,
} from "lucide-react";
import {
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  PLATFORM_CHAR_LIMITS,
} from "./platform-utils";
import type { SocialAccount } from "@/lib/api/social";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlatformPreviewProps {
  /** List of platform keys to preview */
  platforms: SocialAccount["platform"][];
  content: string;
  mediaUrls?: string[];
  accountName?: string;
  accountAvatar?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Avatar({
  src,
  name,
  color,
  size = 40,
  square = false,
}: {
  src?: string;
  name: string;
  color: string;
  size?: number;
  square?: boolean;
}) {
  const cls = square ? "rounded-md" : "rounded-full";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${cls} shrink-0 object-cover`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`${cls} flex items-center justify-center text-white font-bold shrink-0`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.4,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function truncateContent(
  content: string,
  platform: SocialAccount["platform"],
): string {
  const limit = PLATFORM_CHAR_LIMITS[platform] ?? 280;
  if (content.length <= limit) return content;
  return content.slice(0, limit - 3) + "…";
}

// ---------------------------------------------------------------------------
// Twitter preview
// ---------------------------------------------------------------------------

function TwitterCard({
  content,
  mediaUrls,
  accountName,
  accountAvatar,
}: {
  content: string;
  mediaUrls?: string[];
  accountName?: string;
  accountAvatar?: string;
}) {
  const name = accountName ?? "Your Name";
  const handle = name.toLowerCase().replace(/\s+/g, "");
  const text = truncateContent(content, "twitter");

  return (
    <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4 max-w-[500px] font-sans text-sm shadow-sm">
      <div className="flex gap-3">
        <Avatar src={accountAvatar} name={name} color="#000" size={42} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[15px] text-zinc-900 dark:text-zinc-100">
              {name}
            </span>
            <span className="text-zinc-500 text-[13px]">@{handle}</span>
            <span className="text-zinc-400 text-xs ml-auto">· now</span>
          </div>
          <p className="mt-1.5 text-[15px] leading-relaxed text-zinc-900 dark:text-zinc-100 whitespace-pre-line">
            {text}
          </p>
          {mediaUrls && mediaUrls.length > 0 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrls[0]}
              alt="media"
              className="mt-2 rounded-2xl w-full max-h-56 object-cover"
            />
          )}
          <div className="flex items-center gap-6 mt-3 text-zinc-500 text-[13px]">
            <button className="flex items-center gap-1.5 hover:text-blue-500 transition-colors">
              <MessageCircle className="h-4 w-4" /> <span>0</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-green-500 transition-colors">
              <Repeat2 className="h-4 w-4" /> <span>0</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-pink-500 transition-colors">
              <Heart className="h-4 w-4" /> <span>0</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-blue-500 transition-colors">
              <Bookmark className="h-4 w-4" />
            </button>
            <button className="flex items-center gap-1.5 hover:text-blue-500 transition-colors ml-auto">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LinkedIn preview
// ---------------------------------------------------------------------------

function LinkedInCard({
  content,
  mediaUrls,
  accountName,
  accountAvatar,
}: {
  content: string;
  mediaUrls?: string[];
  accountName?: string;
  accountAvatar?: string;
}) {
  const name = accountName ?? "Your Name";
  const text = truncateContent(content, "linkedin");
  const [expanded, setExpanded] = useState(false);
  const PREVIEW_LEN = 200;
  const shouldTruncate = text.length > PREVIEW_LEN;
  const displayed =
    !expanded && shouldTruncate ? text.slice(0, PREVIEW_LEN) + "…" : text;

  return (
    <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4 max-w-[560px] shadow-sm font-sans">
      {/* Header */}
      <div className="flex gap-3 mb-3">
        <Avatar src={accountAvatar} name={name} color="#0A66C2" size={48} />
        <div>
          <p className="font-semibold text-[15px] text-zinc-900 dark:text-zinc-100">
            {name}
          </p>
          <p className="text-xs text-zinc-500">Social Media Manager</p>
          <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
            now · <Globe className="h-3 w-3" />
          </p>
        </div>
        <button className="ml-auto">
          <MoreHorizontal className="h-5 w-5 text-zinc-400" />
        </button>
      </div>

      {/* Content */}
      <p className="text-[14px] text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-line">
        {displayed}
      </p>
      {shouldTruncate && (
        <button
          className="text-[13px] text-zinc-500 hover:text-zinc-700 mt-1"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "see less" : "…see more"}
        </button>
      )}

      {/* Media */}
      {mediaUrls && mediaUrls.length > 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrls[0]}
          alt="media"
          className="mt-3 rounded-lg w-full max-h-64 object-cover"
        />
      )}

      {/* Engagement bar */}
      <div className="mt-3 pt-3 border-t flex items-center gap-1 text-zinc-500 text-xs">
        <span>👍❤️🎉</span>
        <span>0 reactions</span>
        <span className="ml-auto">0 comments</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 mt-2 border-t pt-2">
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageCircle, label: "Comment" },
          { icon: Repeat2, label: "Repost" },
          { icon: Send, label: "Send" },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Instagram preview
// ---------------------------------------------------------------------------

function InstagramCard({
  content,
  mediaUrls,
  accountName,
  accountAvatar,
}: {
  content: string;
  mediaUrls?: string[];
  accountName?: string;
  accountAvatar?: string;
}) {
  const name = accountName ?? "your_account";
  const handle = name.toLowerCase().replace(/\s+/g, "_");
  const caption = truncateContent(content, "instagram");

  return (
    <div className="rounded-xl border bg-white dark:bg-zinc-900 max-w-[400px] shadow-sm font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="p-0.5 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600">
          <div className="bg-white dark:bg-zinc-900 p-0.5 rounded-full">
            <Avatar src={accountAvatar} name={name} color="#E4405F" size={32} />
          </div>
        </div>
        <span className="font-semibold text-[13px] text-zinc-900 dark:text-zinc-100">
          {handle}
        </span>
        <button className="ml-auto">
          <MoreHorizontal className="h-5 w-5 text-zinc-500" />
        </button>
      </div>

      {/* Image */}
      {mediaUrls && mediaUrls.length > 0 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrls[0]}
          alt="post"
          className="w-full aspect-square object-cover"
        />
      ) : (
        <div className="w-full aspect-square bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center">
          <span className="text-zinc-400 text-sm">No image</span>
        </div>
      )}

      {/* Actions */}
      <div className="px-3 pt-2.5 space-y-2">
        <div className="flex items-center gap-3">
          <Heart className="h-6 w-6 text-zinc-700 dark:text-zinc-300 hover:text-red-500 cursor-pointer" />
          <MessageCircle className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />
          <Send className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />
          <Bookmark className="h-6 w-6 ml-auto text-zinc-700 dark:text-zinc-300" />
        </div>
        <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
          0 likes
        </p>
        <p className="text-[13px] text-zinc-900 dark:text-zinc-100">
          <span className="font-semibold mr-1">{handle}</span>
          {caption}
        </p>
        <p className="text-[11px] text-zinc-400 uppercase pb-2">just now</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Facebook preview
// ---------------------------------------------------------------------------

function FacebookCard({
  content,
  mediaUrls,
  accountName,
  accountAvatar,
}: {
  content: string;
  mediaUrls?: string[];
  accountName?: string;
  accountAvatar?: string;
}) {
  const name = accountName ?? "Your Page";
  const text = truncateContent(content, "facebook");

  return (
    <div className="rounded-lg border bg-white dark:bg-zinc-900 max-w-[520px] shadow-sm font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-2">
        <Avatar src={accountAvatar} name={name} color="#1877F2" size={40} />
        <div>
          <p className="font-semibold text-[14px] text-zinc-900 dark:text-zinc-100">
            {name}
          </p>
          <p className="text-xs text-zinc-500 flex items-center gap-1">
            just now · <Globe className="h-3 w-3" />
          </p>
        </div>
        <button className="ml-auto">
          <MoreHorizontal className="h-5 w-5 text-zinc-400" />
        </button>
      </div>

      {/* Content */}
      <p className="px-4 pb-3 text-[14px] text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-line">
        {text}
      </p>

      {/* Photo/link card */}
      {mediaUrls && mediaUrls.length > 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrls[0]}
          alt="media"
          className="w-full max-h-64 object-cover"
        />
      )}

      {/* Reaction summary */}
      <div className="px-4 py-2 flex items-center justify-between text-xs text-zinc-500 border-b">
        <span>👍 ❤️ 0</span>
        <span>0 comments · 0 shares</span>
      </div>

      {/* Action buttons */}
      <div className="flex">
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageCircle, label: "Comment" },
          { icon: Share2, label: "Share" },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[13px] text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors font-medium"
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic fallback
// ---------------------------------------------------------------------------

function GenericCard({
  platform,
  content,
  mediaUrls,
  accountName,
  accountAvatar,
}: {
  platform: SocialAccount["platform"];
  content: string;
  mediaUrls?: string[];
  accountName?: string;
  accountAvatar?: string;
}) {
  const color = PLATFORM_COLORS[platform] ?? "#6b7280";
  const name = accountName ?? "Your Account";
  const text = truncateContent(content, platform);

  return (
    <div className="rounded-xl border bg-white dark:bg-zinc-900 max-w-[500px] shadow-sm overflow-hidden font-sans">
      <div className="h-1" style={{ backgroundColor: color }} />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Avatar src={accountAvatar} name={name} color={color} size={36} />
          <div>
            <p className="font-semibold text-[14px] text-zinc-900 dark:text-zinc-100">
              {name}
            </p>
            <Badge
              variant="outline"
              className="text-[11px] capitalize"
              style={{ borderColor: color }}
            >
              {PLATFORM_LABELS[platform] ?? platform}
            </Badge>
          </div>
        </div>
        <p className="text-[14px] text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-line">
          {text}
        </p>
        {mediaUrls && mediaUrls.length > 0 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrls[0]}
            alt="media"
            className="w-full max-h-52 object-cover rounded-lg"
          />
        )}
        <div className="flex items-center gap-4 text-xs text-zinc-500 pt-1">
          <span className="flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" /> 0
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" /> 0
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" /> 0
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Platform router — dispatches to the right card component
// ---------------------------------------------------------------------------

function PlatformCard({
  platform,
  content,
  mediaUrls,
  accountName,
  accountAvatar,
}: {
  platform: SocialAccount["platform"];
  content: string;
  mediaUrls?: string[];
  accountName?: string;
  accountAvatar?: string;
}) {
  const props = { content, mediaUrls, accountName, accountAvatar };
  switch (platform) {
    case "twitter":
      return <TwitterCard {...props} />;
    case "linkedin":
      return <LinkedInCard {...props} />;
    case "instagram":
      return <InstagramCard {...props} />;
    case "facebook":
      return <FacebookCard {...props} />;
    default:
      return <GenericCard platform={platform} {...props} />;
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function PlatformPreview({
  platforms,
  content,
  mediaUrls,
  accountName,
  accountAvatar,
}: PlatformPreviewProps) {
  if (platforms.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
        Select platforms to preview
      </div>
    );
  }

  if (platforms.length === 1) {
    return (
      <PlatformCard
        platform={platforms[0]}
        content={content}
        mediaUrls={mediaUrls}
        accountName={accountName}
        accountAvatar={accountAvatar}
      />
    );
  }

  return (
    <Tabs defaultValue={platforms[0]}>
      <TabsList className="flex-wrap h-auto gap-1 mb-4">
        {platforms.map((p) => (
          <TabsTrigger key={p} value={p} className="capitalize text-xs">
            {PLATFORM_LABELS[p] ?? p}
          </TabsTrigger>
        ))}
      </TabsList>
      {platforms.map((p) => (
        <TabsContent key={p} value={p}>
          <PlatformCard
            platform={p}
            content={content}
            mediaUrls={mediaUrls}
            accountName={accountName}
            accountAvatar={accountAvatar}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
