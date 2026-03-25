'use client';

import { useState } from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { aiApi } from '@/lib/api/ai';
import { toast } from 'sonner';

interface SummarizeButtonProps {
  getText: () => string;
  className?: string;
}

export function SummarizeButton({ getText, className }: SummarizeButtonProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSummarize = async () => {
    const text = getText();
    if (!text.trim()) {
      toast.error('Aucun contenu à résumer');
      return;
    }

    setLoading(true);
    setSummary(null);

    try {
      const res = await aiApi.chat(
        `Résume ce document de manière concise en français, en bullet points :\n\n${text.slice(0, 4000)}`,
        { systemPrompt: 'Tu es un assistant qui résume des documents de manière claire et concise.', language: 'fr' }
      );
      setSummary(res.data?.answer || res.data?.response || 'Résumé indisponible');
    } catch {
      toast.error('Erreur lors de la génération du résumé');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSummarize}
        disabled={loading}
        className="gap-1.5"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Résumer
      </Button>

      {summary && (
        <div className="mt-3 p-4 rounded-lg border bg-primary/5 text-sm space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Résumé IA</span>
            <button onClick={() => setSummary(null)} className="p-1 hover:bg-accent rounded">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="text-foreground whitespace-pre-wrap">{summary}</div>
        </div>
      )}
    </div>
  );
}
