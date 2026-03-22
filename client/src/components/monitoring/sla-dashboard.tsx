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

  // Mock data initialization
  useEffect(() => {
    const mockMetrics: SLAMetrics = {
      p99Latency: 245,
      uptime: 99.92,
      incidentsCount: 2,
      errorRate: 0.08,
      trend: {
        p99Latency: 5.2,
        uptime: 0.15,
        incidentsCount: -1,
        errorRate: -0.02,
      },
    };
    setMetrics(mockMetrics);
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
    if (value === 0) return "text-gray-600";
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
    <Card className="p-6 border border-gray-200">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              {value.toFixed(2)}
            </span>
            <span className="text-gray-500">{unit}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div className={`flex items-center gap-1 ${getTrendColor(trend, isNegativeBetter)}`}>
            {getTrendIcon(trend)}
            <span className="text-sm font-medium">
              {Math.abs(trend).toFixed(2)}% {trend >= 0 ? "↑" : "↓"}
            </span>
          </div>
          <span className="text-xs text-gray-500">vs last period</span>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">SLA Metrics</h2>
          <p className="text-sm text-gray-600 mt-1">
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

      <Card className="p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Trend Analysis
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">P99 Latency Trend</p>
              <p className="text-sm text-gray-600">
                Slight increase in response times
              </p>
            </div>
            <Badge className="bg-blue-100 text-blue-800">+5.2%</Badge>
          </div>

          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Uptime Trend</p>
              <p className="text-sm text-gray-600">
                Consistent performance maintained
              </p>
            </div>
            <Badge className="bg-green-100 text-green-800">+0.15%</Badge>
          </div>

          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Incident Reduction</p>
              <p className="text-sm text-gray-600">
                One fewer incident than last period
              </p>
            </div>
            <Badge className="bg-green-100 text-green-800">-1</Badge>
          </div>

          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Error Rate Improvement</p>
              <p className="text-sm text-gray-600">
                Lower error rates across services
              </p>
            </div>
            <Badge className="bg-green-100 text-green-800">-0.02%</Badge>
          </div>
        </div>
      </Card>

      <Card className="p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          SLA Compliance
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Target Uptime (99.9%)</span>
            <div className="flex items-center gap-2">
              <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: "99.92%" }}
                />
              </div>
              <span className="text-sm font-medium text-gray-900">99.92%</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-700">Target Error Rate (&lt;0.1%)</span>
            <div className="flex items-center gap-2">
              <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: "80%" }}
                />
              </div>
              <span className="text-sm font-medium text-gray-900">0.08%</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-700">Target P99 Latency (&lt;300ms)</span>
            <div className="flex items-center gap-2">
              <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: "82%" }}
                />
              </div>
              <span className="text-sm font-medium text-gray-900">245ms</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
