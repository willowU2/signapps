'use client';

import { useEffect } from 'react';

const STORAGE_KEY = 'signapps-theme-preferences';

const COLOR_IDS = ['blue', 'green', 'purple', 'orange', 'red'];
const FONT_SIZE_IDS = ['small', 'medium', 'large'];
const RADIUS_IDS = ['sharp', 'rounded', 'pill'];

/**
 * Restores theme customization preferences from localStorage on mount.
 * This component renders nothing — it only applies CSS classes to <html>.
 */
export function ThemeInitializer() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const prefs = JSON.parse(stored);
      const root = document.documentElement;

      // Primary color
      if (prefs.primaryColor && COLOR_IDS.includes(prefs.primaryColor)) {
        COLOR_IDS.forEach((c) => root.classList.remove(`theme-${c}`));
        root.classList.add(`theme-${prefs.primaryColor}`);
      }

      // Font size
      if (prefs.fontSize && FONT_SIZE_IDS.includes(prefs.fontSize)) {
        FONT_SIZE_IDS.forEach((f) => root.classList.remove(`font-size-${f}`));
        root.classList.add(`font-size-${prefs.fontSize}`);
      }

      // Compact mode
      if (prefs.compactMode === true) {
        root.classList.add('compact-mode');
      } else {
        root.classList.remove('compact-mode');
      }

      // Border radius
      if (prefs.borderRadius && RADIUS_IDS.includes(prefs.borderRadius)) {
        RADIUS_IDS.forEach((b) => root.classList.remove(`radius-${b}`));
        root.classList.add(`radius-${prefs.borderRadius}`);
      }
    } catch {
      // Ignore parse errors — keep defaults
    }
  }, []);

  return null;
}
