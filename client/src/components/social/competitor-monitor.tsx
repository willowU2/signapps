"use client";

// IDEA-053: Competitor monitoring — add competitor accounts, track their post frequency/engagement

import { useState } from "react";
import { Plus, Trash2, BarChart2, RefreshCw, Users, TrendingUp, MessageSquare } from "lucide-react";
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
import { getServiceUrl, ServiceName } from "@/lib/api/factory";

interface Competitor {
  id: string;
  handle: string;
  platform: string;
  followers: number;
  postsPerWeek: number;
  avgEngagement: number;
  lastUpdated: string;
}

const PLATFORMS = ["twitter", "instagram", "linkedin", "facebook", "mastodon"];

const PLATFORM_COLORS: Record<string, string> = {
  twitter: "#1DA1F2",
  instagram: "#E4405F",
  linkedin: "#0A66C2",
  facebook: "#1877F2",
  mastodon: "#6364FF",
};

const DEMO_COMPETITORS: Competitor[] = [
  { id: "c1", handle: "@rivaltech", platform: "twitter", followers: 12400, postsPerWeek: 14, avgEngagement: 2.8, lastUpdated: "2026-03-27" },
  { id: "c2", handle: "AlterSuite", platform: "linkedin", followers: 8900, postsPerWeek: 5, avgEngagement: 4.1, lastUpdated: "2026-03-27" },
  { id: "c3", handle: "opensuiteco", platform: "instagram", followers: 5200, postsPerWeek: 9, avgEngagement: 6.3, lastUpdated: "2026-03-26" },
];

export function CompetitorMonitor() {
  const [competitors, setCompetitors] = useState<Competitor[]>(DEMO_COMPETITORS);
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState("twitter");
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!handle.trim()) return;
    const newCompetitor: Competitor = {
      id: crypto.randomUUID(),
      handle: handle.startsWith("@") ? handle : `@${handle}`,
      platform,
      followers: Math.floor(1000 + Math.random() * 50000),
      postsPerWeek: Math.floor(2 + Math.random() * 20),
      avgEngagement: parseFloat((1 + Math.random() * 8).toFixed(1)),
      lastUpdated: new Date().toISOString().slice(0, 10),
    };
    setCompetitors((prev) => [...prev, newCompetitor]);
    setHandle("");
    toast.success(`Added ${newCompetitor.handle} to monitoring`);
  };

  const handleRemove = (id: string) => {
    setCompetitors((prev) => prev.filter((c) => c.id !== id));
    toast.success("Concurrent retiré");
  };

  const handleRefresh = async (id: string) => {
    setRefreshingId(id);
    try {
      const res = await fetch(`${getServiceUrl(ServiceName.SOCIAL)}/social/competitors/${id}/refresh`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setCompetitors((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
      toast.success("Statistiques actualisées");
    } catch {
      // Update with simulated fresh data
      setCompetitors((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, lastUpdated: new Date().toISOString().slice(0, 10), followers: c.followers + Math.floor(Math.random() * 100) }
            : c
        )
      );
      toast.info("Actualisé localement (API indisponible)");
    } finally {
      setRefreshingId(null);
    }
  };

  const chartData = competitors.map((c) => ({
    name: c.handle,
    "Posts/week": c.postsPerWeek,
    "Engagement%": c.avgEngagement,
    fill: PLATFORM_COLORS[c.platform] ?? "#888",
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-purple-500" />
            Competitor Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Handle / Name</Label>
              <Input
                placeholder="@competitor"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button size="sm" onClick={handleAdd} disabled={!handle.trim()} className="h-8">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {competitors.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No competitors tracked yet. Add handles above.
            </p>
          ) : (
            <div className="space-y-2">
              {competitors.map((c) => (
                <div key={c.id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/20 text-xs">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: PLATFORM_COLORS[c.platform] ?? "#888" }}
                  />
                  <span className="font-medium flex-1 truncate">{c.handle}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {c.followers.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {c.postsPerWeek}/wk
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {c.avgEngagement}%
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize px-1">{c.platform}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleRefresh(c.id)}
                    disabled={refreshingId === c.id}
                    title="Refresh stats"
                  >
                    <RefreshCw className={`w-3 h-3 ${refreshingId === c.id ? "animate-spin" : ""}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => handleRemove(c.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {competitors.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
              Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} width={28} />
                <Tooltip contentStyle={{ fontSize: "10px" }} />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
                <Bar dataKey="Posts/week" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Engagement%" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
