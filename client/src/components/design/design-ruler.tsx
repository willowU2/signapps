"use client";

// IDEA-064: Ruler and grid overlay — toggleable rulers on top/left edges + configurable grid

import { useRef, useEffect } from "react";

interface RulerProps {
  orientation: "horizontal" | "vertical";
  length: number; // canvas dimension in px
  scale: number; // displayScale * zoom
  offset: number; // scroll offset
  size?: number; // ruler thickness (default 20)
  unit?: "px" | "mm"; // display unit
}

const RULER_SIZE = 20;
const TICK_COLOR = "rgba(100,100,100,0.7)";
const TEXT_COLOR = "rgba(80,80,80,0.9)";

function drawRuler(
  ctx: CanvasRenderingContext2D,
  orientation: "horizontal" | "vertical",
  canvasLength: number, // ruler canvas length in display px
  docLength: number, // document length in design px
  scale: number, // how many display px = 1 design px
  offset: number, // scroll offset in display px
  size: number,
) {
  ctx.clearRect(
    0,
    0,
    orientation === "horizontal" ? canvasLength : size,
    orientation === "horizontal" ? size : canvasLength,
  );

  const bg = "#f8f8f8";
  ctx.fillStyle = bg;
  ctx.fillRect(
    0,
    0,
    orientation === "horizontal" ? canvasLength : size,
    orientation === "horizontal" ? size : canvasLength,
  );

  ctx.strokeStyle = "rgba(200,200,200,0.8)";
  ctx.lineWidth = 0.5;
  if (orientation === "horizontal") {
    ctx.beginPath();
    ctx.moveTo(0, size - 0.5);
    ctx.lineTo(canvasLength, size - 0.5);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(size - 0.5, 0);
    ctx.lineTo(size - 0.5, canvasLength);
    ctx.stroke();
  }

  // Determine tick spacing based on scale
  let step = 10; // in design px
  const candidates = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  for (const c of candidates) {
    if (c * scale >= 40) {
      step = c;
      break;
    }
  }

  const startDesignPx = Math.floor(-offset / scale / step) * step;
  const endDesignPx =
    Math.ceil((canvasLength - offset) / scale / step) * step + step;

  ctx.fillStyle = TEXT_COLOR;
  ctx.strokeStyle = TICK_COLOR;
  ctx.lineWidth = 0.8;
  ctx.font = "9px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  for (let v = startDesignPx; v <= endDesignPx; v += step) {
    const displayPos = v * scale + offset;
    if (displayPos < 0 || displayPos > canvasLength) continue;

    const isMajor = v % (step * 5) === 0;
    const tickLen = isMajor ? size * 0.6 : size * 0.3;

    ctx.beginPath();
    if (orientation === "horizontal") {
      ctx.moveTo(displayPos, size);
      ctx.lineTo(displayPos, size - tickLen);
      ctx.stroke();
      if (isMajor) {
        ctx.save();
        ctx.translate(displayPos + 2, 1);
        ctx.fillText(String(v), 0, 0);
        ctx.restore();
      }
    } else {
      ctx.moveTo(size, displayPos);
      ctx.lineTo(size - tickLen, displayPos);
      ctx.stroke();
      if (isMajor) {
        ctx.save();
        ctx.translate(size - 2, displayPos + 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "right";
        ctx.fillText(String(v), 0, 0);
        ctx.restore();
      }
    }
  }
}

export function DesignRuler({
  orientation,
  length,
  scale,
  offset,
  size = RULER_SIZE,
}: RulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayLength = length;

    if (orientation === "horizontal") {
      canvas.width = displayLength * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${displayLength}px`;
      canvas.style.height = `${size}px`;
    } else {
      canvas.width = size * dpr;
      canvas.height = displayLength * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${displayLength}px`;
    }

    ctx.scale(dpr, dpr);
    drawRuler(
      ctx,
      orientation,
      displayLength,
      length / scale,
      scale,
      offset,
      size,
    );
  }, [orientation, length, scale, offset, size]);

  return (
    <canvas
      ref={canvasRef}
      className="shrink-0 pointer-events-none select-none"
      style={{ display: "block" }}
    />
  );
}

// Ruler corner (top-left square)
export function RulerCorner({ size = RULER_SIZE }: { size?: number }) {
  return (
    <div
      className="shrink-0 bg-[#f8f8f8] border-b border-r border-[rgba(200,200,200,0.8)]"
      style={{ width: size, height: size }}
    />
  );
}

export { RULER_SIZE };
