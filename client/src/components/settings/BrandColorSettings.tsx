'use client';

import { useState, useEffect } from 'react';
import { Palette, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

const STORAGE_KEY = 'signapps-brand-color';
const STYLE_ID = 'signapps-brand-colors';

type OklchColor = { l: number; c: number; h: number };

function hexToOklch(hex: string): OklchColor {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const l = (0.299 * r + 0.587 * g + 0.114 * b);
  const chroma = Math.sqrt(Math.pow(r - g, 2) + Math.pow(g - b, 2) + Math.pow(b - r, 2)) * 0.3;
  const h = Math.atan2(g - b, r - g) * (180 / Math.PI);
  return { l: Math.min(0.95, Math.max(0.1, l)), c: Math.min(0.3, chroma * 0.5), h: (h + 360) % 360 };
}

function derivePalette(hex: string) {
  const { l, c, h } = hexToOklch(hex);
  return {
    primary: `oklch(${l.toFixed(2)} ${c.toFixed(3)} ${h.toFixed(1)})`,
    primaryFg: l > 0.5 ? 'oklch(0.15 0.01 0)' : 'oklch(0.98 0 0)',
    ring: `oklch(${l.toFixed(2)} ${c.toFixed(3)} ${h.toFixed(1)} / 30%)`,
    accent: `oklch(${Math.min(0.97, l + 0.45).toFixed(2)} ${(c * 0.2).toFixed(3)} ${h.toFixed(1)})`,
    sidebarPrimary: `oklch(${l.toFixed(2)} ${c.toFixed(3)} ${h.toFixed(1)})`,
  };
}

function applyBrandColor(hex: string) {
  const palette = derivePalette(hex);
  const css = `
:root {
  --primary: ${palette.primary};
  --primary-foreground: ${palette.primaryFg};
  --ring: ${palette.ring};
  --accent: ${palette.accent};
  --sidebar-primary: ${palette.sidebarPrimary};
  --sidebar-primary-foreground: ${palette.primaryFg};
}
`;
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

const PRESET_COLORS = [
  { label: 'Indigo', hex: '#6366f1' },
  { label: 'Bleu', hex: '#3b82f6' },
  { label: 'Vert', hex: '#10b981' },
  { label: 'Orange', hex: '#f97316' },
  { label: 'Rose', hex: '#ec4899' },
  { label: 'Violet', hex: '#8b5cf6' },
  { label: 'Rouge', hex: '#ef4444' },
  { label: 'Teal', hex: '#14b8a6' },
];

export function BrandColorSettings() {
  const [color, setColor] = useState('#6366f1');
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) { setColor(stored); applyBrandColor(stored); setApplied(true); }
  }, []);

  const apply = (hex: string) => {
    setColor(hex);
    applyBrandColor(hex);
    localStorage.setItem(STORAGE_KEY, hex);
    setApplied(true);
    toast.success('Couleur de marque appliquée');
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    const el = document.getElementById(STYLE_ID);
    if (el) el.textContent = '';
    setApplied(false);
    setColor('#6366f1');
    toast.success('Couleur réinitialisée');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Couleur de marque
        </CardTitle>
        <CardDescription>
          Définissez une couleur principale. La palette complète (accent, ring, sidebar) sera dérivée automatiquement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map(p => (
            <button
              key={p.hex}
              onClick={() => apply(p.hex)}
              className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${color === p.hex ? 'ring-2 ring-offset-2 ring-current scale-110' : ''}`}
              style={{ backgroundColor: p.hex }}
              title={p.label}
            />
          ))}
        </div>

        <Separator />

        <div className="flex items-center gap-3">
          <div className="space-y-1 flex-1">
            <Label htmlFor="brand-color">Couleur personnalisée</Label>
            <div className="flex gap-2">
              <input
                type="color"
                id="brand-color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-10 h-9 rounded border cursor-pointer bg-transparent"
              />
              <Input
                value={color}
                onChange={e => {
                  if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setColor(e.target.value);
                }}
                className="font-mono text-sm w-28"
              />
              <Button onClick={() => apply(color)} disabled={color.length !== 7}>
                Appliquer
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-muted-foreground">Aperçu de la couleur primaire</span>
          <Button size="sm" variant="default" className="ml-auto h-7 text-xs pointer-events-none"
            style={{ background: color }}>
            Bouton exemple
          </Button>
        </div>

        {applied && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Restaurer défaut
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
