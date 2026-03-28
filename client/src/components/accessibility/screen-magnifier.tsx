'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MagnifierProps {
  zoom?: number;
  size?: number;
}

export function ScreenMagnifier({ zoom = 2.5, size = 180 }: MagnifierProps) {
  const [enabled, setEnabled] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const lensRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setPos({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (enabled) {
      document.addEventListener('mousemove', handleMouseMove);
    }
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [enabled, handleMouseMove]);

  const half = size / 2;
  const bgX = -(pos.x * currentZoom - half);
  const bgY = -(pos.y * currentZoom - half);

  return (
    <>
      {/* Control bar */}
      <div className="flex items-center gap-1.5">
        <Button
          variant={enabled ? 'default' : 'outline'}
          size="sm"
          onClick={() => setEnabled(!enabled)}
          className="gap-1.5"
          aria-label="Toggle screen magnifier"
        >
          <ZoomIn className="h-4 w-4" />
          Magnifier
        </Button>
        {enabled && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentZoom(z => Math.max(1.5, z - 0.5))}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground w-8 text-center">{currentZoom}x</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentZoom(z => Math.min(6, z + 0.5))}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEnabled(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      {/* Magnifier lens */}
      {enabled && (
        <div
          ref={lensRef}
          className={cn(
            'fixed pointer-events-none z-[9999] rounded-full border-4 border-primary shadow-2xl overflow-hidden',
            'transition-none'
          )}
          style={{
            width: size,
            height: size,
            left: pos.x - half,
            top: pos.y - half,
            backgroundImage: `url(${window.location.origin})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${window.innerWidth * currentZoom}px ${window.innerHeight * currentZoom}px`,
            backgroundPosition: `${bgX}px ${bgY}px`,
          }}
        >
          {/* Crosshair */}
          <div
            className="absolute top-1/2 left-0 w-full h-px bg-primary/40"
            style={{ transform: 'translateY(-50%)' }}
          />
          <div
            className="absolute left-1/2 top-0 h-full w-px bg-primary/40"
            style={{ transform: 'translateX(-50%)' }}
          />
        </div>
      )}
    </>
  );
}
