'use client';

import { useEffect, useState } from 'react';
import { Type } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const STORAGE_KEY = 'signapps-dyslexia-font';

export function DyslexiaFontToggle() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY) === 'true';
    setEnabled(stored);
    applyFont(stored);
  }, []);

  const applyFont = (on: boolean) => {
    if (on) {
      document.documentElement.classList.add('dyslexia-font');
    } else {
      document.documentElement.classList.remove('dyslexia-font');
    }
  };

  const toggle = (val: boolean) => {
    setEnabled(val);
    localStorage.setItem(STORAGE_KEY, String(val));
    applyFont(val);
  };

  if (!mounted) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Type className="h-4 w-4 text-muted-foreground" />
        <Label htmlFor="dyslexia-toggle" className="font-medium cursor-pointer">
          Police dyslexie (OpenDyslexic)
        </Label>
      </div>
      <Switch
        id="dyslexia-toggle"
        checked={enabled}
        onCheckedChange={toggle}
        aria-label="Toggle dyslexia-friendly font"
      />
    </div>
  );
}
