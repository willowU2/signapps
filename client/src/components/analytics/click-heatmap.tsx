'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MousePointer2, Eye, EyeOff, RefreshCw } from 'lucide-react';

interface ClickPoint { x: number; y: number; count: number; }

const PAGES = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'settings', label: 'Settings' },
];

function generatePoints(count: number): ClickPoint[] {
  const clusters = [
    { cx: 0.3, cy: 0.15 }, { cx: 0.7, cy: 0.12 }, { cx: 0.15, cy: 0.5 },
    { cx: 0.5, cy: 0.45 }, { cx: 0.8, cy: 0.7 },
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
  const [page, setPage] = useState('dashboard');
  const [points, setPoints] = useState<ClickPoint[]>(generatePoints(80));
  const [visible, setVisible] = useState(true);
  const [totalClicks] = useState(points.reduce((s, p) => s + p.count, 0));

  const drawHeatmap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    points.forEach(p => {
      const x = p.x * width;
      const y = p.y * height;
      const r = 30 + p.count * 4;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      const alpha = Math.min(0.8, p.count / 10);
      grad.addColorStop(0, `rgba(255, 50, 0, ${alpha})`);
      grad.addColorStop(0.4, `rgba(255, 150, 0, ${alpha * 0.5})`);
      grad.addColorStop(1, 'rgba(255, 200, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [points, visible]);

  useEffect(() => { drawHeatmap(); }, [drawHeatmap]);

  const regenerate = () => {
    setPoints(generatePoints(80));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <MousePointer2 className="h-5 w-5" />
        <h2 className="text-xl font-semibold">Click Heatmap</h2>
        <Select value={page} onValueChange={v => { setPage(v); regenerate(); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{PAGES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setVisible(v => !v)}>
          {visible ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
          {visible ? 'Hide' : 'Show'} Heatmap
        </Button>
        <Button variant="outline" size="sm" onClick={regenerate}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
        <Badge variant="secondary" className="ml-auto">{totalClicks} clicks recorded</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Page: {PAGES.find(p => p.value === page)?.label}</CardTitle>
          <CardDescription>Aggregated click positions. Redder = more clicks.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative bg-muted rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
            {/* Wireframe page skeleton */}
            <div className="absolute inset-0 p-4 pointer-events-none">
              <div className="h-8 bg-background/50 rounded mb-3 w-full" />
              <div className="flex gap-2 mb-4">
                {[...Array(5)].map((_, i) => <div key={i} className="h-6 bg-background/40 rounded flex-1" />)}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-background/40 rounded" />)}
              </div>
              <div className="h-32 bg-background/40 rounded" />
            </div>
            {/* Heatmap overlay */}
            {visible && (
              <canvas
                ref={canvasRef}
                width={800}
                height={450}
                className="absolute inset-0 w-full h-full mix-blend-multiply"
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ClickHeatmap;
