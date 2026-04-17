"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  RefreshCw,
  Users,
  TrendingUp,
  MessageSquare,
  BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { useSocialStore } from "@/stores/social-store";

const STORAGE_KEY = "signapps_competitors";

const PLATFORMS = [
  "twitter",
  "instagram",
  "linkedin",
  "facebook",
  "mastodon",
  "bluesky",
];

const PLATFORM_COLORS: Record<string, string> = {
  twitter: "#1DA1F2",
  instagram: "#E4405F",
  linkedin: "#0A66C2",
  facebook: "#1877F2",
  mastodon: "#6364FF",
  bluesky: "#0085FF",
  youtube: "#FF0000",
  tiktok: "#000000",
  pinterest: "#E60023",
};

interface Competitor {
  id: string;
  handle: string;
  platform: string;
  followers: number;
  postsPerWeek: number;
  avgEngagement: number;
  topPostPreview: string;
  lastUpdated: string;
}

function loadCompetitors(): Competitor[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveCompetitors(list: Competitor[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function CompetitorTracker() {
  const { analytics } = useSocialStore();
  const [competitors, setCompetitors] = useState<Competitor[]>(loadCompetitors);
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState("twitter");
  const [followers, setFollowers] = useState("");
  const [postsPerWeek, setPostsPerWeek] = useState("");
  const [avgEngagement, setAvgEngagement] = useState("");
  const [topPostPreview, setTopPostPreview] = useState("");

  const addCompetitor = () => {
    if (!handle.trim()) {
      toast.error("Handle is required");
      return;
    }
    const c: Competitor = {
      id: Date.now().toString(),
      handle: handle.trim(),
      platform,
      followers: Number(followers) || 0,
      postsPerWeek: Number(postsPerWeek) || 0,
      avgEngagement: Number(avgEngagement) || 0,
      topPostPreview: topPostPreview.trim(),
      lastUpdated: new Date().toISOString().split("T")[0],
    };
    const next = [...competitors, c];
    setCompetitors(next);
    saveCompetitors(next);
    setHandle("");
    setFollowers("");
    setPostsPerWeek("");
    setAvgEngagement("");
    setTopPostPreview("");
    toast.success(`Competitor ${c.handle} added`);
  };

  const removeCompetitor = (id: string) => {
    const next = competitors.filter((c) => c.id !== id);
    setCompetitors(next);
    saveCompetitors(next);
    toast.success("Competitor removed");
  };

  // Build chart data comparing our metrics vs competitors
  const chartData = [
    {
      name: "You",
      followers: analytics?.totalFollowers ?? 0,
      engagement: analytics?.engagementRate ?? 0,
      postsPerWeek: analytics?.postsThisWeek ?? 0,
    },
    ...competitors.map((c) => ({
      name: c.handle,
      followers: c.followers,
      engagement: c.avgEngagement,
      postsPerWeek: c.postsPerWeek,
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Competitor Tracking</h2>
        <p className="text-sm text-muted-foreground">
          Monitor competitor accounts and compare metrics side by side
        </p>
      </div>

      {/* Add competitor form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Competitor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Handle / Account name</Label>
              <Input
                placeholder="@rivalcorp"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Followers</Label>
              <Input
                type="number"
                placeholder="12400"
                value={followers}
                onChange={(e) => setFollowers(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Posts per week</Label>
              <Input
                type="number"
                placeholder="7"
                value={postsPerWeek}
                onChange={(e) => setPostsPerWeek(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Avg engagement rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="3.5"
                value={avgEngagement}
                onChange={(e) => setAvgEngagement(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Top post preview (optional)</Label>
              <Input
                placeholder="Their best performing post…"
                value={topPostPreview}
                onChange={(e) => setTopPostPreview(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <Button size="sm" onClick={addCompetitor} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Competitor
          </Button>
        </CardContent>
      </Card>

      {/* Competitor cards */}
      {competitors.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitors.map((c) => (
            <Card key={c.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{c.handle}</span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full text-white capitalize"
                        style={{
                          backgroundColor:
                            PLATFORM_COLORS[c.platform] ?? "#6b7280",
                        }}
                      >
                        {c.platform}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Updated {c.lastUpdated}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeCompetitor(c.id)}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <Users className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm font-semibold">
                      {c.followers.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Followers</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <MessageSquare className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm font-semibold">{c.postsPerWeek}/wk</p>
                    <p className="text-xs text-muted-foreground">Posts</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <TrendingUp className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm font-semibold">{c.avgEngagement}%</p>
                    <p className="text-xs text-muted-foreground">Engagement</p>
                  </div>
                </div>

                {c.topPostPreview && (
                  <p className="text-xs text-muted-foreground mt-3 italic line-clamp-2">
                    &ldquo;{c.topPostPreview}&rdquo;
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Comparison chart */}
      {competitors.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart2 className="w-4 h-4" />
              Comparison — Followers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="followers" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Engagement comparison */}
      {competitors.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Comparison — Engagement Rate (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: unknown) => `${v}%`} />
                <Bar
                  dataKey="engagement"
                  fill="#10b981"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {competitors.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No competitors tracked yet</p>
          <p className="text-sm mt-1">
            Add competitor accounts above to start comparing
          </p>
        </div>
      )}
    </div>
  );
}
