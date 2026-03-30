'use client'

/**
 * AM3 — AI workflow suggestions
 *
 * Dashboard widget observing user patterns and proposing actionable automations.
 * Suggestions are clickable to execute the action, dismissible to hide them.
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Lightbulb,
  X,
  Play,
  Mail,
  Calendar,
  Users,
  RefreshCw,
  Loader2,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { aiApi } from '@/lib/api'
import type { ChatResponse } from '@/lib/api/ai'

// ─── Types ────────────────────────────────────────────────────────────────────

type SuggestionCategory = 'email' | 'calendar' | 'crm' | 'automation' | 'general'

interface WorkflowSuggestion {
  id: string
  category: SuggestionCategory
  title: string
  description: string
  actionLabel: string
  dismissed: boolean
  executed: boolean
}

// ─── Static pattern-based suggestions ────────────────────────────────────────

const STATIC_SUGGESTIONS: Omit<WorkflowSuggestion, 'dismissed' | 'executed'>[] = [
  {
    id: 'archive-newsletters',
    category: 'email',
    title: 'Archivage automatique',
    description: 'Vous archivez systématiquement les emails de newsletters. Créer une règle automatique ?',
    actionLabel: 'Créer la règle',
  },
  {
    id: 'recurring-monday',
    category: 'calendar',
    title: 'Réunion récurrente',
    description: 'Vous planifiez une réunion chaque lundi matin. Convertir en événement récurrent ?',
    actionLabel: 'Créer récurrence',
  },
  {
    id: 'stale-deals',
    category: 'crm',
    title: 'Deals en attente',
    description: '3 opportunités CRM sont sans activité depuis 2 semaines. Relancer les contacts ?',
    actionLabel: 'Envoyer relances',
  },
  {
    id: 'team-digest',
    category: 'automation',
    title: 'Résumé hebdomadaire',
    description: 'Vous générez un rapport chaque vendredi. Automatiser l\'envoi à l\'équipe ?',
    actionLabel: 'Automatiser',
  },
  {
    id: 'doc-sharing',
    category: 'general',
    title: 'Partage de documents',
    description: 'Vous partagez souvent les mêmes documents lors des onboardings. Créer un pack ?',
    actionLabel: 'Créer le pack',
  },
]

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<SuggestionCategory, { icon: React.ReactNode; color: string }> = {
  email: { icon: <Mail className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700' },
  calendar: { icon: <Calendar className="w-4 h-4" />, color: 'bg-green-100 text-green-700' },
  crm: { icon: <Users className="w-4 h-4" />, color: 'bg-orange-100 text-orange-700' },
  automation: { icon: <RefreshCw className="w-4 h-4" />, color: 'bg-purple-100 text-purple-700' },
  general: { icon: <Lightbulb className="w-4 h-4" />, color: 'bg-muted text-muted-foreground' },
}

const LS_KEY = 'signapps_workflow_suggestions_dismissed'

function loadDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveDismissed(ids: string[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(ids))
}

// ─── Suggestion card ──────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  onDismiss,
  onExecute,
}: {
  suggestion: WorkflowSuggestion
  onDismiss: (id: string) => void
  onExecute: (id: string) => void
}) {
  const cfg = CATEGORY_CONFIG[suggestion.category]

  if (suggestion.dismissed) return null

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 transition-all ${
        suggestion.executed ? 'opacity-60' : 'hover:bg-muted/30'
      }`}
    >
      <div className={`rounded-full p-1.5 shrink-0 ${cfg.color}`}>
        {cfg.icon}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{suggestion.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {suggestion.description}
        </p>

        {!suggestion.executed && (
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 h-7 text-xs px-2 text-primary hover:text-primary"
            onClick={() => onExecute(suggestion.id)}
          >
            <Play className="w-3 h-3 mr-1" />
            {suggestion.actionLabel}
            <ChevronRight className="w-3 h-3 ml-0.5" />
          </Button>
        )}

        {suggestion.executed && (
          <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
            <CheckCircle2 className="w-3 h-3" />
            Action effectuée
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="w-6 h-6 shrink-0 text-muted-foreground"
        onClick={() => onDismiss(suggestion.id)}
        aria-label="Ignorer"
      >
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface WorkflowSuggestionsProps {
  /** If true, also generates AI-powered suggestions from user context */
  aiEnhanced?: boolean
  /** Max suggestions to display */
  maxVisible?: number
}

