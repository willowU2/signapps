'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const themes = [
    { id: 'light', label: 'Clair', icon: Sun },
    { id: 'dark', label: 'Sombre', icon: Moon },
    { id: 'system', label: 'Système', icon: Monitor },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Thème de l'application</CardTitle>
          <CardDescription>Choisissez l'apparence de SignApps adaptée à votre environnement de travail.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
            {themes.map((t) => {
              const Icon = t.icon;
              const isActive = theme === t.id;
              
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`
                    flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all
                    ${isActive 
                      ? 'border-primary bg-primary/5 text-primary' 
                      : 'border-transparent bg-muted hover:bg-muted/80 text-muted-foreground'
                    }
                  `}
                >
                  <Icon className={`w-8 h-8 mb-3 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
