/* eslint-disable @next/next/no-img-element */
"use client";

import { SocialAccount } from "@/lib/api/social";
import {
  getPlatformCharLimit,
  getCharLimitColor,
  PLATFORM_LABELS,
  PLATFORM_COLORS,
} from "./platform-utils";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Share,
  Bookmark,
  Send,
  ThumbsUp,
  MoreHorizontal,
  Globe,
  Star,
} from "lucide-react";

interface PostPreviewProps {
  platform: SocialAccount["platform"];
  content: string;
  accountName?: string;
  accountAvatar?: string;
  mediaUrls?: string[];
}

function AvatarCircle({
  src,
  fallback,
  bgColor,
  size = 40,
  rounded = true,
}: {
  src?: string;
  fallback: string;
  bgColor: string;
  size?: number;
  rounded?: boolean;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={fallback}
        className={`object-cover shrink-0 ${rounded ? "rounded-full" : "rounded-lg"}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center text-white font-bold shrink-0 ${
        rounded ? "rounded-full" : "rounded-lg"
      }`}
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
        fontSize: size * 0.4,
      }}
    >
      {fallback.charAt(0).toUpperCase()}
    </div>
  );
}

function CharCount({
  content,
  platform,
}: {
  content: string;
  platform: SocialAccount["platform"];
}) {
  const limit = getPlatformCharLimit(platform);
  const charCount = content.length;
  const remaining = limit - charCount;
  const colorClass = getCharLimitColor(charCount, limit);

  return (
    <div className="flex items-center justify-between pt-2 text-xs">
      <span className="opacity-60">{charCount} characters</span>
      <span className={`font-medium ${colorClass}`}>
        {remaining >= 0
          ? `${remaining} remaining`
          : `${Math.abs(remaining)} over limit`}
      </span>
    </div>
  );
}

