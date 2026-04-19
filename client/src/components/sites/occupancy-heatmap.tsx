"use client";

/**
 * SO7 — Occupancy heatmap for a site.
 *
 * Renders the `/occupancy` buckets as a colored cell table. Horizontal
 * axis = day (or hour). Vertical axis = just one row since we're on a
 * single site. For multi-site heatmap we'd extend to a matrix.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity, Download } from "lucide-react";
import { toast } from "sonner";
import { orgApi } from "@/lib/api/org";
import type { OrgOccupancyResponse, OrgSiteRecord } from "@/types/org";

export interface OccupancyHeatmapProps {
  site: OrgSiteRecord;
}

function todayMinus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function OccupancyHeatmap({ site }: OccupancyHeatmapProps) {
  const [since, setSince] = useState<string>(() => todayMinus(14));
  const [until, setUntil] = useState<string>(() => todayMinus(-14));
  const [granularity, setGranularity] = useState<"day" | "hour">("day");
  const [data, setData] = useState<OrgOccupancyResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orgApi.orgSites.occupancy(site.id, {
        since: new Date(since + "T00:00:00Z").toISOString(),
        until: new Date(until + "T00:00:00Z").toISOString(),
        granularity,
      });
      setData(res.data);
    } catch (e) {
      console.error("occupancy load failed", e);
      toast.error("Impossible de charger l'occupation");
    } finally {
      setLoading(false);
    }
  }, [site.id, since, until, granularity]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const exportCsv = useCallback(() => {
    if (!data) return;
    const rows = [
      "bucket,count",
      ...data.buckets.map((b) => `${b.key},${b.count}`),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `occupancy-${site.slug}-${since}-${until}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, site.slug, since, until]);

  const max = data?.buckets.reduce((m, b) => Math.max(m, b.count), 0) ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <Label className="text-xs">Du</Label>
        <Input
          type="date"
          value={since}
          onChange={(e) => setSince(e.target.value)}
          className="w-36 h-8"
        />
        <Label className="text-xs">au</Label>
        <Input
          type="date"
          value={until}
          onChange={(e) => setUntil(e.target.value)}
          className="w-36 h-8"
        />
        <Select
          value={granularity}
          onValueChange={(v) => setGranularity(v as "day" | "hour")}
        >
          <SelectTrigger className="w-32 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Jour</SelectItem>
            <SelectItem value="hour">Heure</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          onClick={exportCsv}
          disabled={!data || data.buckets.length === 0}
          className="ml-auto"
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          Export CSV
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground italic">Chargement…</p>
      ) : !data || data.buckets.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Aucune réservation sur cette période.
        </p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40">
                <th className="px-3 py-2 text-left">Bucket</th>
                <th className="px-3 py-2 text-right">Bookings</th>
                <th className="px-3 py-2 text-left w-1/2">Intensité</th>
              </tr>
            </thead>
            <tbody>
              {data.buckets.map((b) => {
                const intensity = max === 0 ? 0 : b.count / max;
                return (
                  <tr key={b.key} className="border-t">
                    <td className="px-3 py-1.5 font-mono">{b.key}</td>
                    <td className="px-3 py-1.5 text-right font-medium">
                      {b.count}
                    </td>
                    <td className="px-3 py-1.5">
                      <div
                        className="h-4 rounded bg-emerald-500"
                        style={{
                          width: `${Math.max(intensity * 100, 6)}%`,
                          opacity: 0.2 + intensity * 0.8,
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
