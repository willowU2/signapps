'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PenLine, Trash2, Upload, Image } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SignaturePadProps {
  /** Called when a signature data URL is ready (SVG or PNG). */
  onSignature: (dataUrl: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

interface Point {
  x: number;
  y: number;
  pressure?: number;
}

function pointsToSvgPath(points: Point[][]): string {
  return points
    .map((stroke) => {
      if (stroke.length === 0) return '';
      if (stroke.length === 1) {
        const { x, y } = stroke[0];
        return `M ${x} ${y} l 0.01 0`;
      }
      const [first, ...rest] = stroke;
      const cmds = [`M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`];
      for (let i = 0; i < rest.length; i++) {
        const prev = i === 0 ? first : rest[i - 1];
        const curr = rest[i];
        // Smooth curve via midpoints
        const mx = ((prev.x + curr.x) / 2).toFixed(1);
        const my = ((prev.y + curr.y) / 2).toFixed(1);
        cmds.push(`Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)} ${mx} ${my}`);
      }
      return cmds.join(' ');
    })
    .join(' ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SignaturePad({ onSignature, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Redraw canvas whenever strokes change
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const allStrokes = [...strokes, currentStroke].filter((s) => s.length > 0);
    for (const stroke of allStrokes) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      if (stroke.length === 1) {
        ctx.arc(stroke[0].x, stroke[0].y, 1, 0, Math.PI * 2);
        ctx.fill();
      } else {
        for (let i = 1; i < stroke.length; i++) {
          const prev = stroke[i - 1];
          const curr = stroke[i];
          const mx = (prev.x + curr.x) / 2;
          const my = (prev.y + curr.y) / 2;
          ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
        }
        ctx.stroke();
      }
    }
  }, [strokes, currentStroke]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const getPos = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    setDrawing(true);
    setCurrentStroke([pos]);
    setHasDrawing(true);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing) return;
    const pos = getPos(e);
    if (!pos) return;
    setCurrentStroke((prev) => [...prev, pos]);
  };

  const handlePointerUp = () => {
    if (!drawing) return;
    setDrawing(false);
    if (currentStroke.length > 0) {
      setStrokes((prev) => [...prev, currentStroke]);
      setCurrentStroke([]);
    }
  };

  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke([]);
    setHasDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleConfirmDraw = () => {
    const allStrokes = [...strokes, currentStroke].filter((s) => s.length > 0);
    if (allStrokes.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Build SVG data URL from strokes
    const pathD = pointsToSvgPath(allStrokes);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><path d="${pathD}" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
    onSignature(dataUrl);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setUploadPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmUpload = () => {
    if (!uploadPreview) return;
    onSignature(uploadPreview);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <Tabs defaultValue="draw">
        <TabsList className="w-full">
          <TabsTrigger value="draw" className="flex-1 gap-2">
            <PenLine className="h-4 w-4" />
            Dessiner
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex-1 gap-2">
            <Image className="h-4 w-4" />
            Importer une image
          </TabsTrigger>
        </TabsList>

        {/* Drawing tab */}
        <TabsContent value="draw" className="space-y-3">
          <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 bg-white dark:bg-zinc-950 overflow-hidden touch-none">
            <canvas
              ref={canvasRef}
              width={560}
              height={200}
              className="w-full h-[200px] cursor-crosshair"
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
              style={{ touchAction: 'none' }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Dessinez votre signature dans la zone ci-dessus
          </p>
          <div className="flex justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={!hasDrawing}
              className="gap-2"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Effacer
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmDraw}
              disabled={!hasDrawing}
              className="gap-2"
            >
              <PenLine className="h-3.5 w-3.5" />
              Utiliser cette signature
            </Button>
          </div>
        </TabsContent>

        {/* Upload tab */}
        <TabsContent value="upload" className="space-y-3">
          {uploadPreview ? (
            <div className="rounded-lg border bg-white dark:bg-zinc-950 overflow-hidden flex items-center justify-center p-4" style={{ minHeight: 160 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={uploadPreview}
                alt="Signature importée"
                className="max-h-40 object-contain"
              />
            </div>
          ) : (
            <div
              className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground/50" />
              <div className="text-center">
                <p className="text-sm font-medium">Cliquez pour importer</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF, SVG (max 2 Mo)</p>
              </div>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setUploadPreview(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
              disabled={!uploadPreview}
            >
              Changer
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmUpload}
              disabled={!uploadPreview}
              className="gap-2"
            >
              <PenLine className="h-3.5 w-3.5" />
              Utiliser cette image
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
