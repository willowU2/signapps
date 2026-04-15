"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { GitMerge, Plus, X } from "lucide-react";

type MetricKey = "cpu" | "memory" | "disk" | "networkRx" | "networkTx";

const METRIC_CONFIG: Record<
  MetricKey,
  { label: string; color: string; unit: string }
> = {
  cpu: { label: "CPU", color: "#3b82f6", unit: "%" },
  memory: { label: "Memory", color: "#a855f7", unit: "%" },
  disk: { label: "Disk", color: "#f97316", unit: "%" },
  networkRx: { label: "Net RX", color: "#22c55e", unit: "MB" },
  networkTx: { label: "Net TX", color: "#ef4444", unit: "MB" },
};

function genData() {
  return Array.from({ length: 30 }, (_, i) => ({
    time: `T${i}`,
    cpu: 20 + Math.sin(i * 0.3) * 20 + Math.random() * 10,
    memory: 50 + Math.cos(i * 0.2) * 15 + Math.random() * 8,
    disk: 60 + i * 0.2 + Math.random() * 5,
    networkRx: Math.abs(Math.sin(i * 0.5) * 8 + Math.random() * 3),
    networkTx: Math.abs(Math.cos(i * 0.4) * 5 + Math.random() * 2),
  }));
}

export function MultiMetricCorrelation() {
  const [selected, setSelected] = useState<MetricKey[]>(["cpu", "memory"]);
  const data = useMemo(() => genData(), []);

  const toggle = (k: MetricKey) => {
    setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <GitMerge className="h-4 w-4 text-teal-500" />
            Multi-Metric Correlation
          </CardTitle>
          <div className="flex flex-wrap gap-1.5 justify-end max-w-xs">
            {(
              Object.entries(METRIC_CONFIG) as [
                MetricKey,
                (typeof METRIC_CONFIG)[MetricKey],
              ][]
            ).map(([k, v]) => (
              <button
                key={k}
                onClick={() => toggle(k)}
                className={`px-2 py-0.5 rounded-full text-xs border transition-all ${selected.includes(k) ? "border-transparent text-white" : "border-border text-muted-foreground hover:border-foreground"}`}
                style={selected.includes(k) ? { backgroundColor: v.color } : {}}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {selected.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <GitMerge className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Select metrics above to overlay them</p>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={5} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: 11,
                  }}
                  formatter={(v, name) => {
                    const metric = METRIC_CONFIG[name as MetricKey];
                    return [
                      `${Number(v).toFixed(1)}${metric?.unit ?? ""}`,
                      metric?.label ?? String(name),
                    ];
                  }}
                />
                <Legend
                  formatter={(name) =>
                    METRIC_CONFIG[name as MetricKey]?.label ?? name
                  }
                />
                {selected.map((k) => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stroke={METRIC_CONFIG[k].color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
