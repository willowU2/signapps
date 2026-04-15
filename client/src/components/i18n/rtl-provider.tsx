"use client";

import { useEffect } from "react";
import { SUPPORTED_LANGUAGES } from "./language-switcher";

/**
 * RTL Layout Support
 * Reads the stored locale on mount and applies dir="rtl" to <html> for Arabic/Hebrew.
 * Tailwind 4 uses `[dir=rtl]:*` selectors automatically.
 */
export function RTLProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const locale = localStorage.getItem("signapps_locale") || "fr";
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === locale);
    if (lang) {
      document.documentElement.lang = locale;
      document.documentElement.dir = lang.dir as "ltr" | "rtl";
    }
  }, []);

  return <>{children}</>;
}
