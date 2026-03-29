'use client';

// Idea 29: Smart suggestions — AI suggests next action based on context
// Idea 45: Smart routing — AI routes incoming data to the right module

import { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { getClient, ServiceName } from '@/lib/api/factory';

const aiClient = () => getClient(ServiceName.AI);

interface Suggestion {
  id: string;
  action: string;
  label: string;
  description: string;
  target_module: string;
  target_url: string;
  confidence: number;
}

interface Props {
  entityType: string;
  entityId: string;
  entityTitle: string;
  context?: Record<string, unknown>;
}

/** Idea 29 – AI next-action suggestions */
export function SmartSuggestions({ entityType, entityId, entityTitle, context }: Props) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    aiClient().post<Suggestion[]>('/suggest/next-action', {
      entity_type: entityType,
      entity_id: entityId,
      entity_title: entityTitle,
      context: context || {},
    }).then(({ data }) => {
      if (!cancelled) setSuggestions(data.slice(0, 3));
    }).catch(() => {
      // Local heuristics fallback
      if (!cancelled) {
        const fallback = buildFallbackSuggestions(entityType, entityId, entityTitle);
        setSuggestions(fallback);
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [entityType, entityId, entityTitle, context]);

  const visible = suggestions.filter(s => !dismissed.has(s.id));

  if (loading) return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      Analyse du contexte…
    </div>
  );

  if (!visible.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="w-3.5 h-3.5 text-violet-500" />
        Suggestions intelligentes
      </div>
      {visible.map(s => (
        <Card key={s.id} className="border-violet-200/50 dark:border-violet-800/50">
          <CardContent className="p-2.5 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <p className="text-xs font-medium leading-tight">{s.label}</p>
                <Badge variant="outline" className="text-[10px] h-3.5 px-1 text-violet-600 border-violet-300">
                  {Math.round(s.confidence * 100)}%
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">{s.description}</p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 gap-1 text-[10px]"
                onClick={() => { router.push(s.target_url); toast.info(s.label); }}>
                <ArrowRight className="w-3 h-3" />Faire
              </Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground"
                onClick={() => setDismissed(p => new Set([...p, s.id]))}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function buildFallbackSuggestions(type: string, id: string, title: string): Suggestion[] {
  const suggestions: Suggestion[] = [];
  if (type === 'mail_message') {
    suggestions.push({
      id: 'f1', action: 'create_task', label: 'Créer une tâche',
      description: `Transformer cet email en tâche actionnable`,
      target_module: 'tasks', target_url: `/tasks?from=mail:${id}`, confidence: 0.85,
    });
  }
  if (type === 'contact') {
    suggestions.push({
      id: 'f2', action: 'send_mail', label: 'Envoyer un email',
      description: `Envoyer un email à ${title}`,
      target_module: 'mail', target_url: `/mail?to=${id}`, confidence: 0.90,
    });
  }
  if (type === 'task') {
    suggestions.push({
      id: 'f3', action: 'create_event', label: 'Planifier dans le calendrier',
      description: `Bloquer du temps pour cette tâche`,
      target_module: 'calendar', target_url: `/calendar?task=${id}`, confidence: 0.75,
    });
  }
  return suggestions;
}

/** Idea 45 – Route incoming text/data to the right module */
export async function smartRoute(text: string): Promise<{ module: string; url: string; confidence: number }> {
  try {
    const { data } = await aiClient().post<{ module: string; url: string; confidence: number }>(
      '/route', { text }
    );
    return data;
  } catch {
    // Heuristic routing
    const lower = text.toLowerCase();
    if (lower.includes('@') || lower.includes('email')) return { module: 'mail', url: '/mail', confidence: 0.7 };
    if (lower.includes('réunion') || lower.includes('meeting')) return { module: 'calendar', url: '/calendar', confidence: 0.8 };
    if (lower.includes('facture') || lower.includes('invoice')) return { module: 'billing', url: '/billing', confidence: 0.75 };
    if (lower.includes('fichier') || lower.includes('document')) return { module: 'drive', url: '/drive', confidence: 0.7 };
    return { module: 'tasks', url: '/tasks', confidence: 0.5 };
  }
}
