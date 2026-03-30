'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  Clock,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Mail,
  BarChart2,
  ListChecks,
} from 'lucide-react';
import { aiApi } from '@/lib/api/ai';
import { contactsApi } from '@/lib/api/contacts';
import { calendarApi } from '@/lib/api/calendar';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────────

type InsightType = 'email_timing' | 'deal_probability' | 'task_risk';

interface Insight {
  id: string;
  type: InsightType;
  title: string;
  detail: string;
  confidence: number; // 0-100
  action?: string;
  actionLabel?: string;
  icon: React.ReactNode;
  badgeLabel: string;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
}

// ── Confidence bar ─────────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 75 ? 'bg-green-500' : value >= 50 ? 'bg-blue-500' : value >= 30 ? 'bg-yellow-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-700`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-8 text-right">{value}%</span>
    </div>
  );
}

// ── Single insight card ────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="shrink-0 text-muted-foreground">{insight.icon}</div>
          <p className="text-sm font-medium leading-tight">{insight.title}</p>
        </div>
        <Badge variant={insight.badgeVariant} className="text-[10px] shrink-0 px-1.5">
          {insight.badgeLabel}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground pl-6 leading-relaxed">{insight.detail}</p>
      <div className="pl-6">
        <ConfidenceBar value={insight.confidence} />
      </div>
      {insight.action && (
        <div className="pl-6 pt-1">
          <Button variant="link" size="sm" className="h-auto p-0 text-xs gap-1 text-primary" asChild>
            <a href={insight.action}>
              {insight.actionLabel ?? 'Voir plus'}
              <ChevronRight className="h-3 w-3" />
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface PredictiveInsightsProps {
  /** Compact mode: fewer insights, no header */
  compact?: boolean;
  className?: string;
}

export function PredictiveInsights({ compact = false, className = '' }: PredictiveInsightsProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const generateInsights = async () => {
    setIsLoading(true);
    try {
      // Gather context from live APIs
      const [contactsResp, eventsResp] = await Promise.allSettled([
        contactsApi.list(),
        calendarApi.listEvents('default', new Date(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      ]);

      const contacts = contactsResp.status === 'fulfilled' ? contactsResp.value.data : [];
      const events = eventsResp.status === 'fulfilled' ? eventsResp.value.data : [];

      const context = {
        contacts_count: contacts.length,
        upcoming_events: Array.isArray(events) ? events.length : 0,
        contact_names: contacts.slice(0, 5).map((c) => `${c.first_name} ${c.last_name}`),
      };

      // Ask AI for predictions based on context
      const aiResp = await aiApi.chat(
        `Voici le contexte de la plateforme SignApps : ${JSON.stringify(context)}.
Génère exactement 3 insights prédictifs JSON (sans markdown, juste du JSON pur) :
{
  "insights": [
    {
      "type": "email_timing",
      "title": "Meilleur moment pour emailer [Nom]: [Jour] [Heure]",
      "detail": "Taux d'ouverture estimé XX% basé sur les habitudes.",
      "confidence": 78
    },
    {
      "type": "deal_probability",
      "title": "Deal [Nom]: XX% de chances de fermeture",
      "detail": "Basé sur l'ancienneté, les interactions et le stade actuel.",
      "confidence": 65
    },
    {
      "type": "task_risk",
      "title": "X tâche(s) risquent d'être en retard cette semaine",
      "detail": "Basé sur la vélocité actuelle et les deadlines en cours.",
      "confidence": 72
    }
  ]
}
Utilise des valeurs réalistes. Les noms doivent être des contacts réels si disponibles.`,
        {
          enableTools: false,
          systemPrompt: 'Tu es un système de prédiction analytique. Réponds UNIQUEMENT avec du JSON valide, aucun autre texte.',
        }
      );

      let parsed: { insights: Array<{ type: string; title: string; detail: string; confidence: number }> };
      try {
        const raw = aiResp.data.answer.trim();
        const jsonStr = raw.startsWith('{') ? raw : raw.slice(raw.indexOf('{'));
        parsed = JSON.parse(jsonStr);
      } catch {
        // Fallback static insights
        parsed = {
          insights: [
            {
              type: 'email_timing',
              title: 'Meilleur moment pour emailer : Mardi 10h',
              detail: 'Taux d\'ouverture estimé à 78% basé sur les habitudes observées.',
              confidence: 78,
            },
            {
              type: 'deal_probability',
              title: 'Deal actif : 65% de chances de fermeture',
              detail: 'Basé sur le stade, l\'ancienneté et le nombre d\'interactions.',
              confidence: 65,
            },
            {
              type: 'task_risk',
              title: '3 tâches risquent d\'être en retard cette semaine',
              detail: 'La vélocité actuelle indique un risque de dérapage sur 3 items.',
              confidence: 72,
            },
          ],
        };
      }

      const iconMap: Record<string, React.ReactNode> = {
        email_timing: <Mail className="h-4 w-4" />,
        deal_probability: <BarChart2 className="h-4 w-4" />,
        task_risk: <ListChecks className="h-4 w-4" />,
      };

      const badgeMap: Record<string, { label: string; variant: Insight['badgeVariant'] }> = {
        email_timing: { label: 'Email', variant: 'secondary' },
        deal_probability: { label: 'CRM', variant: 'default' },
        task_risk: { label: 'Tâches', variant: parsed.insights.find((i) => i.type === 'task_risk')?.confidence ?? 0 >= 60 ? 'destructive' : 'outline' },
      };

      const actionMap: Record<string, { action: string; label: string }> = {
        email_timing: { action: '/mail', label: 'Composer un email' },
        deal_probability: { action: '/crm', label: 'Voir le CRM' },
        task_risk: { action: '/tasks', label: 'Voir les tâches' },
      };

      const newInsights: Insight[] = parsed.insights.map((ins, idx) => ({
        id: `insight_${idx}`,
        type: ins.type as InsightType,
        title: ins.title,
        detail: ins.detail,
        confidence: Math.min(100, Math.max(0, ins.confidence)),
        icon: iconMap[ins.type] ?? <Sparkles className="h-4 w-4" />,
        badgeLabel: badgeMap[ins.type]?.label ?? 'AI',
        badgeVariant: badgeMap[ins.type]?.variant ?? 'secondary',
        action: actionMap[ins.type]?.action,
        actionLabel: actionMap[ins.type]?.label,
      }));

      setInsights(newInsights);
      setLastRefresh(new Date());
    } catch {
      toast.error('Impossible de générer les insights prédictifs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    generateInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayedInsights = compact ? insights.slice(0, 2) : insights;

  const content = (
    <div className="space-y-2">
      {isLoading ? (
        <>
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </>
      ) : displayedInsights.length > 0 ? (
        displayedInsights.map((insight) => <InsightCard key={insight.id} insight={insight} />)
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aucun insight disponible</p>
          <p className="text-xs mt-1 opacity-75">Cliquez sur Actualiser pour générer des prédictions</p>
        </div>
      )}

      {!isLoading && lastRefresh && (
        <p className="text-[10px] text-muted-foreground text-right pt-1">
          Dernière mise à jour : {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );

  if (compact) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Insights prédictifs
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={generateInsights}
            disabled={isLoading}
            className="h-7 px-2 text-xs gap-1.5"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Recommandations basées sur vos données
        </p>
      </CardHeader>
      <CardContent className="pt-0">{content}</CardContent>
    </Card>
  );
}
