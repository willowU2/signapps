"use client";

import { useEffect, useState, type ReactNode } from "react";

interface PresentationModeProps {
  slides: ReactNode[];
  onExit: () => void;
}

export function PresentationMode({ slides, onExit }: PresentationModeProps) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onExit();
      if (e.key === "ArrowRight" || e.key === " ") setCurrent(c => Math.min(c + 1, slides.length - 1));
      if (e.key === "ArrowLeft") setCurrent(c => Math.max(c - 1, 0));
      if (e.key === "Home") setCurrent(0);
      if (e.key === "End") setCurrent(slides.length - 1);
    }
    document.addEventListener("keydown", handleKey);
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [slides.length, onExit]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center" onClick={e => {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      if (e.clientX > rect.width / 2) setCurrent(c => Math.min(c + 1, slides.length - 1));
      else setCurrent(c => Math.max(c - 1, 0));
    }}>
      <div className="w-full h-full flex items-center justify-center p-8">
        {slides[current]}
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 text-white/60 text-sm">
        <span>{current + 1} / {slides.length}</span>
        <button onClick={onExit} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors">ESC</button>
      </div>
    </div>
  );
}
