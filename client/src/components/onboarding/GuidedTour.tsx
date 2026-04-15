"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createPortal } from "react-dom";

export interface TourStep {
  id: string;
  target: string; // CSS selector
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
}

interface TourProps {
  tourId: string;
  steps: TourStep[];
  onComplete?: () => void;
  autoStart?: boolean;
}

function getElementRect(selector: string) {
  const el = document.querySelector(selector);
  if (!el) return null;
  return el.getBoundingClientRect();
}

function calcPosition(rect: DOMRect, placement: string = "bottom") {
  const margin = 12;
  const popW = 280,
    popH = 160;
  switch (placement) {
    case "top":
      return {
        top: rect.top - popH - margin,
        left: rect.left + rect.width / 2 - popW / 2,
      };
    case "left":
      return {
        top: rect.top + rect.height / 2 - popH / 2,
        left: rect.left - popW - margin,
      };
    case "right":
      return {
        top: rect.top + rect.height / 2 - popH / 2,
        left: rect.right + margin,
      };
    default:
      return {
        top: rect.bottom + margin,
        left: rect.left + rect.width / 2 - popW / 2,
      };
  }
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

export function GuidedTour({
  tourId,
  steps,
  onComplete,
  autoStart = false,
}: TourProps) {
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const storageKey = `signapps-tour-${tourId}`;

  useEffect(() => {
    if (autoStart && !localStorage.getItem(storageKey)) {
      setTimeout(() => setActive(true), 500);
    }
  }, [autoStart, storageKey]);

  const updateRect = useCallback(() => {
    const step = steps[stepIdx];
    if (!step) return;
    const r = getElementRect(step.target);
    setRect(r);
  }, [steps, stepIdx]);

  useEffect(() => {
    if (!active) return;
    updateRect();
    const obs = new MutationObserver(updateRect);
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      obs.disconnect();
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [active, updateRect]);

  const complete = () => {
    setActive(false);
    localStorage.setItem(storageKey, "done");
    onComplete?.();
  };

  const next = () => {
    if (stepIdx < steps.length - 1) setStepIdx((i) => i + 1);
    else complete();
  };

  const prev = () => setStepIdx((i) => Math.max(0, i - 1));

  if (!active || !rect) return null;

  const step = steps[stepIdx];
  const pos = calcPosition(rect, step.placement);
  const safeTop = clamp(
    pos.top + window.scrollY,
    8,
    document.documentElement.scrollHeight - 180,
  );
  const safeLeft = clamp(pos.left, 8, window.innerWidth - 296);

  return createPortal(
    <>
      {/* Overlay with highlight */}
      <div className="fixed inset-0 z-[9998] pointer-events-none">
        <div className="absolute inset-0 bg-black/50 rounded-none" />
        <div
          className="absolute bg-transparent ring-4 ring-primary rounded-lg pointer-events-none"
          style={{
            top: rect.top + window.scrollY - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
          }}
        />
      </div>

      {/* Tooltip */}
      <div
        className="fixed z-[9999] w-72 bg-card border rounded-xl shadow-xl p-4 pointer-events-auto"
        style={{ top: safeTop, left: safeLeft }}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {stepIdx + 1}/{steps.length}
            </Badge>
            <p className="font-semibold text-sm">{step.title}</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 -mt-1 -mr-1"
            onClick={complete}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{step.content}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all ${i === stepIdx ? "w-4 bg-primary" : "w-1 bg-muted-foreground/30"}`}
              />
            ))}
          </div>
          <div className="flex gap-1">
            {stepIdx > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={prev}
                className="h-7 px-2"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button size="sm" onClick={next} className="h-7 px-3 text-xs">
              {stepIdx < steps.length - 1 ? "Suivant" : "Terminer"}
              {stepIdx < steps.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

/** Hook to start a tour programmatically */
export function useTour(tourId: string) {
  const storageKey = `signapps-tour-${tourId}`;
  const hasCompleted =
    typeof window !== "undefined" && !!localStorage.getItem(storageKey);
  const resetTour = () => localStorage.removeItem(storageKey);
  return { hasCompleted, resetTour };
}
