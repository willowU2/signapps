'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Shield } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PdfWatermarkProps {
  /** The image/canvas element to overlay watermark on, or a URL to a PDF preview image */
  src?: string;
  username: string;
  /** Width of canvas area (default: parent width) */
  width?: number;
  height?: number;
  className?: string;
}

// ─── Canvas watermark renderer ────────────────────────────────────────────────

function drawWatermark(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  username: string,
  date: string
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Draw image
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Watermark text
  const text = `CONFIDENTIEL — ${username} — ${date}`;

  // Rotate canvas for diagonal text
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 6);

  ctx.font = `bold ${Math.max(16, canvas.width / 22)}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Shadow for readability
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 2;

  // Repeat text across the diagonal
  for (let offset = -canvas.height; offset < canvas.height; offset += 120) {
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ef4444';
    ctx.fillText(text, 0, offset);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#000000';
    ctx.fillText(text, 1, offset + 1);
  }

  ctx.restore();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PdfWatermarkPreview({ src, username, width = 600, height = 800, className = '' }: PdfWatermarkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !src) return;

    canvas.width = width;
    canvas.height = height;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => drawWatermark(canvas, img, username, today);
    img.onerror = () => setError(true);
    img.src = src;
  }, [src, username, width, height, today]);

  useEffect(() => { render(); }, [render]);

  // Placeholder if no src — just render the watermark on a white background
  useEffect(() => {
    if (!src) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // White background
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw watermark text
      const text = `CONFIDENTIEL — ${username} — ${today}`;
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-Math.PI / 6);
      ctx.font = `bold ${Math.max(16, canvas.width / 22)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let offset = -canvas.height; offset < canvas.height; offset += 120) {
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#ef4444';
        ctx.fillText(text, 0, offset);
      }
      ctx.restore();

      // Border placeholder
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#e5e7eb';
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#9ca3af';
      ctx.globalAlpha = 0.5;
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Aperçu PDF avec filigrane', canvas.width / 2, canvas.height / 2);
    }
  }, [src, username, today, width, height]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-lg ${className}`} style={{ width, height }}>
        <p className="text-xs text-muted-foreground">Erreur chargement aperçu</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <canvas ref={canvasRef} className="rounded-lg border max-w-full" style={{ display: 'block' }} />
    </div>
  );
}

// ─── Inline watermark badge ───────────────────────────────────────────────────

interface WatermarkBadgeProps {
  username: string;
  className?: string;
}

export function WatermarkBadge({ username, className = '' }: WatermarkBadgeProps) {
  const today = new Date().toLocaleDateString('fr-FR');
  return (
    <div className={`flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg ${className}`}>
      <Shield className="h-4 w-4 text-amber-600 shrink-0" />
      <div>
        <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Filigrane automatique</p>
        <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
          &ldquo;CONFIDENTIEL — {username} — {today}&rdquo; sera ajouté en diagonale
        </p>
      </div>
    </div>
  );
}
