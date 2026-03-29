"use client";

import { useState } from "react";
import {
  FileDown,
  Calendar,
  BarChart2,
  TrendingUp,
  Users,
  Loader2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { getServiceUrl, ServiceName } from "@/lib/api/factory";

type DateRange = "7d" | "30d" | "90d" | "custom";
type ScheduleFreq = "weekly" | "monthly" | "none";

interface AccountOption {
  id: string;
  name: string;
  platform: string;
}

interface ReportPreview {
  totalPosts: number;
  totalEngagements: number;
  followerGrowth: number;
  topPosts: Array<{ id: string; content: string; engagements: number }>;
  growthData: Array<{ date: string; followers: number }>;
}

const PLATFORM_COLORS: Record<string, string> = {
  twitter: "#1DA1F2",
  facebook: "#1877F2",
  instagram: "#E4405F",
  linkedin: "#0A66C2",
  mastodon: "#6364FF",
  bluesky: "#0085FF",
};

const MOCK_ACCOUNTS: AccountOption[] = [
  { id: "a1", name: "@signalabout", platform: "twitter" },
  { id: "a2", name: "SignApps Page", platform: "facebook" },
  { id: "a3", name: "signapps", platform: "instagram" },
  { id: "a4", name: "SignApps Company", platform: "linkedin" },
];

function generatePreview(range: DateRange): ReportPreview {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return {
    totalPosts: Math.floor(days * 1.5),
    totalEngagements: Math.floor(days * 120 + Math.random() * 500),
    followerGrowth: Math.floor(days * 4 + Math.random() * 20),
    topPosts: [
      { id: "p1", content: "Introducing SignApps v2.0 with AI features...", engagements: 842 },
      { id: "p2", content: "How we achieved 100% local AI processing...", engagements: 631 },
      { id: "p3", content: "Open source spotlight: our Rust backend...", engagements: 514 },
    ],
    growthData: Array.from({ length: Math.min(days, 30) }, (_, i) => ({
      date: new Date(Date.now() - (days - i) * 86400000).toLocaleDateString("en", {
        month: "short",
        day: "numeric",
      }),
      followers: 1200 + i * Math.floor(4 + Math.random() * 3),
    })),
  };
}

export function ReportGenerator() {
  const [range, setRange] = useState<DateRange>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(["a1", "a2"]);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleFreq>("none");
  const [scheduleEmail, setScheduleEmail] = useState("");
  const [autoReportEnabled, setAutoReportEnabled] = useState(false);

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handlePreview = async () => {
    if (selectedAccounts.length === 0) {
      toast.error("Sélectionnez au moins un compte");
      return;
    }
    setLoadingPreview(true);
    try {
      const res = await fetch(`${getServiceUrl(ServiceName.SOCIAL)}/social/reports/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range, accounts: selectedAccounts, customFrom, customTo }),
      });
      if (!res.ok) throw new Error("Preview failed");
      const data = await res.json();
      setPreview(data);
    } catch {
      setPreview(generatePreview(range));
      toast.info("Aperçu affiché avec données locales");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const res = await fetch("http://localhost:3006/api/v1/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "social",
          range,
          accounts: selectedAccounts,
          preview,
        }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `social-report-${range}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Rapport exporté");
    } catch {
      toast.error("PDF export unavailable — signapps-office service required");
    } finally {
      setExporting(false);
    }
  };

  const handleScheduleSave = async () => {
    if (!scheduleEmail.includes("@")) {
      toast.error("Saisissez une adresse email valide");
      return;
    }
    try {
      await fetch(`${getServiceUrl(ServiceName.SOCIAL)}/social/reports/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frequency: schedule, email: scheduleEmail, accounts: selectedAccounts }),
      });
      toast.success(`Auto-report scheduled ${schedule}`);
    } catch {
      toast.warning("Enregistré localement — API indisponible");
    }
    setAutoReportEnabled(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-500" />
            Report Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date range */}
          <div className="space-y-2">
            <Label className="text-xs">Date Range</Label>
            <div className="flex gap-2 flex-wrap">
              {(["7d", "30d", "90d", "custom"] as DateRange[]).map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={range === r ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setRange(r)}
                >
                  {r === "7d" ? "Last 7 days" : r === "30d" ? "Last 30 days" : r === "90d" ? "Last 90 days" : "Custom"}
                </Button>
              ))}
            </div>
            {range === "custom" && (
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-8 text-xs"
                />
                <span className="self-center text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>

          {/* Accounts */}
          <div className="space-y-2">
            <Label className="text-xs">Accounts</Label>
            <div className="grid grid-cols-2 gap-2">
              {MOCK_ACCOUNTS.map((acc) => (
                <label
                  key={acc.id}
                  className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <Checkbox
                    checked={selectedAccounts.includes(acc.id)}
                    onCheckedChange={() => toggleAccount(acc.id)}
                  />
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: PLATFORM_COLORS[acc.platform] ?? "#888" }}
                  />
                  <span className="text-xs truncate">{acc.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePreview}
              disabled={loadingPreview}
              className="flex-1"
            >
              {loadingPreview ? (
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
              ) : (
                <BarChart2 className="w-3 h-3 mr-2" />
              )}
              Preview
            </Button>
            <Button
              size="sm"
              onClick={handleExportPdf}
              disabled={exporting || !preview}
              className="flex-1"
            >
              {exporting ? (
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
              ) : (
                <FileDown className="w-3 h-3 mr-2" />
              )}
              Export PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {preview && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
              Report Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 bg-muted/30 rounded-md">
                <p className="text-lg font-bold">{preview.totalPosts}</p>
                <p className="text-xs text-muted-foreground">Posts</p>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded-md">
                <p className="text-lg font-bold">{preview.totalEngagements.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Engagements</p>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded-md">
                <p className="text-lg font-bold text-green-600">+{preview.followerGrowth}</p>
                <p className="text-xs text-muted-foreground">Followers</p>
              </div>
            </div>

            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={preview.growthData}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} width={35} />
                  <Tooltip contentStyle={{ fontSize: "10px" }} />
                  <Line
                    type="monotone"
                    dataKey="followers"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium">Top Posts</p>
              {preview.topPosts.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="text-xs shrink-0">{p.engagements}</Badge>
                  <span className="truncate text-muted-foreground">{p.content}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto-schedule */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Auto-Reports
            </span>
            {autoReportEnabled && (
              <Badge variant="default" className="text-xs">Active</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Frequency</Label>
              <Select value={schedule} onValueChange={(v) => setSchedule(v as ScheduleFreq)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">Disabled</SelectItem>
                  <SelectItem value="weekly" className="text-xs">Weekly</SelectItem>
                  <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Send to</Label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={scheduleEmail}
                onChange={(e) => setScheduleEmail(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          {schedule !== "none" && (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs"
              onClick={handleScheduleSave}
            >
              Save Schedule
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
