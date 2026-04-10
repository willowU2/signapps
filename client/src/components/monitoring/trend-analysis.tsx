"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState } from "react"
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { TrendingUp } from "lucide-react"

interface DataPoint { time: string; value: number }

interface Props {
  metric: string
  data: DataPoint[]
  color?: string
}

// Simple linear regression for trendline
function linearRegression(data: DataPoint[]) {
  const n = data.length
  if (n < 2) return null
  const xMean = (n - 1) / 2
  const yMean = data.reduce((s, d) => s + d.value, 0) / n
  let numerator = 0, denominator = 0
  data.forEach((d, i) => {
    numerator += (i - xMean) * (d.value - yMean)
    denominator += (i - xMean) ** 2
  })
  const slope = denominator !== 0 ? numerator / denominator : 0
  const intercept = yMean - slope * xMean
  return { slope, intercept }
}

export function TrendAnalysis({ metric, data, color = "#3b82f6" }: Props) {
  const [period, setPeriod] = useState<"30d" | "90d">("30d")

  const regression = useMemo(() => linearRegression(data), [data])

  const chartData = useMemo(() => data.map((d, i) => ({
    ...d,
    trend: regression ? +(regression.intercept + regression.slope * i).toFixed(2) : undefined,
  })), [data, regression])

  const avgValue = data.length > 0 ? data.reduce((s, d) => s + d.value, 0) / data.length : 0
  const trendDir = (regression?.slope ?? 0) > 0.1 ? "up" : (regression?.slope ?? 0) < -0.1 ? "down" : "stable"
  const trendLabel = trendDir === "up" ? "Increasing" : trendDir === "down" ? "Decreasing" : "Stable"
  const trendColor = trendDir === "up" ? "text-orange-600" : trendDir === "down" ? "text-emerald-600" : "text-blue-600"

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Trend Analysis — {metric}
          </CardTitle>
          <CardDescription className="text-xs">
            {period === "30d" ? "30" : "90"}-day trend with linear regression
          </CardDescription>
        </div>
        <Select value={period} onValueChange={v => setPeriod(v as "30d" | "90d")}>
          <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30d">30 days</SelectItem>
            <SelectItem value="90d">90 days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-3">
          <div className="rounded bg-muted/50 px-3 py-1.5 text-center">
            <p className="text-sm font-bold">{avgValue.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Average</p>
          </div>
          <div className="rounded bg-muted/50 px-3 py-1.5 text-center">
            <p className={`text-sm font-bold ${trendColor}`}>{trendLabel}</p>
            <p className="text-xs text-muted-foreground">Trend</p>
          </div>
          {regression && (
            <div className="rounded bg-muted/50 px-3 py-1.5 text-center">
              <p className="text-sm font-bold">{regression.slope > 0 ? "+" : ""}{regression.slope.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Slope/pt</p>
            </div>
          )}
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={Math.floor(chartData.length / 6)} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: 11 }}
                formatter={(v, name) => [`${Number(v).toFixed(1)}${name === "value" ? "%" : ""}`, name === "value" ? metric : "Trend"]}
              />
              <Area type="monotone" dataKey="value" fill={color} stroke={color} fillOpacity={0.15} strokeWidth={1.5} dot={false} />
              {regression && <Line type="monotone" dataKey="trend" stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="5 3" />}
              <ReferenceLine y={avgValue} stroke="#888" strokeDasharray="3 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
