"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { metricsApi } from "@/lib/api";

interface SLAMetrics {
  p99Latency: number;
  uptime: number;
  incidentsCount: number;
  errorRate: number;
  trend: {
    p99Latency: number;
    uptime: number;
    incidentsCount: number;
    errorRate: number;
  };
}

export function SLADashboard() {
  const [period, setPeriod] = useState("30d");
  const [metrics, setMetrics] = useState<SLAMetrics | null>(null);

  useEffect(() => {
    metricsApi
      .summary()
      .then((res) => {
        const data = res.data;
        const uptimePct = data?.uptime_seconds
          ? Math.min(100, (data.uptime_seconds / (30 * 24 * 3600)) * 100)
          : 99.9;
        setMetrics({
          p99Latency: 0,
          uptime: parseFloat(uptimePct.toFixed(2)),
          incidentsCount: 0,
          errorRate: 0,
          trend: { p99Latency: 0, uptime: 0, incidentsCount: 0, errorRate: 0 },
        });
      })
      .catch(() => {
        // Fallback: keep null, show nothing
      });
  }, [period]);

  if (!metrics) return null;

  const getTrendIcon = (value: number) => {
    if (value === 0) return null;
    return value > 0 ? (
      <TrendingUp className="w-4 h-4" />
    ) : (
      <TrendingDown className="w-4 h-4" />
    );
  };

  const getTrendColor = (value: number, isNegativeBetter: boolean = false) => {
    if (value === 0) return "text-muted-foreground";
    const isPositive = value > 0;
    const shouldBePositive = isNegativeBetter ? !isPositive : isPositive;
    return shouldBePositive ? "text-green-600" : "text-red-600";
  };

  const MetricCard = ({
    label,
    value,
    unit,
    trend,
    isNegativeBetter = false,
  }: {
    label: string;
    value: number;
    unit: string;
    trend: number;
    isNegativeBetter?: boolean;
  }) => (
    <Card className="p-6 border border-border">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">
              {value.toFixed(2)}
            </span>
            <span className="text-muted-foreground">{unit}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div
            className={`flex items-center gap-1 ${getTrendColor(trend, isNegativeBetter)}`}
          >
            {getTrendIcon(trend)}
            <span className="text-sm font-medium">
              {Math.abs(trend).toFixed(2)}% {trend >= 0 ? "↑" : "↓"}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">vs last period</span>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">SLA Metrics</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Service level agreement performance
          </p>
        </div>

        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="P99 Latency"
          value={metrics.p99Latency}
          unit="ms"
          trend={metrics.trend.p99Latency}
          isNegativeBetter={true}
        />
        <MetricCard
          label="Uptime"
          value={metrics.uptime}
          unit="%"
          trend={metrics.trend.uptime}
        />
        <MetricCard
          label="Incidents"
          value={metrics.incidentsCount}
          unit="count"
          trend={metrics.trend.incidentsCount}
          isNegativeBetter={true}
        />
        <MetricCard
          label="Error Rate"
          value={metrics.errorRate}
          unit="%"
          trend={metrics.trend.errorRate}
          isNegativeBetter={true}
        />
      </div>

      <Card className="p-6 border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          SLA Compliance
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Target Uptime (99.9%)</span>
            <div className="flex items-center gap-2">
              <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${metrics.uptime >= 99.9 ? "bg-green-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(100, metrics.uptime)}%` }}
                />
              </div>
              <span className="text-sm font-medium text-foreground">
                {metrics.uptime.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
