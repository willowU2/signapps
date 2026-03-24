"use client";

import { useEffect, useRef } from "react";

export function useAutosave<T>(key: string, data: T, interval = 30000) {
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    const timer = setInterval(() => {
      try { localStorage.setItem("autosave:" + key, JSON.stringify(dataRef.current)); } catch {}
    }, interval);
    return () => clearInterval(timer);
  }, [key, interval]);

  return {
    restore: (): T | null => {
      try {
        const stored = localStorage.getItem("autosave:" + key);
        return stored ? JSON.parse(stored) : null;
      } catch { return null; }
    },
    clear: () => { try { localStorage.removeItem("autosave:" + key); } catch {} },
  };
}
