'use client';

import { useState } from 'react';
import { Tags, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { aiApi } from '@/lib/api/ai';
import { toast } from 'sonner';

interface AutoTagButtonProps {
  content: string;
  existingTags?: string[];
  onTagsGenerated: (tags: string[]) => void;
  className?: string;
}

export function AutoTagButton({ content, existingTags = [], onTagsGenerated, className }: AutoTagButtonProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const handleAutoTag = async () => {
    if (!content.trim()) {
      toast.error('Aucun contenu à analyser');
      return;
    }

    setLoading(true);
    setSuggestions([]);

    try {
      const res = await aiApi.chat(
        `Génère 3 à 5 tags pertinents pour ce contenu. Retourne uniquement les tags séparés par des virgules, sans explication.\n\nContenu:\n${content.slice(0, 2000)}`,
        { systemPrompt: 'Tu génères des tags courts et pertinents. Retourne uniquement les tags séparés par des virgules.', language: 'fr' }
      );

      const answer = res.data?.answer || (res.data as any)?.response || '';
      const tags = answer
        .split(',')
        .map((t: string) => t.trim().toLowerCase().replace(/[^a-zà-ÿ0-9-]/g, ''))
        .filter((t: string) => t.length > 1 && !existingTags.includes(t));

      setSuggestions(tags);
    } catch {
      toast.error('Erreur lors de la génération des tags');
    } finally {
      setLoading(false);
    }
  };

  const acceptTag = (tag: string) => {
    onTagsGenerated([...existingTags, tag]);
    setSuggestions(prev => prev.filter(t => t !== tag));
  };

  const acceptAll = () => {
    onTagsGenerated([...existingTags, ...suggestions]);
    setSuggestions([]);
  };

  return (
    <div className={className}>
      <Button variant="outline" size="sm" onClick={handleAutoTag} disabled={loading} className="gap-1.5">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tags className="h-3.5 w-3.5" />}
        Auto-tag
      </Button>

      {suggestions.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {suggestions.map(tag => (
            <Badge
              key={tag}
              variant="outline"
              className="cursor-pointer hover:bg-primary/10 transition-colors"
              onClick={() => acceptTag(tag)}
            >
              + {tag}
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={acceptAll} className="text-xs h-6">
            Tout accepter
          </Button>
        </div>
      )}
    </div>
  );
}
