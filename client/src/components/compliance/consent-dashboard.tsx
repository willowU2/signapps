"use client";

// IDEA-279: Consent management dashboard — track user consents

import { useState, useEffect, useCallback } from "react";
import {
  UserCheck,
  RefreshCw,
  Download,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

interface ConsentRecord {
  id: string;
  subject_email: string;
  subject_name?: string;
  purpose: string;
  consent_given: boolean;
  consent_date: string;
  expiry_date?: string;
  source: string;
  ip_address?: string;
  version: string;
}

interface ConsentStats {
  total: number;
  given: number;
  withdrawn: number;
  expired: number;
}

type ConsentFilter = "all" | "given" | "withdrawn" | "expired";

export function ConsentDashboard() {
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [stats, setStats] = useState<ConsentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ConsentFilter>("all");
  const [purpose, setPurpose] = useState("all");
  const [purposes, setPurposes] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filter !== "all") params.set("status", filter);
      if (purpose !== "all") params.set("purpose", purpose);

      const [recsRes, statsRes, purposesRes] = await Promise.all([
        fetch(`/api/compliance/consents?${params}`).then((r) => r.json()),
        fetch("/api/compliance/consents/stats").then((r) => r.json()),
        fetch("/api/compliance/consents/purposes").then((r) => r.json()),
      ]);
      setRecords(recsRes.data ?? []);
      setStats(statsRes);
      setPurposes(purposesRes.purposes ?? []);
    } catch {
      toast.error("Impossible de charger les données de consentement");
    } finally {
      setLoading(false);
    }
  }, [search, filter, purpose]);

  useEffect(() => {
    load();
  }, [load]);

  async function exportConsents() {
    try {
      const res = await fetch("/api/compliance/consents/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter, purpose }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `consents_${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      toast.success("Consentements exportés");
    } catch {
      toast.error("Export failed");
    }
  }

  const givenPct =
    stats && stats.total > 0
      ? Math.round((stats.given / stats.total) * 100)
      : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2 text-sm">
          <UserCheck className="h-4 w-4" /> Consent Management
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportConsents}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={load}
            aria-label="Actualiser"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Total",
              value: stats.total,
              icon: <UserCheck className="h-4 w-4" />,
            },
            {
              label: "Given",
              value: stats.given,
              icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
            },
            {
              label: "Withdrawn",
              value: stats.withdrawn,
              icon: <XCircle className="h-4 w-4 text-red-500" />,
            },
            {
              label: "Expired",
              value: stats.expired,
              icon: <Clock className="h-4 w-4 text-orange-500" />,
            },
          ].map(({ label, value, icon }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  {icon}
                </div>
                <p className="text-xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {stats && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Consent rate</span>
            <span>{givenPct}%</span>
          </div>
          <Progress value={givenPct} className="h-2" />
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select
          value={filter}
          onValueChange={(v) => setFilter(v as ConsentFilter)}
        >
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="given">Given</SelectItem>
            <SelectItem value="withdrawn">Withdrawn</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={purpose} onValueChange={setPurpose}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Purpose" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All purposes</SelectItem>
            {purposes.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-72">
            {loading && (
              <p className="text-center text-sm text-muted-foreground py-8">
                Loading…
              </p>
            )}
            {!loading && records.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                No records found
              </p>
            )}
            {records.map((r) => (
              <div
                key={r.id}
                className="flex items-start justify-between px-4 py-3 border-b last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {r.subject_name ?? r.subject_email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.subject_email}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {r.purpose}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      v{r.version}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.source}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(r.consent_date), "MMM d, yyyy HH:mm")}
                    {r.expiry_date &&
                      ` · Expires ${format(new Date(r.expiry_date), "MMM d, yyyy")}`}
                  </p>
                </div>
                <Badge
                  variant={r.consent_given ? "default" : "destructive"}
                  className="text-xs ml-3 flex-shrink-0"
                >
                  {r.consent_given ? "Given" : "Withdrawn"}
                </Badge>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
