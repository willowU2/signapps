"use client";

// IDEA-052: Hashtag evolution chart — recharts LineChart showing hashtag usage over 30/90 days

import { useState, useMemo } from "react";
import { Hash, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface HashtagDataPoint {
  date: string;
  [hashtag: string]: number | string;
}

interface HashtagEvolutionChartProps {
  hashtags?: string[];
  data?: HashtagDataPoint[];
  defaultRange?: 30 | 90;
}

const COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#8b5cf6",
];

function generateDemoData(
  hashtags: string[],
  days: number,
): HashtagDataPoint[] {
  const points: HashtagDataPoint[] = [];
  const bases = hashtags.reduce<Record<string, number>>((acc, tag, i) => {
    acc[tag] = 30 + i * 10 + Math.random() * 20;
    return acc;
  }, {});

  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - (days - i) * 86400000);
    const point: HashtagDataPoint = {
      date: date.toLocaleDateString("en", { month: "short", day: "numeric" }),
    };
    hashtags.forEach((tag) => {
      bases[tag] = Math.max(0, bases[tag] + (Math.random() - 0.48) * 8);
      point[tag] = Math.round(bases[tag]);
    });
    points.push(point);
  }
  return points;
}

const DEFAULT_HASHTAGS = [
  "SignApps",
  "productivity",
  "openSource",
  "innovation",
  "Rust",
];

export function HashtagEvolutionChart({
  hashtags = DEFAULT_HASHTAGS,
  data,
  defaultRange = 30,
}: HashtagEvolutionChartProps) {
  const [range, setRange] = useState<30 | 90>(defaultRange);
  const [activeHashtags, setActiveHashtags] = useState<string[]>(
    hashtags.slice(0, 3),
  );

  const chartData = useMemo(
    () => data?.slice(-range) ?? generateDemoData(hashtags, range),
    [data, hashtags, range],
  );

  const toggleHashtag = (tag: string) => {
    setActiveHashtags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            Hashtag Evolution
          </span>
          <div className="flex items-center gap-1">
            {([30, 90] as const).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={range === r ? "default" : "outline"}
                className="h-6 text-xs px-2"
                onClick={() => setRange(r)}
              >
                {r}d
              </Button>
            ))}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {hashtags.map((tag, i) => (
            <button key={tag} onClick={() => toggleHashtag(tag)}>
              <Badge
                variant={activeHashtags.includes(tag) ? "default" : "outline"}
                className="text-xs gap-1 cursor-pointer"
                style={
                  activeHashtags.includes(tag)
                    ? {
                        backgroundColor: COLORS[i % COLORS.length],
                        border: "none",
                      }
                    : {}
                }
              >
                <Hash className="w-2.5 h-2.5" />
                {tag}
              </Badge>
            </button>
          ))}
        </div>

        {activeHashtags.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
            Select hashtags to display
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                interval={range === 30 ? 4 : 14}
              />
              <YAxis tick={{ fontSize: 10 }} width={28} />
              <Tooltip
                contentStyle={{ fontSize: "11px" }}
                formatter={(value, name) => [Number(value), `#${name}`]}
              />
              <Legend
                formatter={(value) => `#${value}`}
                wrapperStyle={{ fontSize: "10px" }}
              />
              {activeHashtags.map((tag, i) => (
                <Line
                  key={tag}
                  type="monotone"
                  dataKey={tag}
                  stroke={COLORS[hashtags.indexOf(tag) % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