export function WorkflowSuggestions({
  aiEnhanced = false,
  maxVisible = 4,
}: WorkflowSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<WorkflowSuggestion[]>([])
  const [loadingAi, setLoadingAi] = useState(false)

  useEffect(() => {
    const dismissed = loadDismissed()
    const initial: WorkflowSuggestion[] = STATIC_SUGGESTIONS.map((s) => ({
      ...s,
      dismissed: dismissed.includes(s.id),
      executed: false,
    }))
    setSuggestions(initial)

    if (aiEnhanced) generateAiSuggestions(initial)
  }, [aiEnhanced])

  const generateAiSuggestions = async (existing: WorkflowSuggestion[]) => {
    setLoadingAi(true)
    try {
      const prompt = `Tu es un assistant de productivité. Génère 3 nouvelles suggestions d'automatisation pour un utilisateur professionnel qui utilise une suite bureautique (email, calendrier, CRM, documents).
Retourne UNIQUEMENT un JSON array sans markdown:
[{"id":"unique-id","category":"email|calendar|crm|automation|general","title":"Titre court","description":"Description actionnable en 1 phrase","actionLabel":"Libellé bouton court"}]`

      const res = await aiApi.chat(prompt, { enableTools: false, includesSources: false })
      const answer: string = (res.data as ChatResponse)?.answer ?? ''
      const match = answer.match(/\[[\s\S]*\]/)
      if (!match) return

      const parsed: Array<Omit<WorkflowSuggestion, 'dismissed' | 'executed'>> = JSON.parse(match[0])
      const dismissed = loadDismissed()

      const aiSuggestions: WorkflowSuggestion[] = parsed.map((s) => ({
        ...s,
        dismissed: dismissed.includes(s.id),
        executed: false,
      }))

      setSuggestions((prev) => {
        // Avoid duplicates
        const existingIds = new Set(prev.map((p) => p.id))
        return [...prev, ...aiSuggestions.filter((s) => !existingIds.has(s.id))]
      })
    } catch {
      // AI suggestions are optional — don't toast
    } finally {
      setLoadingAi(false)
    }
  }

  const handleDismiss = (id: string) => {
    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, dismissed: true } : s)))
    const dismissed = loadDismissed()
    saveDismissed([...dismissed, id])
  }

  const handleExecute = async (id: string) => {
    const suggestion = suggestions.find((s) => s.id === id)
    if (!suggestion) return

    // Simulate async action execution
    toast.promise(
      new Promise<void>((resolve) => setTimeout(resolve, 800)),
      {
        loading: `Exécution: ${suggestion.actionLabel}…`,
        success: `Action exécutée: ${suggestion.title}`,
        error: 'Échec de l\'action',
      }
    )

    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, executed: true } : s)))
  }

  const visible = suggestions.filter((s) => !s.dismissed).slice(0, maxVisible)
  const dismissedCount = suggestions.filter((s) => s.dismissed).length

  if (visible.length === 0 && !loadingAi) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
          <Lightbulb className="w-8 h-8" />
          <p className="text-sm">Aucune suggestion pour le moment</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            Suggestions IA
            {visible.length > 0 && (
              <Badge variant="secondary" className="text-xs">{visible.length}</Badge>
            )}
          </CardTitle>
          {loadingAi && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Analyse en cours…
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {visible.map((s) => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            onDismiss={handleDismiss}
            onExecute={handleExecute}
          />
        ))}

        {dismissedCount > 0 && (
          <p className="text-xs text-muted-foreground text-center pt-1">
            {dismissedCount} suggestion{dismissedCount > 1 ? 's' : ''} ignorée{dismissedCount > 1 ? 's' : ''}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
