"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MousePointer2, Eye, EyeOff, RefreshCw } from "lucide-react";

interface ClickPoint {
  x: number;
  y: number;
  count: number;
}

const PAGES = [
  { value: "dashboard", label: "Dashboard" },
  { value: "analytics", label: "Analytics" },
  { value: "settings", label: "Settings" },
];

function generatePoints(count: number): ClickPoint[] {
  const clusters = [
    { cx: 0.3, cy: 0.15 },
    { cx: 0.7, cy: 0.12 },
    { cx: 0.15, cy: 0.5 },
    { cx: 0.5, cy: 0.45 },
    { cx: 0.8, cy: 0.7 },
  ];
  const points: ClickPoint[] = [];
  for (let i = 0; i < count; i++) {
    const cluster = clusters[Math.floor(Math.random() * clusters.length)];
    points.push({
      x: Math.max(0, Math.min(1, cluster.cx + (Math.random() - 0.5) * 0.2)),
      y: Math.max(0, Math.min(1, cluster.cy + (Math.random() - 0.5) * 0.2)),
      count: Math.floor(Math.random() * 10) + 1,
    });
  }
  return points;
}

export function ClickHeatmap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState("dashboard");
  const [points, setPoints] = useState<ClickPoint[]>([]);
  const [visible, setVisible] = useState(true);
  const [totalClicks] = useState(points.reduce((s, p) => s + p.count, 0));

  const drawHeatmap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Use screen mode to prevent muddy colors and make overlaps glow brilliantly
    ctx.globalCompositeOperation = "screen";

    points.forEach((p) => {
      const x = p.x * width;
      const y = p.y * height;
      const r = 35 + p.count * 5;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      const intensity = Math.min(1, p.count / 15);

      grad.addColorStop(0, `rgba(255, 255, 0, ${intensity})`); // Yellow/White hot
      grad.addColorStop(0.3, `rgba(255, 80, 0, ${intensity * 0.8})`); // Red-hot ring
      grad.addColorStop(0.6, `rgba(120, 0, 255, ${intensity * 0.4})`); // Purple/Blue warm
      grad.addColorStop(1, "rgba(0, 0, 255, 0)"); // Cold fade

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [points, visible]);

  useEffect(() => {
    drawHeatmap();
  }, [drawHeatmap]);

  const regenerate = () => {
    setPoints([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <MousePointer2 className="h-5 w-5" />
        <h2 className="text-xl font-semibold">Click Heatmap</h2>
        <Select
          value={page}
          onValueChange={(v) => {
            setPage(v);
            regenerate();
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? (
            <EyeOff className="mr-2 h-4 w-4" />
          ) : (
            <Eye className="mr-2 h-4 w-4" />
          )}
          {visible ? "Hide" : "Show"} Heatmap
        </Button>
        <Button variant="outline" size="sm" onClick={regenerate}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
        <Badge variant="secondary" className="ml-auto">
          {totalClicks} clicks recorded
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Page: {PAGES.find((p) => p.value === page)?.label}
          </CardTitle>
          <CardDescription>
            Aggregated click positions. Redder = more clicks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="relative bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-inner"
            style={{ aspectRatio: "16/9" }}
          >
            {/* Wireframe page skeleton - Modern Edition */}
            <div className="absolute inset-0 p-5 pointer-events-none flex gap-4">
              {/* Sidebar */}
              <div className="w-48 bg-slate-800/40 rounded-lg flex flex-col gap-3 p-3 border border-slate-700/50">
                <div className="h-6 w-3/4 bg-primary/30 rounded" />
                <div className="mt-4 flex flex-col gap-2">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="h-4 bg-slate-700/60 rounded w-full"
                    />
                  ))}
                </div>
              </div>
              {/* Main Content */}
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex justify-between items-center bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                  <div className="h-5 w-1/4 bg-slate-700/60 rounded" />
                  <div className="h-8 w-8 rounded-full bg-primary/30" />
                </div>
                <div className="flex gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="h-20 bg-slate-800/40 border border-slate-700/50 rounded-lg flex-1"
                    />
                  ))}
                </div>
                <div className="flex-1 bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
                  <div className="h-full bg-slate-700/40 rounded-md" />
                </div>
              </div>
            </div>
            {/* Heatmap overlay */}
            {visible && (
              <canvas
                ref={canvasRef}
                width={800}
                height={450}
                className="absolute inset-0 w-full h-full opacity-90 blur-[3px]"
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ClickHeatmap;
