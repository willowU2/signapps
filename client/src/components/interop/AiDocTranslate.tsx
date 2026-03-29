'use client';

/**
 * Feature 7: AI → translate doc content
 */

import { useState } from 'react';
import { Languages, Loader2, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useTranslateDoc } from '@/hooks/use-cross-module';

const LANGUAGES = [
  { code: 'anglais', label: 'Anglais' },
  { code: 'français', label: 'Français' },
  { code: 'espagnol', label: 'Espagnol' },
  { code: 'allemand', label: 'Allemand' },
  { code: 'italien', label: 'Italien' },
  { code: 'portugais', label: 'Portugais' },
  { code: 'japonais', label: 'Japonais' },
  { code: 'chinois', label: 'Chinois' },
  { code: 'arabe', label: 'Arabe' },
];

interface AiDocTranslateProps {
  getText: () => string;
  onApply?: (translated: string) => void;
}

export function AiDocTranslate({ getText, onApply }: AiDocTranslateProps) {
  const [open, setOpen] = useState(false);
  const [targetLang, setTargetLang] = useState('anglais');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);
  const translate = useTranslateDoc();

  const handleTranslate = async () => {
    const text = getText();
    if (!text.trim()) { toast.error('Document vide'); return; }
    setLoading(true);
    setResult('');
    try {
      const translated = await translate(text, targetLang);
      setResult(translated);
    } catch {
      toast.error('Erreur de traduction');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success('Traduction copiée');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Languages className="h-3.5 w-3.5" />
          Traduire
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Languages className="h-4 w-4 text-primary" />
          Traduire le document
        </p>

        <Select value={targetLang} onValueChange={setTargetLang}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" className="w-full gap-1.5" onClick={handleTranslate} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
          Traduire
        </Button>

        {result && (
          <div className="space-y-2">
            <div className="max-h-40 overflow-y-auto rounded border bg-primary/5 p-2 text-xs whitespace-pre-wrap">
              {result}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="flex-1 gap-1.5" onClick={handleCopy}>
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                Copier
              </Button>
              {onApply && (
                <Button size="sm" className="flex-1" onClick={() => { onApply(result); setOpen(false); }}>
                  Appliquer
                </Button>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
