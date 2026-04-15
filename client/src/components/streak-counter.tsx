"use client";

import { useEffect, useState } from "react";

export function StreakCounter() {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const key = "signapps-streak";
    const lastKey = "signapps-streak-last";
    const today = new Date().toISOString().slice(0, 10);
    const last = localStorage.getItem(lastKey);
    let s = parseInt(localStorage.getItem(key) || "0", 10);

    if (last === today) {
      setStreak(s);
      return;
    }

    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);
    if (last === yesterday) {
      s++;
    } else {
      s = 1;
    }

    localStorage.setItem(key, String(s));
    localStorage.setItem(lastKey, today);
    setStreak(s);
  }, []);

  if (streak <= 0) return null;

  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-orange-500 font-medium"
      title={streak + " jours consecutifs"}
    >
      <span className="text-sm">&#128293;</span>
      {streak}j
    </span>
  );
}
