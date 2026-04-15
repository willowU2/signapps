"use client";

import { useCallback, useSyncExternalStore } from "react";
import { fr, type TranslationKey } from "./fr";
import { en } from "./en";

export type Locale = "fr" | "en";

const STORAGE_KEY = "signapps-locale";
const dictionaries: Record<Locale, Record<TranslationKey, string>> = { fr, en };

let currentLocale: Locale = "fr";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function getLocale(): Locale {
  return currentLocale;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Initialize from localStorage
if (typeof window !== "undefined") {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "fr") {
    currentLocale = stored;
  }
}

export function setLocale(locale: Locale) {
  currentLocale = locale;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, locale);
  }
  notify();
}

export function useTranslation() {
  const locale = useSyncExternalStore(
    subscribe,
    getLocale,
    () => "fr" as Locale,
  );
  const dict = dictionaries[locale];

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      let text = dict[key] || key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [dict],
  );

  return { t, locale, setLocale };
}

export type { TranslationKey };
