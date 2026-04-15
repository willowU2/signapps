import { SocialAccount } from "@/lib/api/social";

export const PLATFORM_COLORS: Record<SocialAccount["platform"], string> = {
  twitter: "#000000",
  facebook: "#1877F2",
  instagram: "#E4405F",
  linkedin: "#0A66C2",
  tiktok: "#000000",
  youtube: "#FF0000",
  pinterest: "#E60023",
  threads: "#000000",
  mastodon: "#6364FF",
  bluesky: "#0085FF",
};

export const PLATFORM_LABELS: Record<SocialAccount["platform"], string> = {
  twitter: "Twitter / X",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  pinterest: "Pinterest",
  threads: "Threads",
  mastodon: "Mastodon",
  bluesky: "Bluesky",
};

export const PLATFORM_CHAR_LIMITS: Record<SocialAccount["platform"], number> = {
  twitter: 280,
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  tiktok: 2200,
  youtube: 5000,
  pinterest: 500,
  threads: 500,
  mastodon: 500,
  bluesky: 300,
};

export function getPlatformColor(platform: SocialAccount["platform"]): string {
  return PLATFORM_COLORS[platform] ?? "#6b7280";
}

export function getPlatformCharLimit(
  platform: SocialAccount["platform"],
): number {
  return PLATFORM_CHAR_LIMITS[platform] ?? 280;
}

export function getCharLimitColor(current: number, limit: number): string {
  const ratio = current / limit;
  if (ratio < 0.8) return "text-green-500";
  if (ratio < 0.95) return "text-yellow-500";
  return "text-red-500";
}

export const ALL_PLATFORMS: SocialAccount["platform"][] = [
  "twitter",
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
  "youtube",
  "pinterest",
  "threads",
  "mastodon",
  "bluesky",
];
