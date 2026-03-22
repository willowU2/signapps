'use client';

import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface SignaturePadProps {
  onSignature: (base64: string) => void;
  onCancel: () => void;
}

export function SignaturePad({ onSignature, onCancel }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size to match display size
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale context to match device pixel ratio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Fill with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
  }, []);

  const getContextAndCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return { ctx: null, canvas: null };
    const ctx = canvas.getContext('2d');
    return { ctx, canvas };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { ctx, canvas } = getContextAndCanvas();
    if (!ctx || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setIsEmpty(false);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const { ctx, canvas } = getContextAndCanvas();
    if (!ctx || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    const { ctx } = getContextAndCanvas();
    if (!ctx) return;
    ctx.closePath();
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const { ctx, canvas } = getContextAndCanvas();
    if (!ctx || !canvas) return;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    setIsEmpty(true);
  };

  const acceptSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const base64 = canvas.toDataURL('image/png');
    onSignature(base64);
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      <div className="border-2 border-gray-300 rounded-lg bg-white">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="w-full h-48 cursor-crosshair"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={clearSignature} disabled={isEmpty}>
          Effacer
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button onClick={acceptSignature} disabled={isEmpty}>
          Accepter
        </Button>
      </div>
    </div>
  );
}
