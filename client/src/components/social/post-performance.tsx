"use client";

import { Eye, Heart, MessageCircle, Share2, MousePointer, Users, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip as RechartTooltip,
} from "recharts";

const PLATFORM_COLORS: Record<string, string> = {
  twitter: "#1DA1F2",
  facebook: "#1877F2",
  instagram: "#E4405F",
  linkedin: "#0A66C2",
  mastodon: "#6364FF",
  bluesky: "#0085FF",
};

interface EngagementPoint {
  time: string;
  value: number;
}

interface PostMetrics {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
}

interface PostPerformanceProps {
  postId: string;
  platform: string;
  content: string;
  publishedAt: string;
  metrics: PostMetrics;
  engagementTimeline?: EngagementPoint[];
  accountAverage?: PostMetrics;
}

function delta(value: number, avg: number): { pct: number; up: boolean } {
  if (!avg) return { pct: 0, up: true };
  const pct = Math.round(((value - avg) / avg) * 100);
  return { pct: Math.abs(pct), up: pct >= 0 };
}

function MetricChip({
  icon: Icon,
  label,
  value,
  avg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  avg?: number;
}) {
  const { pct, up } = avg !== undefined ? delta(value, avg) : { pct: 0, up: true };
  return (
    <div className="flex flex-col gap-0.5 p-2 rounded-md bg-muted/40 min-w-[72px]">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className="w-3 h-3" />
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-sm font-semibold">{value.toLocaleString()}</span>
      {avg !== undefined && (
        <span className={`text-xs flex items-center gap-0.5 ${up ? "text-green-600" : "text-red-500"}`}>
          {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          {pct}%
        </span>
      )}
    </div>
  );
}

const DEFAULT_TIMELINE: EngagementPoint[] = Array.from({ length: 12 }, (_, i) => ({
  time: `${i * 2}h`,
  value: Math.floor(Math.random() * 50 + 5 * (12 - i)),
}));

export function PostPerformance({
  postId,
  platform,
  content,
  publishedAt,
  metrics,
  engagementTimeline = DEFAULT_TIMELINE,
  accountAverage,
}: PostPerformanceProps) {
  const color = PLATFORM_COLORS[platform] ?? "#888";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
              style={{ backgroundColor: color }}
            />
            <p className="text-xs line-clamp-2 text-muted-foreground">{content}</p>
          </div>
          <Badge
            variant="outline"
            className="text-xs shrink-0"
            style={{ borderColor: color, color }}
          >
            {platform}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Published {new Date(publishedAt).toLocaleDateString()}
        </p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Sparkline */}
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={engagementTimeline}>
              <defs>
                <linearGradient id={`grad-${postId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#grad-${postId})`}
                dot={false}
              />
              <RechartTooltip
                contentStyle={{ fontSize: "10px", padding: "4px 8px" }}
                formatter={(v) => [v, "engagements"]}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Metrics grid */}
        <div className="flex flex-wrap gap-2">
          <MetricChip
            icon={Eye}
            label="Impressions"
            value={metrics.impressions}
            avg={accountAverage?.impressions}
          />
          <MetricChip
            icon={Users}
            label="Reach"
            value={metrics.reach}
            avg={accountAverage?.reach}
          />
          <MetricChip
            icon={Heart}
            label="Likes"
            value={metrics.likes}
            avg={accountAverage?.likes}
          />
          <MetricChip
            icon={MessageCircle}
            label="Comments"
            value={metrics.comments}
            avg={accountAverage?.comments}
          />
          <MetricChip
            icon={Share2}
            label="Shares"
            value={metrics.shares}
            avg={accountAverage?.shares}
          />
          <MetricChip
            icon={MousePointer}
            label="Clicks"
            value={metrics.clicks}
            avg={accountAverage?.clicks}
          />
        </div>
      </CardContent>
    </Card>
  );
}
