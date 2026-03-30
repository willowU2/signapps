'use client';

import { useEffect, type ReactNode } from 'react';
import { setLocale, type Locale } from './index';
import { SUPPORTED_LANGUAGES } from '@/components/i18n/language-switcher';

const STORAGE_KEY = 'signapps-locale';

/**
 * I18nProvider — mounts at app root to:
 * 1. Detect browser language on first visit
 * 2. Restore saved locale from localStorage
 * 3. Apply dir="rtl" | "ltr" to <html> for RTL languages
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;

    if (stored === 'fr' || stored === 'en') {
      setLocale(stored);
      applyDir(stored);
    } else {
      // First visit: detect browser language
      const browserLang = navigator.language.split('-')[0] as Locale;
      const detectedLocale: Locale = browserLang === 'en' ? 'en' : 'fr';
      setLocale(detectedLocale);
      localStorage.setItem(STORAGE_KEY, detectedLocale);
      applyDir(detectedLocale);
    }
  }, []);

  return <>{children}</>;
}

function applyDir(locale: Locale) {
  // lib/i18n only supports fr/en (both LTR); full RTL handled by RTLProvider
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === locale);
  if (lang) {
    document.documentElement.lang = locale;
    document.documentElement.dir = lang.dir as 'ltr' | 'rtl';
  } else {
    document.documentElement.lang = locale;
    document.documentElement.dir = 'ltr';
  }
}
