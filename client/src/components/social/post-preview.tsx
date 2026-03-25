'use client';

import { SocialAccount } from '@/lib/api/social';
import { getPlatformCharLimit, getCharLimitColor, PLATFORM_LABELS } from './platform-utils';
import { Badge } from '@/components/ui/badge';

interface PostPreviewProps {
  platform: SocialAccount['platform'];
  content: string;
  accountName?: string;
  accountAvatar?: string;
  mediaUrls?: string[];
}

export function PostPreview({ platform, content, accountName, accountAvatar, mediaUrls }: PostPreviewProps) {
  const limit = getPlatformCharLimit(platform);
  const charCount = content.length;
  const remaining = limit - charCount;
  const colorClass = getCharLimitColor(charCount, limit);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {accountAvatar ? (
            <img src={accountAvatar} alt={accountName} className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
              {(accountName ?? platform).charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold">{accountName ?? PLATFORM_LABELS[platform]}</p>
            <p className="text-xs text-muted-foreground">@{accountName?.toLowerCase().replace(/\s+/g, '') ?? 'handle'}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs capitalize">{platform}</Badge>
      </div>

      {content ? (
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">No content yet…</p>
      )}

      {mediaUrls && mediaUrls.length > 0 && (
        <div className={`grid gap-1 ${mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {mediaUrls.slice(0, 4).map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`Media ${i + 1}`}
              className="w-full h-32 object-cover rounded-lg"
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t">
        <span className="text-xs text-muted-foreground">{charCount} characters</span>
        <span className={`text-xs font-medium ${colorClass}`}>
          {remaining >= 0 ? `${remaining} remaining` : `${Math.abs(remaining)} over limit`}
        </span>
      </div>

      {platform === 'twitter' && (
        <div className="flex items-center gap-4 text-muted-foreground text-xs pt-1">
          <span>💬 Reply</span>
          <span>🔁 Repost</span>
          <span>❤️ Like</span>
          <span>📤 Share</span>
        </div>
      )}
      {platform === 'linkedin' && (
        <div className="flex items-center gap-4 text-muted-foreground text-xs pt-1">
          <span>👍 Like</span>
          <span>💬 Comment</span>
          <span>🔁 Repost</span>
          <span>📤 Send</span>
        </div>
      )}
      {(platform === 'mastodon' || platform === 'bluesky') && (
        <div className="flex items-center gap-4 text-muted-foreground text-xs pt-1">
          <span>💬 Reply</span>
          <span>🔁 Boost</span>
          <span>⭐ Favourite</span>
          <span>📤 Share</span>
        </div>
      )}
    </div>
  );
}
