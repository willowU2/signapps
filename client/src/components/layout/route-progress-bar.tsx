"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Slim progress bar at the top of the page during route transitions.
 * Similar to YouTube/GitHub loading indicators.
 */
export function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevUrlRef = useRef("");

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const finishProgress = useCallback(() => {
    cleanup();
    setProgress(100);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300);
  }, [cleanup]);

  useEffect(() => {
    const currentUrl = pathname + (searchParams?.toString() || "");

    // On first mount, just record the URL
    if (!prevUrlRef.current) {
      prevUrlRef.current = currentUrl;
      return;
    }

    // URL changed -- we navigated
    if (prevUrlRef.current !== currentUrl) {
      prevUrlRef.current = currentUrl;
      // The new page has loaded, finish the progress
      finishProgress();
    }
  }, [pathname, searchParams, finishProgress]);

  // Intercept clicks on <a> tags to start progress
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("http") ||
        href.startsWith("mailto:")
      )
        return;
      if (anchor.target === "_blank") return;

      const currentUrl = pathname + (searchParams?.toString() || "");
      // Only start progress if it's a different page
      if (href === currentUrl || href === pathname) return;

      // Start the progress bar
      cleanup();
      setVisible(true);
      setProgress(15);

      // Simulate incremental progress
      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 90;
          }
          // Slow down as we approach completion
          const increment = Math.max(1, Math.floor((90 - prev) / 5));
          return Math.min(90, prev + increment);
        });
      }, 200);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, searchParams, cleanup]);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[2.5px] pointer-events-none"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-primary transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
          boxShadow: visible
            ? "0 0 8px var(--primary), 0 0 4px var(--primary)"
            : "none",
        }}
      />
    </div>
  );
}
