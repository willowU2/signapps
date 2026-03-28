'use client';

import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const STORAGE_KEY = 'signapps-high-contrast-focus';

export function HighContrastFocusToggle() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY) === 'true';
    setEnabled(stored);
    applySetting(stored);
  }, []);

  const applySetting = (on: boolean) => {
    if (on) {
      document.body.classList.add('high-contrast-focus');
    } else {
      document.body.classList.remove('high-contrast-focus');
    }
  };

  const toggle = (val: boolean) => {
    setEnabled(val);
    localStorage.setItem(STORAGE_KEY, String(val));
    applySetting(val);
  };

  if (!mounted) return null;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="high-contrast-focus-toggle" className="font-medium cursor-pointer">
            Focus Ring Ultra-Visible
          </Label>
        </div>
        <p className="text-xs text-muted-foreground ml-6">
          Affiche une bordure dynamique très contrastée autour de l'élément sélectionné au clavier.
        </p>
      </div>
      <Switch
        id="high-contrast-focus-toggle"
        checked={enabled}
        onCheckedChange={toggle}
        aria-label="Toggle high contrast focus"
      />
    </div>
  );
}
