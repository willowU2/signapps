"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  AlertCircle,
} from "lucide-react";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MRR_DATA: any[] = [];
const LTV_DATA: any[] = [];

const PERIOD_LABELS: Record<string, string> = {
  month: "This Month",
  quarter: "This Quarter",
  year: "This Year",
};

export function RevenueAnalytics() {
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("year");

  if (MRR_DATA.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> Revenue Analytics
          </h2>
        </div>
        <Card>
          <CardContent className="h-64 flex flex-col items-center justify-center text-muted-foreground">
            <p>Aucune donnée financière disponible</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentMRR = MRR_DATA[MRR_DATA.length - 1].mrr;
  const prevMRR = MRR_DATA[MRR_DATA.length - 2].mrr;
  const mrrGrowth = (((currentMRR - prevMRR) / prevMRR) * 100).toFixed(1);
  const churnRate = (
    (MRR_DATA[MRR_DATA.length - 1].churn_mrr / currentMRR) *
    100
  ).toFixed(2);
  const avgLTV = LTV_DATA.reduce((s, d) => s + d.ltv, 0) / LTV_DATA.length;

  const isPositive = parseFloat(mrrGrowth) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5" /> Revenue Analytics
        </h2>
        <div className="flex gap-2">
          {(["month", "quarter", "year"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${period === p ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "MRR",
            value: `$${(currentMRR / 1000).toFixed(1)}k`,
            trend: `${isPositive ? "+" : ""}${mrrGrowth}%`,
            up: isPositive,
            icon: DollarSign,
          },
          {
            label: "Churn Rate",
            value: `${churnRate}%`,
            trend: "vs last month",
            up: false,
            icon: AlertCircle,
          },
          {
            label: "Avg LTV",
            value: `$${avgLTV.toFixed(0)}`,
            trend: "all plans",
            up: true,
            icon: Users,
          },
          {
            label: "ARR",
            value: `$${((currentMRR * 12) / 1000).toFixed(0)}k`,
            trend: "annualized",
            up: true,
            icon: TrendingUp,
          },
        ].map(({ label, value, trend, up, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{value}</p>
              <div className="flex items-center gap-1 mt-1">
                {up ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span
                  className={`text-xs ${up ? "text-green-600" : "text-red-600"}`}
                >
                  {trend}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">MRR Growth</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={MRR_DATA}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip formatter={(v) => [`$${Number(v).toFixed(0)}`, ""]} />
              <Area
                type="monotone"
                dataKey="mrr"
                stroke="#3b82f6"
                fill="url(#mrrGrad)"
                strokeWidth={2}
                name="MRR"
              />
              <Area
                type="monotone"
                dataKey="new_mrr"
                stroke="#22c55e"
                fill="none"
                strokeWidth={2}
                name="New MRR"
                strokeDasharray="4 2"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">LTV by Segment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {LTV_DATA.map((d) => (
              <div key={d.segment} className="flex items-center gap-4">
                <Badge variant="outline" className="w-24 justify-center">
                  {d.segment}
                </Badge>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${(d.ltv / 12000) * 100}%` }}
                  />
                </div>
                <div className="text-sm font-medium w-24 text-right">
                  ${d.ltv.toLocaleString()} LTV
                </div>
                <div className="text-xs text-muted-foreground w-20 text-right">
                  ${d.arpu}/mo · {d.months}mo avg
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default RevenueAnalytics;
