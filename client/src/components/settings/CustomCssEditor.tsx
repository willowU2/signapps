'use client';

import { useState, useEffect, useRef } from 'react';
import { Code, Eye, EyeOff, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const STORAGE_KEY = 'signapps-custom-css';
const STYLE_ID = 'signapps-user-css';

const EXAMPLES = [
  { label: 'Arrondi réduit', css: ':root { --radius: 0.25rem; }' },
  { label: 'Fond doux', css: ':root { --background: oklch(0.97 0.01 220); }' },
  { label: 'Police plus grande', css: 'body { font-size: 16px; }' },
];

export function CustomCssEditor() {
  const [css, setCss] = useState('');
  const [applied, setApplied] = useState(false);
  const [preview, setPreview] = useState(false);
  const styleEl = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) || '';
    setCss(stored);
    if (stored) {
      applyCSS(stored);
      setApplied(true);
    }
    return () => {
      // Never remove on unmount — CSS should persist
    };
  }, []);

  function applyCSS(value: string) {
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = value;
  }

  function removeCSS() {
    const el = document.getElementById(STYLE_ID);
    if (el) el.textContent = '';
  }

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, css);
    applyCSS(css);
    setApplied(true);
    toast.success('CSS personnalisé appliqué');
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    removeCSS();
    setCss('');
    setApplied(false);
    toast.success('CSS réinitialisé');
  };

  const handlePreview = () => {
    if (preview) {
      const stored = localStorage.getItem(STORAGE_KEY) || '';
      applyCSS(stored);
    } else {
      applyCSS(css);
    }
    setPreview(!preview);
  };

  const insertExample = (exCss: string) => {
    setCss(prev => prev ? `${prev}\n\n${exCss}` : exCss);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code className="w-5 h-5" />
          CSS Personnalisé
          {applied && <Badge variant="secondary" className="text-xs">Actif</Badge>}
        </CardTitle>
        <CardDescription>
          Injectez du CSS personnalisé à l'exécution. Utilisez des variables CSS pour surcharger le thème.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Exemples rapides</Label>
          </div>
          <div className="flex gap-2 flex-wrap">
            {EXAMPLES.map(ex => (
              <Button key={ex.label} size="sm" variant="outline" onClick={() => insertExample(ex.css)} className="h-7 text-xs">
                {ex.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="custom-css">Votre CSS</Label>
          <Textarea
            id="custom-css"
            value={css}
            onChange={e => setCss(e.target.value)}
            placeholder={`/* Exemple: arrondir les boutons */\n.btn { border-radius: 9999px; }\n\n/* Modifier la couleur primaire */\n:root { --primary: oklch(0.6 0.2 150); }`}
            className="font-mono text-xs min-h-[180px] resize-y"
          />
          <p className="text-xs text-muted-foreground">
            Variables disponibles: --background, --foreground, --primary, --secondary, --border, --radius…
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={!css.trim()}>
            <Save className="w-4 h-4 mr-1.5" />
            Appliquer
          </Button>
          <Button variant="outline" onClick={handlePreview}>
            {preview ? <EyeOff className="w-4 h-4 mr-1.5" /> : <Eye className="w-4 h-4 mr-1.5" />}
            {preview ? 'Annuler aperçu' : 'Aperçu'}
          </Button>
          {applied && (
            <Button variant="ghost" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Réinitialiser
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
