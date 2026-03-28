'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe, Check } from 'lucide-react';

export const SUPPORTED_LANGUAGES = [
  { code: 'fr', label: 'Français', dir: 'ltr', flag: '🇫🇷' },
  { code: 'en', label: 'English', dir: 'ltr', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', dir: 'ltr', flag: '🇩🇪' },
  { code: 'es', label: 'Español', dir: 'ltr', flag: '🇪🇸' },
  { code: 'ar', label: 'العربية', dir: 'rtl', flag: '🇸🇦' },
  { code: 'he', label: 'עברית', dir: 'rtl', flag: '🇮🇱' },
];

export function useLocale() {
  const [locale, setLocaleState] = useState('fr');

  useEffect(() => {
    const stored = localStorage.getItem('signapps_locale');
    if (stored) { setLocaleState(stored); return; }
    // Auto-detect from browser
    const browserLang = navigator.language.split('-')[0];
    const supported = SUPPORTED_LANGUAGES.find(l => l.code === browserLang);
    if (supported) setLocaleState(supported.code);
  }, []);

  const setLocale = (code: string) => {
    localStorage.setItem('signapps_locale', code);
    setLocaleState(code);
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
    if (lang) {
      document.documentElement.lang = code;
      document.documentElement.dir = lang.dir as 'ltr' | 'rtl';
    }
  };

  return { locale, setLocale };
}

interface LanguageSwitcherProps {
  compact?: boolean;
}

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { locale, setLocale } = useLocale();
  const current = SUPPORTED_LANGUAGES.find(l => l.code === locale) || SUPPORTED_LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={compact ? 'icon' : 'sm'} className="gap-2">
          <Globe className="h-4 w-4" />
          {!compact && <span>{current.flag} {current.label}</span>}
          {compact && <span className="sr-only">Switch language</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGUAGES.map(lang => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLocale(lang.code)}
            className="flex items-center gap-2"
            dir={lang.dir}
          >
            <span>{lang.flag}</span>
            <span className="flex-1">{lang.label}</span>
            {locale === lang.code && <Check className="h-4 w-4 text-primary" />}
            {lang.dir === 'rtl' && (
              <span className="text-xs text-muted-foreground">(RTL)</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
