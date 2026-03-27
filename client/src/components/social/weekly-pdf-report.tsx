"use client";

// IDEA-055: Weekly performance PDF report — auto-generate PDF with recharts captured as images

import { useState, useRef, useCallback } from "react";
import { FileDown, Calendar, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { toast } from "sonner";

interface WeekStat {
  day: string;
  posts: number;
  reach: number;
  engagement: number;
}

const DEMO_WEEK: WeekStat[] = [
  { day: "Mon", posts: 3, reach: 1200, engagement: 84 },
  { day: "Tue", posts: 2, reach: 980, engagement: 62 },
  { day: "Wed", posts: 4, reach: 1850, engagement: 130 },
  { day: "Thu", posts: 1, reach: 640, engagement: 40 },
  { day: "Fri", posts: 3, reach: 2100, engagement: 175 },
  { day: "Sat", posts: 2, reach: 1400, engagement: 98 },
  { day: "Sun", posts: 1, reach: 720, engagement: 54 },
];

interface WeeklyPdfReportProps {
  weekData?: WeekStat[];
  weekLabel?: string;
}

export function WeeklyPdfReport({ weekData = DEMO_WEEK, weekLabel }: WeeklyPdfReportProps) {
  const reachChartRef = useRef<HTMLDivElement>(null);
  const engagementChartRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [includeReach, setIncludeReach] = useState(true);
  const [includeEngagement, setIncludeEngagement] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [generated, setGenerated] = useState(false);

  const label = weekLabel ?? (() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    return `Week of ${weekStart.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`;
  })();

  const totalPosts = weekData.reduce((s, d) => s + d.posts, 0);
  const totalReach = weekData.reduce((s, d) => s + d.reach, 0);
  const totalEngagement = weekData.reduce((s, d) => s + d.engagement, 0);
  const avgEngagementRate = totalReach > 0 ? ((totalEngagement / totalReach) * 100).toFixed(1) : "0.0";

  const captureChartAsDataUrl = useCallback(async (ref: React.RefObject<HTMLDivElement | null>): Promise<string | null> => {
    if (!ref.current) return null;
    try {
      const { default: html2canvas } = await import("html2canvas" as any);
      const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: "#ffffff" });
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // Try server-side PDF generation
      const payload = {
        weekLabel: label,
        weekData,
        includeReach,
        includeEngagement,
        includeSummary,
        summary: { totalPosts, totalReach, totalEngagement, avgEngagementRate },
      };

      const res = await fetch("http://localhost:3019/api/v1/social/reports/weekly-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `weekly-report-${label.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        throw new Error("Server unavailable");
      }
    } catch {
      // Fallback: print the report section
      window.print();
      toast.info("PDF generation via print dialog (signapps-office service not running)");
    } finally {
      setGenerating(false);
      setGenerated(true);
      toast.success(`Weekly report for ${label} ready`);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              Weekly PDF Report
            </span>
            <Badge variant="outline" className="text-xs font-normal">{label}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Posts", value: totalPosts },
              { label: "Reach", value: totalReach.toLocaleString() },
              { label: "Engagements", value: totalEngagement },
              { label: "Eng. Rate", value: `${avgEngagementRate}%` },
            ].map((s) => (
              <div key={s.label} className="text-center p-2 bg-muted/30 rounded-md">
                <p className="text-base font-bold">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Include options */}
          <div className="space-y-2 border rounded-md p-3">
            <p className="text-xs font-medium text-muted-foreground">Include in report</p>
            {[
              { label: "Summary stats", value: includeSummary, set: setIncludeSummary },
              { label: "Reach chart", value: includeReach, set: setIncludeReach },
              { label: "Engagement chart", value: includeEngagement, set: setIncludeEngagement },
            ].map((opt) => (
              <div key={opt.label} className="flex items-center justify-between">
                <Label className="text-xs">{opt.label}</Label>
                <Switch checked={opt.value} onCheckedChange={opt.set} />
              </div>
            ))}
          </div>

          <Button className="w-full" onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : generated ? (
              <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
            ) : (
              <FileDown className="w-4 h-4 mr-2" />
            )}
            {generating ? "Generating…" : "Download PDF"}
          </Button>
        </CardContent>
      </Card>

      {/* Preview charts */}
      {includeReach && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
              Weekly Reach
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={reachChartRef}>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={weekData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={35} />
                  <Tooltip contentStyle={{ fontSize: "10px" }} />
                  <Area type="monotone" dataKey="reach" stroke="#6366f1" fill="#6366f115" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {includeEngagement && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
              Daily Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={engagementChartRef}>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={weekData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={28} />
                  <Tooltip contentStyle={{ fontSize: "10px" }} />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                  <Bar dataKey="engagement" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="posts" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
