'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { AlignJustify } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';

const STORAGE_KEY = 'signapps-reading-guide';

export function ReadingGuideToggle() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mouseY, setMouseY] = useState(0);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY) === 'true';
    setEnabled(stored);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setMouseY(e.clientY);
  }, []);

  useEffect(() => {
    if (enabled) {
      document.addEventListener('mousemove', handleMouseMove);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [enabled, handleMouseMove]);

  const toggle = (val: boolean) => {
    setEnabled(val);
    localStorage.setItem(STORAGE_KEY, String(val));
  };

  if (!mounted) return null;

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <AlignJustify className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="reading-guide-toggle" className="font-medium cursor-pointer">
              Focus Mask (Guide de Lecture)
            </Label>
          </div>
          <p className="text-xs text-muted-foreground ml-6">
            Assombrit l'écran pour garder le focus sur un seul paragraphe de texte à la fois.
          </p>
        </div>
        <Switch
          id="reading-guide-toggle"
          checked={enabled}
          onCheckedChange={toggle}
          aria-label="Toggle reading guide"
        />
      </div>

      {enabled && mounted && typeof window !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 pointer-events-none z-[9999]"
              style={{
                background: `
                  linear-gradient(
                    to bottom,
                    rgba(0,0,0,0.6) 0%,
                    rgba(0,0,0,0.6) calc(${mouseY}px - 40px),
                    rgba(0,0,0,0) calc(${mouseY}px - 40px),
                    rgba(0,0,0,0) calc(${mouseY}px + 60px),
                    rgba(0,0,0,0.6) calc(${mouseY}px + 60px),
                    rgba(0,0,0,0.6) 100%
                  )
                `,
              }}
            />,
            document.body
          )
        : null}
    </>
  );
}
