"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  type SlideTransition,
  type SlideTransitionType,
  getSlideTransitionVariants,
} from "./slide-animations";

interface PresentationModeProps {
  slides: ReactNode[];
  transitions?: SlideTransition[];
  onExit: () => void;
}

export function PresentationMode({
  slides,
  transitions,
  onExit,
}: PresentationModeProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onExit();
      if (e.key === "ArrowRight" || e.key === " ") {
        setDirection(1);
        setCurrent((c) => Math.min(c + 1, slides.length - 1));
      }
      if (e.key === "ArrowLeft") {
        setDirection(-1);
        setCurrent((c) => Math.max(c - 1, 0));
      }
      if (e.key === "Home") {
        setDirection(-1);
        setCurrent(0);
      }
      if (e.key === "End") {
        setDirection(1);
        setCurrent(slides.length - 1);
      }
    }
    document.addEventListener("keydown", handleKey);
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (document.fullscreenElement)
        document.exitFullscreen?.().catch(() => {});
    };
  }, [slides.length, onExit]);

  const handleClick = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    if (e.clientX > rect.width / 2) {
      setDirection(1);
      setCurrent((c) => Math.min(c + 1, slides.length - 1));
    } else {
      setDirection(-1);
      setCurrent((c) => Math.max(c - 1, 0));
    }
  };

  // Get transition for current slide
  const transition = transitions?.[current] || {
    type: "none" as SlideTransitionType,
    duration: 500,
  };
  const hasTransition = transition.type !== "none";
  const variants = getSlideTransitionVariants(transition.type);
  const transitionDuration = transition.duration / 1000;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center overflow-hidden"
      onClick={handleClick}
    >
      <div className="w-full h-full flex items-center justify-center p-8 relative">
        {hasTransition ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{
                duration: transitionDuration,
                ease: "easeInOut",
              }}
              className="w-full h-full flex items-center justify-center"
            >
              {slides[current]}
            </motion.div>
          </AnimatePresence>
        ) : (
          slides[current]
        )}
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 text-white/60 text-sm">
        <span>
          {current + 1} / {slides.length}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExit();
          }}
          className="px-3 py-1 rounded bg-card/10 hover:bg-card/20 transition-colors"
        >
          ESC
        </button>
      </div>
    </div>
  );
}
