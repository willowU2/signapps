"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe, Check } from "lucide-react";
export const SUPPORTED_LANGUAGES = [
  {
    code: "en",
    label: "English",
    englishName: "English",
    dir: "ltr",
    countryCode: "gb",
  },
  {
    code: "fr",
    label: "Français",
    englishName: "French",
    dir: "ltr",
    countryCode: "fr",
  },
  {
    code: "es",
    label: "Español",
    englishName: "Spanish",
    dir: "ltr",
    countryCode: "es",
  },
  {
    code: "de",
    label: "Deutsch",
    englishName: "German",
    dir: "ltr",
    countryCode: "de",
  },
  {
    code: "it",
    label: "Italiano",
    englishName: "Italian",
    dir: "ltr",
    countryCode: "it",
  },
  {
    code: "pt",
    label: "Português",
    englishName: "Portuguese",
    dir: "ltr",
    countryCode: "pt",
  },
  {
    code: "ru",
    label: "Русский",
    englishName: "Russian",
    dir: "ltr",
    countryCode: "ru",
  },
  {
    code: "zh",
    label: "中文 (简体)",
    englishName: "Chinese (Simplified)",
    dir: "ltr",
    countryCode: "cn",
  },
  {
    code: "ja",
    label: "日本語",
    englishName: "Japanese",
    dir: "ltr",
    countryCode: "jp",
  },
  {
    code: "ko",
    label: "한국어",
    englishName: "Korean",
    dir: "ltr",
    countryCode: "kr",
  },
  {
    code: "ar",
    label: "العربية",
    englishName: "Arabic",
    dir: "rtl",
    countryCode: "sa",
  },
  {
    code: "he",
    label: "עברית",
    englishName: "Hebrew",
    dir: "rtl",
    countryCode: "il",
  },
];

export function FlagIcon({
  countryCode,
  className = "",
}: {
  countryCode: string;
  className?: string;
}) {
  return (
    <Image
      src={`https://flagcdn.com/${countryCode}.svg`}
      alt={`Flag of ${countryCode}`}
      width={20}
      height={15}
      className={`rounded-sm object-cover shadow-sm ${className}`}
    />
  );
}

export function useLocale() {
  const [locale, setLocaleState] = useState("fr");

  useEffect(() => {
    const stored = localStorage.getItem("signapps_locale");
    if (stored) {
      setLocaleState(stored);
      return;
    }
    // Auto-detect from browser
    const browserLang = navigator.language.split("-")[0];
    const supported = SUPPORTED_LANGUAGES.find((l) => l.code === browserLang);
    if (supported) setLocaleState(supported.code);
  }, []);

  const setLocale = (code: string) => {
    localStorage.setItem("signapps_locale", code);
    setLocaleState(code);
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    if (lang) {
      document.documentElement.lang = code;
      document.documentElement.dir = lang.dir as "ltr" | "rtl";
    }
  };

  return { locale, setLocale };
}

interface LanguageSwitcherProps {
  compact?: boolean;
}

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { locale, setLocale } = useLocale();
  const current =
    SUPPORTED_LANGUAGES.find((l) => l.code === locale) ||
    SUPPORTED_LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "sm"}
          className="gap-2"
        >
          <Globe className="h-4 w-4" />
          {!compact && (
            <span className="flex items-center gap-2">
              <FlagIcon countryCode={current.countryCode} className="w-4 h-4" />
              {current.label}
            </span>
          )}
          {compact && <span className="sr-only">Switch language</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLocale(lang.code)}
            className="flex items-center gap-2"
            dir={lang.dir}
          >
            <FlagIcon countryCode={lang.countryCode} className="w-4 h-4" />
            <span className="flex-1">{lang.label}</span>
            {locale === lang.code && <Check className="h-4 w-4 text-primary" />}
            {lang.dir === "rtl" && (
              <span className="text-xs text-muted-foreground">(RTL)</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
