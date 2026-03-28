'use client';

import { LayoutList, AlignJustify, Rows3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePreferencesStore, selectLayout } from '@/lib/preferences/store';
import type { DensityMode } from '@/lib/preferences/types';
import { useEffect } from 'react';

const MODES: { value: DensityMode; label: string; description: string; icon: React.ReactNode; preview: string }[] = [
  {
    value: 'compact',
    label: 'Compact',
    description: 'Plus de contenu, moins d\'espace',
    icon: <LayoutList className="w-5 h-5" />,
    preview: 'py-1 text-xs',
  },
  {
    value: 'comfortable',
    label: 'Confortable',
    description: 'Équilibre espace et contenu',
    icon: <AlignJustify className="w-5 h-5" />,
    preview: 'py-2 text-sm',
  },
  {
    value: 'spacious',
    label: 'Aéré',
    description: 'Beaucoup d\'espace, zen',
    icon: <Rows3 className="w-5 h-5" />,
    preview: 'py-3 text-base',
  },
];

function applyDensity(density: DensityMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-density', density);
  // Inject CSS for density
  const STYLE_ID = 'signapps-density';
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  const scales = { compact: '0.875', comfortable: '1', spacious: '1.125' };
  const paddings = { compact: '0.375rem 0.625rem', comfortable: '0.5rem 0.75rem', spacious: '0.75rem 1rem' };
  el.textContent = `
    [data-density="${density}"] .btn, [data-density="${density}"] button:not(.icon-btn) {
      font-size: ${scales[density]}rem;
      padding: ${paddings[density]};
    }
    [data-density="${density}"] .p-4 { padding: ${density === 'compact' ? '0.75rem' : density === 'spacious' ? '1.5rem' : '1rem'}; }
    [data-density="${density}"] .space-y-4 > * + * { margin-top: ${density === 'compact' ? '0.75rem' : density === 'spacious' ? '1.5rem' : '1rem'}; }
    [data-density="${density}"] .text-sm { font-size: ${density === 'compact' ? '0.8rem' : density === 'spacious' ? '0.95rem' : '0.875rem'}; }
  `;
}

export function DensityModeToggle() {
  const layout = usePreferencesStore(selectLayout);
  const updateLayout = usePreferencesStore(s => s.updateLayout);

  useEffect(() => {
    applyDensity(layout.density);
  }, [layout.density]);

  const setDensity = (density: DensityMode) => {
    updateLayout({ density });
    applyDensity(density);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlignJustify className="w-5 h-5" />
          Densité de l'interface
        </CardTitle>
        <CardDescription>
          Ajustez l'espacement de l'interface selon vos préférences.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {MODES.map(mode => {
            const isActive = layout.density === mode.value;
            return (
              <button
                key={mode.value}
                onClick={() => setDensity(mode.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                  isActive ? 'border-primary bg-primary/5' : 'border-transparent bg-muted hover:bg-muted/80'
                }`}
              >
                <div className={isActive ? 'text-primary' : 'text-muted-foreground'}>
                  {mode.icon}
                </div>
                <div className="text-center">
                  <p className={`font-medium text-sm ${isActive ? 'text-primary' : ''}`}>{mode.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{mode.description}</p>
                </div>
                <div className={`w-full space-y-1 mt-1`}>
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={`bg-border rounded w-full ${mode.preview}`}
                      style={{ height: mode.value === 'compact' ? '4px' : mode.value === 'spacious' ? '8px' : '6px' }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