function MediaGrid({ mediaUrls }: { mediaUrls: string[] }) {
  if (mediaUrls.length === 0) return null;
  return (
    <div
      className={`grid gap-0.5 rounded-xl overflow-hidden ${mediaUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
    >
      {mediaUrls.slice(0, 4).map((url, i) => (
        <img
          key={i}
          src={url}
          alt={`Media ${i + 1}`}
          className="w-full h-40 object-cover"
        />
      ))}
    </div>
  );
}

/* ---------- Twitter / X Preview ---------- */
function TwitterPreview({
  content,
  accountName,
  accountAvatar,
  mediaUrls,
}: Omit<PostPreviewProps, "platform">) {
  const handle = accountName?.toLowerCase().replace(/\s+/g, "") ?? "handle";
  return (
    <div className="rounded-2xl border bg-zinc-950 text-white p-4 space-y-3 font-[system-ui]">
      <div className="flex items-start gap-3">
        <AvatarCircle
          src={accountAvatar}
          fallback={accountName ?? "X"}
          bgColor="#333"
          size={40}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm truncate">
              {accountName ?? "User"}
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 22 22"
              fill="#1D9BF0"
              className="shrink-0"
            >
              <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.143.272.587.706 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.225 1.261.272 1.893.143.636-.131 1.222-.434 1.694-.88.445-.47.749-1.055.878-1.691.13-.635.079-1.294-.146-1.9.588-.274 1.087-.706 1.443-1.246.355-.54.553-1.17.57-1.817z" />
              <path
                d="M9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"
                fill="white"
              />
            </svg>
          </div>
          <span className="text-zinc-500 text-sm">@{handle}</span>
        </div>
        <MoreHorizontal className="h-4 w-4 text-zinc-500 shrink-0" />
      </div>

      {content ? (
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
          {content}
        </p>
      ) : (
        <p className="text-sm text-zinc-600 italic">No content yet...</p>
      )}

      {mediaUrls && mediaUrls.length > 0 && <MediaGrid mediaUrls={mediaUrls} />}

      <div className="flex items-center justify-between text-zinc-500 pt-1">
        <button className="flex items-center gap-1.5 hover:text-blue-400 transition-colors">
          <MessageCircle className="h-[18px] w-[18px]" />
          <span className="text-xs">0</span>
        </button>
        <button className="flex items-center gap-1.5 hover:text-green-400 transition-colors">
          <Repeat2 className="h-[18px] w-[18px]" />
          <span className="text-xs">0</span>
        </button>
        <button className="flex items-center gap-1.5 hover:text-pink-400 transition-colors">
          <Heart className="h-[18px] w-[18px]" />
          <span className="text-xs">0</span>
        </button>
        <button className="flex items-center gap-1.5 hover:text-blue-400 transition-colors">
          <Bookmark className="h-[18px] w-[18px]" />
        </button>
        <button className="flex items-center gap-1.5 hover:text-blue-400 transition-colors">
          <Share className="h-[18px] w-[18px]" />
        </button>
      </div>

      <CharCount content={content} platform="twitter" />
    </div>
  );
}

/* ---------- Mastodon Preview ---------- */
function MastodonPreview({
  content,
  accountName,
  accountAvatar,
  mediaUrls,
}: Omit<PostPreviewProps, "platform">) {
  const handle = accountName?.toLowerCase().replace(/\s+/g, "") ?? "user";
  return (
    <div
      className="rounded-2xl border bg-card p-4 space-y-3 font-[system-ui]"
      style={{ borderColor: "#6364FF30" }}
    >
      {/* Header with purple accent */}
      <div className="flex items-start gap-3">
        <AvatarCircle
          src={accountAvatar}
          fallback={accountName ?? "M"}
          bgColor="#6364FF"
          size={44}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm truncate">
              {accountName ?? "User"}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-[#6364FF]/10 text-[#6364FF] font-medium shrink-0">
              mastodon.social
            </span>
          </div>
          <span className="text-muted-foreground text-sm">
            @{handle}@mastodon.social
          </span>
        </div>
        <MoreHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>

      {content ? (
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
          {content}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No content yet...
        </p>
      )}

      {mediaUrls && mediaUrls.length > 0 && <MediaGrid mediaUrls={mediaUrls} />}

      <div className="flex items-center gap-6 text-muted-foreground pt-1">
        <button className="flex items-center gap-1.5 hover:text-[#6364FF] transition-colors">
          <MessageCircle className="h-[18px] w-[18px]" />
          <span className="text-xs">Reply</span>
        </button>
        <button className="flex items-center gap-1.5 hover:text-blue-500 transition-colors">
          <Repeat2 className="h-[18px] w-[18px]" />
          <span className="text-xs">Boost</span>
        </button>
        <button className="flex items-center gap-1.5 hover:text-yellow-500 transition-colors">
          <Star className="h-[18px] w-[18px]" />
          <span className="text-xs">Favourite</span>
        </button>
        <button className="flex items-center gap-1.5 hover:text-[#6364FF] transition-colors">
          <Bookmark className="h-[18px] w-[18px]" />
        </button>
      </div>

      <CharCount content={content} platform="mastodon" />
    </div>
  );
}

/* ---------- Bluesky Preview ---------- */
function BlueskyPreview({
  content,
  accountName,
  accountAvatar,
  mediaUrls,
}: Omit<PostPreviewProps, "platform">) {
  const handle = accountName?.toLowerCase().replace(/\s+/g, "") ?? "user";
  return (
    <div
      className="rounded-2xl border bg-card p-4 space-y-3 font-[system-ui]"
      style={{ borderColor: "#0085FF20" }}
    >
      <div className="flex items-start gap-3">
        <AvatarCircle
          src={accountAvatar}
          fallback={accountName ?? "B"}
          bgColor="#0085FF"
          size={40}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm truncate">
              {accountName ?? "User"}
            </span>
            {/* Butterfly icon accent */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="#0085FF"
              className="shrink-0"
            >
              <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.785 2.627 3.603 3.496 6.159 3.072-4.476.78-8.4 2.677-3.156 9.44 5.7 6.627 8.188-1.747 8.373-3.31.185 1.563 2.673 9.937 8.373 3.31 5.244-6.763 1.32-8.66-3.156-9.44 2.556.424 5.374-.445 6.16-3.072.245-.829.623-5.789.623-6.479 0-.688-.139-1.86-.902-2.203-.659-.299-1.664-.621-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z" />
            </svg>
          </div>
          <span className="text-muted-foreground text-sm">
            @{handle}.bsky.social
          </span>
        </div>
        <MoreHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>

      {content ? (
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
          {content}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No content yet...
        </p>
      )}

      {mediaUrls && mediaUrls.length > 0 && <MediaGrid mediaUrls={mediaUrls} />}

      <div className="flex items-center gap-6 text-muted-foreground pt-1">
        <button className="flex items-center gap-1.5 hover:text-[#0085FF] transition-colors">
          <MessageCircle className="h-[18px] w-[18px]" />
          <span className="text-xs">0</span>
        </button>
        <button className="flex items-center gap-1.5 hover:text-green-500 transition-colors">
          <Repeat2 className="h-[18px] w-[18px]" />
          <span className="text-xs">Repost</span>
        </button>
        <button className="flex items-center gap-1.5 hover:text-pink-500 transition-colors">
          <Heart className="h-[18px] w-[18px]" />
          <span className="text-xs">0</span>
        </button>
        <button className="flex items-center gap-1.5 hover:text-[#0085FF] transition-colors">
          <Share className="h-[18px] w-[18px]" />
        </button>
      </div>

      <CharCount content={content} platform="bluesky" />
    </div>
  );
}

/* ---------- LinkedIn Preview ---------- */
function LinkedInPreview({
  content,
  accountName,
  accountAvatar,
  mediaUrls,
}: Omit<PostPreviewProps, "platform">) {
  return (
    <div className="rounded-2xl border bg-card dark:bg-zinc-50 text-zinc-900 space-y-0 font-[system-ui] overflow-hidden">
      {/* Post header */}
      <div className="p-4 pb-2">
        <div className="flex items-start gap-3">
          <AvatarCircle
            src={accountAvatar}
            fallback={accountName ?? "L"}
            bgColor="#0A66C2"
            size={48}
          />
          <div className="flex-1 min-w-0">
            <span className="font-bold text-sm">
              {accountName ?? "Professional User"}
            </span>
            <p className="text-xs text-zinc-500 leading-tight mt-0.5">
              Title at Company
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-xs text-zinc-400">Just now</span>
              <span className="text-xs text-zinc-400">&middot;</span>
              <Globe className="h-3 w-3 text-zinc-400" />
            </div>
          </div>
          <MoreHorizontal className="h-5 w-5 text-zinc-400 shrink-0" />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        {content ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        ) : (
          <p className="text-sm text-zinc-400 italic">No content yet...</p>
        )}
      </div>

      {mediaUrls && mediaUrls.length > 0 && <MediaGrid mediaUrls={mediaUrls} />}

      {/* Reactions row */}
      <div className="px-4 py-2 flex items-center gap-1 border-b border-zinc-200">
        <div className="flex -space-x-1">
          <span className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white text-[8px]">
            <ThumbsUp className="h-2.5 w-2.5" />
          </span>
          <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-[8px]">
            <Heart className="h-2.5 w-2.5" />
          </span>
        </div>
        <span className="text-xs text-zinc-500 ml-1">0</span>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-around px-2 py-1.5">
        <button className="flex items-center gap-1.5 px-3 py-2 rounded hover:bg-zinc-100 transition-colors text-zinc-600">
          <ThumbsUp className="h-4 w-4" />
          <span className="text-xs font-medium">Like</span>
        </button>
        <button className="flex items-center gap-1.5 px-3 py-2 rounded hover:bg-zinc-100 transition-colors text-zinc-600">
          <MessageCircle className="h-4 w-4" />
          <span className="text-xs font-medium">Comment</span>
        </button>
        <button className="flex items-center gap-1.5 px-3 py-2 rounded hover:bg-zinc-100 transition-colors text-zinc-600">
          <Repeat2 className="h-4 w-4" />
          <span className="text-xs font-medium">Repost</span>
        </button>
        <button className="flex items-center gap-1.5 px-3 py-2 rounded hover:bg-zinc-100 transition-colors text-zinc-600">
          <Send className="h-4 w-4" />
          <span className="text-xs font-medium">Send</span>
        </button>
      </div>

      <div className="px-4 pb-3">
        <CharCount content={content} platform="linkedin" />
      </div>
    </div>
  );
}

/* ---------- Facebook Preview ---------- */
function FacebookPreview({
  content,
  accountName,
  accountAvatar,
  mediaUrls,
}: Omit<PostPreviewProps, "platform">) {
  return (
    <div className="rounded-2xl border bg-card dark:bg-zinc-50 text-zinc-900 space-y-0 font-[system-ui] overflow-hidden">
      {/* Header */}
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          <AvatarCircle
            src={accountAvatar}
            fallback={accountName ?? "F"}
            bgColor="#1877F2"
            size={40}
          />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-sm">
              {accountName ?? "User"}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-zinc-500">Just now</span>
              <span className="text-xs text-zinc-400">&middot;</span>
              <Globe className="h-3 w-3 text-zinc-400" />
            </div>
          </div>
          <MoreHorizontal className="h-5 w-5 text-zinc-400 shrink-0" />
        </div>
      </div>

      {/* Content */}
      <div className="px-3 pb-3">
        {content ? (
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        ) : (
          <p className="text-sm text-zinc-400 italic">No content yet...</p>
        )}
      </div>

      {mediaUrls && mediaUrls.length > 0 && <MediaGrid mediaUrls={mediaUrls} />}

      {/* Reaction summary */}
      <div className="mx-3 py-2 flex items-center justify-between border-b border-zinc-200">
        <div className="flex items-center gap-1">
          <div className="flex -space-x-0.5">
            <span className="w-[18px] h-[18px] rounded-full bg-blue-600 flex items-center justify-center text-white text-[9px] ring-1 ring-white">
              <ThumbsUp className="h-2.5 w-2.5" />
            </span>
            <span className="w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center text-white text-[9px] ring-1 ring-white">
              <Heart className="h-2.5 w-2.5" />
            </span>
          </div>
          <span className="text-xs text-zinc-500 ml-1">0</span>
        </div>
        <span className="text-xs text-zinc-500">0 comments</span>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-around px-2 py-1">
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-md hover:bg-zinc-100 transition-colors text-zinc-600">
          <ThumbsUp className="h-4 w-4" />
          <span className="text-sm font-medium">Like</span>
        </button>
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-md hover:bg-zinc-100 transition-colors text-zinc-600">
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Comment</span>
        </button>
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-md hover:bg-zinc-100 transition-colors text-zinc-600">
          <Share className="h-4 w-4" />
          <span className="text-sm font-medium">Share</span>
        </button>
      </div>

      <div className="px-3 pb-3">
        <CharCount content={content} platform="facebook" />
      </div>
    </div>
  );
}

/* ---------- Instagram Preview ---------- */
function InstagramPreview({
  content,
  accountName,
  accountAvatar,
  mediaUrls,
}: Omit<PostPreviewProps, "platform">) {
  const handle = accountName?.toLowerCase().replace(/\s+/g, "") ?? "handle";
  return (
    <div className="rounded-2xl border bg-card dark:bg-zinc-50 text-zinc-900 space-y-0 font-[system-ui] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 p-3">
        <AvatarCircle
          src={accountAvatar}
          fallback={accountName ?? "I"}
          bgColor="#E4405F"
          size={32}
        />
        <span className="text-sm font-semibold flex-1">{handle}</span>
        <MoreHorizontal className="h-5 w-5 text-zinc-400" />
      </div>

      {/* Media area */}
      {mediaUrls && mediaUrls.length > 0 ? (
        <div className="aspect-square bg-zinc-100 overflow-hidden">
          <img
            src={mediaUrls[0]}
            alt="Post media"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="aspect-square bg-gradient-to-br from-purple-100 via-pink-50 to-orange-100 flex items-center justify-center">
          <div className="text-center text-zinc-400">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mx-auto mb-2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span className="text-xs">Image preview</span>
          </div>
        </div>
      )}

      {/* Action icons */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-4">
          <button className="hover:text-zinc-400 transition-colors">
            <Heart className="h-6 w-6" />
          </button>
          <button className="hover:text-zinc-400 transition-colors">
            <MessageCircle className="h-6 w-6" />
          </button>
          <button className="hover:text-zinc-400 transition-colors">
            <Send className="h-6 w-6" />
          </button>
        </div>
        <button className="hover:text-zinc-400 transition-colors">
          <Bookmark className="h-6 w-6" />
        </button>
      </div>

      {/* Likes */}
      <div className="px-3">
        <p className="text-sm font-semibold">0 likes</p>
      </div>

      {/* Caption */}
      <div className="px-3 pb-3 pt-1">
        {content ? (
          <p className="text-sm">
            <span className="font-semibold mr-1">{handle}</span>
            <span className="whitespace-pre-wrap">{content}</span>
          </p>
        ) : (
          <p className="text-sm text-zinc-400 italic">Write a caption...</p>
        )}
      </div>

      <div className="px-3 pb-3">
        <CharCount content={content} platform="instagram" />
      </div>
    </div>
  );
}

/* ---------- TikTok Preview ---------- */
function TikTokPreview({
  content,
  accountName,
  accountAvatar,
  mediaUrls,
}: Omit<PostPreviewProps, "platform">) {
  const handle = accountName?.toLowerCase().replace(/\s+/g, "") ?? "user";
  return (
    <div className="rounded-2xl border bg-zinc-950 text-white p-4 space-y-3 font-[system-ui]">
      <div className="flex items-start gap-3">
        <AvatarCircle
          src={accountAvatar}
          fallback={accountName ?? "T"}
          bgColor="#010101"
          size={40}
        />
        <div className="flex-1 min-w-0">
          <span className="font-bold text-sm">@{handle}</span>
        </div>
        <button className="text-xs px-3 py-1 rounded-sm border border-[#FE2C55] text-[#FE2C55] font-semibold shrink-0">
          Follow
        </button>
      </div>

      {mediaUrls && mediaUrls.length > 0 ? (
        <div className="aspect-[9/16] max-h-48 bg-zinc-900 rounded-lg overflow-hidden">
          <img
            src={mediaUrls[0]}
            alt="Video thumbnail"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="aspect-[9/16] max-h-48 bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-600 text-xs">
          Video
        </div>
      )}

      {content ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
      ) : (
        <p className="text-sm text-zinc-600 italic">Video description...</p>
      )}

      <div className="flex items-center gap-4 text-zinc-400">
        <button className="flex items-center gap-1 hover:text-[#FE2C55] transition-colors">
          <Heart className="h-5 w-5" />
          <span className="text-xs">0</span>
        </button>
        <button className="flex items-center gap-1 hover:text-white transition-colors">
          <MessageCircle className="h-5 w-5" />
          <span className="text-xs">0</span>
        </button>
        <button className="flex items-center gap-1 hover:text-white transition-colors">
          <Share className="h-5 w-5" />
          <span className="text-xs">0</span>
        </button>
      </div>
      <CharCount content={content} platform="tiktok" />
    </div>
  );
}

/* ---------- YouTube Preview ---------- */
function YouTubePreview({
  content,
  accountName,
  accountAvatar,
  mediaUrls,
}: Omit<PostPreviewProps, "platform">) {
  const title = content.length > 100 ? content.slice(0, 97) + "..." : content;
  return (
    <div className="rounded-2xl border bg-zinc-950 text-white p-4 space-y-3 font-[system-ui]">
      {mediaUrls && mediaUrls.length > 0 ? (
        <div className="aspect-video bg-zinc-900 rounded-lg overflow-hidden">
          <img
            src={mediaUrls[0]}
            alt="Video thumbnail"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="aspect-video bg-zinc-900 rounded-lg flex items-center justify-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="#FF0000">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        </div>
      )}
      {content ? (
        <p className="text-sm font-semibold leading-tight">{title}</p>
      ) : (
        <p className="text-sm text-zinc-500 italic">
          Video title / description...
        </p>
      )}
      <div className="flex items-center gap-2.5">
        <AvatarCircle
          src={accountAvatar}
          fallback={accountName ?? "Y"}
          bgColor="#FF0000"
          size={32}
        />
        <span className="text-xs text-zinc-400">
          {accountName ?? "Channel"}
        </span>
      </div>
      <div className="flex items-center gap-4 text-zinc-400">
        <button className="flex items-center gap-1 hover:text-white transition-colors">
          <ThumbsUp className="h-4 w-4" />
          <span className="text-xs">0</span>
        </button>
        <button className="flex items-center gap-1 hover:text-white transition-colors">
          <Share className="h-4 w-4" />
          <span className="text-xs">Share</span>
        </button>
        <button className="flex items-center gap-1 hover:text-white transition-colors">
          <Bookmark className="h-4 w-4" />
          <span className="text-xs">Enregistrer</span>
        </button>
      </div>
      <CharCount content={content} platform="youtube" />
    </div>
  );
}

/* ---------- Pinterest Preview ---------- */
function PinterestPreview({
  content,
  accountName,
  accountAvatar,
  mediaUrls,
}: Omit<PostPreviewProps, "platform">) {
  return (
    <div className="rounded-2xl border bg-card dark:bg-zinc-50 text-zinc-900 font-[system-ui] overflow-hidden">
      {mediaUrls && mediaUrls.length > 0 ? (
        <div className="aspect-[2/3] bg-zinc-100 overflow-hidden">
          <img
            src={mediaUrls[0]}
            alt="Pin image"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="aspect-[2/3] bg-gradient-to-b from-[#E60023]/10 to-[#E60023]/5 flex items-center justify-center text-[#E60023] text-xs">
          Pin image
        </div>
      )}
      <div className="p-3 space-y-2">
        {content ? (
          <p className="text-sm font-semibold leading-tight">
            {content.slice(0, 100)}
            {content.length > 100 ? "…" : ""}
          </p>
        ) : (
          <p className="text-sm text-zinc-400 italic">Pin description...</p>
        )}
        <div className="flex items-center gap-2">
          <AvatarCircle
            src={accountAvatar}
            fallback={accountName ?? "P"}
            bgColor="#E60023"
            size={24}
          />
          <span className="text-xs text-zinc-500">
            {accountName ?? "Creator"}
          </span>
        </div>
      </div>
      <div className="px-3 pb-3">
        <CharCount content={content} platform="pinterest" />
      </div>
    </div>
  );
}

/* ---------- Threads Preview ---------- */
function ThreadsPreview({
  content,
  accountName,
  accountAvatar,
  mediaUrls,
}: Omit<PostPreviewProps, "platform">) {
  const handle = accountName?.toLowerCase().replace(/\s+/g, "") ?? "user";
  return (
    <div className="rounded-2xl border bg-zinc-950 text-white p-4 space-y-3 font-[system-ui]">
      <div className="flex items-start gap-3">
        <AvatarCircle
          src={accountAvatar}
          fallback={accountName ?? "T"}
          bgColor="#1a1a1a"
          size={40}
        />
        <div className="flex-1 min-w-0">
          <span className="font-bold text-sm">@{handle}</span>
          <span className="text-zinc-500 text-xs ml-1.5">Just now</span>
        </div>
        <MoreHorizontal className="h-4 w-4 text-zinc-500 shrink-0" />
      </div>

      {content ? (
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
          {content}
        </p>
      ) : (
        <p className="text-sm text-zinc-600 italic">Start a thread...</p>
      )}

      {mediaUrls && mediaUrls.length > 0 && <MediaGrid mediaUrls={mediaUrls} />}

      <div className="flex items-center gap-5 text-zinc-400">
        <button className="hover:text-white transition-colors">
          <Heart className="h-[18px] w-[18px]" />
        </button>
        <button className="hover:text-white transition-colors">
          <MessageCircle className="h-[18px] w-[18px]" />
        </button>
        <button className="hover:text-white transition-colors">
          <Repeat2 className="h-[18px] w-[18px]" />
        </button>
        <button className="hover:text-white transition-colors">
          <Share className="h-[18px] w-[18px]" />
        </button>
      </div>

      <CharCount content={content} platform="threads" />
    </div>
  );
}

/* ---------- Main Export ---------- */
export function PostPreview({
  platform,
  content,
  accountName,
  accountAvatar,
  mediaUrls,
}: PostPreviewProps) {
  const props = { content, accountName, accountAvatar, mediaUrls };

  switch (platform) {
    case "twitter":
      return <TwitterPreview {...props} />;
    case "mastodon":
      return <MastodonPreview {...props} />;
    case "bluesky":
      return <BlueskyPreview {...props} />;
    case "linkedin":
      return <LinkedInPreview {...props} />;
    case "facebook":
      return <FacebookPreview {...props} />;
    case "instagram":
      return <InstagramPreview {...props} />;
    case "tiktok":
      return <TikTokPreview {...props} />;
    case "youtube":
      return <YouTubePreview {...props} />;
    case "pinterest":
      return <PinterestPreview {...props} />;
    case "threads":
      return <ThreadsPreview {...props} />;
    default:
      return <TwitterPreview {...props} />;
  }
}
