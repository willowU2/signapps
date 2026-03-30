'use client'

/**
 * AM4 — AI presentation auto-generation
 *
 * Input: topic/brief + slide count + style → AI generates structured slide content.
 * Preview as card grid → "Exporter vers Slides" creates a doc in the slides editor.
 */

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import {
  Presentation,
  Sparkles,
  Loader2,
  ExternalLink,
  Download,
  RefreshCw,
  Layout,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { aiApi } from '@/lib/api'
import type { ChatResponse } from '@/lib/api/ai'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SlideContent {
  index: number
  title: string
  bullets: string[]
  notes?: string
  layout?: 'title' | 'content' | 'two-column' | 'image' | 'quote'
}

// ─── Style options ────────────────────────────────────────────────────────────

const STYLES = [
  { id: 'professional', label: 'Professionnel' },
  { id: 'minimal', label: 'Minimaliste' },
  { id: 'creative', label: 'Créatif' },
  { id: 'corporate', label: 'Corporate' },
  { id: 'educational', label: 'Éducatif' },
  { id: 'pitch', label: 'Pitch / Investisseur' },
] as const

type StyleId = (typeof STYLES)[number]['id']

// ─── Slide card preview ───────────────────────────────────────────────────────

function SlideCard({ slide, total }: { slide: SlideContent; total: number }) {
  return (
    <div className="border rounded-lg overflow-hidden bg-card hover:shadow-md transition-shadow">
      {/* Slide number bar */}
      <div className="h-1.5 bg-primary/20">
        <div
          className="h-full bg-primary"
          style={{ width: `${((slide.index) / total) * 100}%` }}
        />
      </div>

      <div className="p-4 space-y-2 min-h-[140px]">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground font-medium">
            Diapositive {slide.index}/{total}
          </p>
          {slide.layout && (
            <Badge variant="outline" className="text-xs shrink-0">
              {slide.layout}
            </Badge>
          )}
        </div>

        <h3 className="font-semibold text-sm leading-snug line-clamp-2">{slide.title}</h3>

        {slide.bullets.length > 0 && (
          <ul className="space-y-1">
            {slide.bullets.slice(0, 4).map((b, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary shrink-0 mt-0.5">•</span>
                <span className="line-clamp-2">{b}</span>
              </li>
            ))}
            {slide.bullets.length > 4 && (
              <li className="text-xs text-muted-foreground pl-3">
                +{slide.bullets.length - 4} points…
              </li>
            )}
          </ul>
        )}

        {slide.notes && (
          <p className="text-xs italic text-muted-foreground/70 border-t pt-1 line-clamp-2">
            Note: {slide.notes}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PresentationGeneratorProps {
  /** Called with slide data when "Export to Slides" is clicked */
  onExportToSlides?: (slides: SlideContent[], title: string) => void
}

export function PresentationGenerator({ onExportToSlides }: PresentationGeneratorProps) {
  const [topic, setTopic] = useState('')
  const [brief, setBrief] = useState('')
  const [slideCount, setSlideCount] = useState(8)
  const [style, setStyle] = useState<StyleId>('professional')
  const [slides, setSlides] = useState<SlideContent[]>([])
  const [loading, setLoading] = useState(false)
  const [presentationTitle, setPresentationTitle] = useState('')

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error('Veuillez saisir un sujet')
      return
    }
    setLoading(true)
    setSlides([])
    try {
      const prompt = `Tu es un expert en présentations professionnelles.
Génère une présentation de ${slideCount} diapositives sur: "${topic.trim()}"
${brief.trim() ? `Contexte: ${brief.trim()}` : ''}
Style: ${style}

Retourne UNIQUEMENT un JSON array valide sans markdown:
[
  {
    "index": 1,
    "title": "Titre de la diapositive",
    "bullets": ["Point 1", "Point 2", "Point 3"],
    "notes": "Note du présentateur (optionnel)",
    "layout": "title|content|two-column|image|quote"
  }
]

La première diapositive doit être un titre, la dernière un appel à l'action ou une conclusion.
Chaque diapositive doit avoir 2-5 bullets concis.`

      const res = await aiApi.chat(prompt, { enableTools: false, includesSources: false })
      const answer: string = (res.data as ChatResponse)?.answer ?? ''
      const match = answer.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('Format IA invalide')

      const parsed: SlideContent[] = JSON.parse(match[0])
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Aucune diapositive générée')

      setSlides(parsed)
      setPresentationTitle(topic.trim())
      toast.success(`${parsed.length} diapositives générées`)
    } catch (err) {
      toast.error('Échec de la génération. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!slides.length) return
    if (onExportToSlides) {
      onExportToSlides(slides, presentationTitle)
      toast.success('Présentation exportée vers Slides')
      return
    }

    // Fallback: create a JSON download
    const exportData = {
      title: presentationTitle,
      style,
      slides,
      generated_at: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `presentation-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Présentation téléchargée (JSON)')
  }

  return (
    <div className="space-y-6">
      {/* Config panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Presentation className="w-5 h-5 text-primary" />
            Générateur de présentation IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pres-topic">Sujet / Titre</Label>
            <Input
              id="pres-topic"
              placeholder="Ex: Stratégie produit Q3 2026"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pres-brief">Contexte ou brief (optionnel)</Label>
            <Textarea
              id="pres-brief"
              placeholder="Contexte, public cible, points importants à couvrir…"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Style</Label>
              <Select value={style} onValueChange={(v) => setStyle(v as StyleId)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STYLES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nombre de diapositives: <span className="font-bold">{slideCount}</span></Label>
              <Slider
                min={4}
                max={20}
                step={1}
                value={[slideCount]}
                onValueChange={([v]) => setSlideCount(v)}
                className="mt-2"
              />
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Génération en cours…</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Générer la présentation</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Preview grid */}
      {slides.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{presentationTitle}</h3>
              <p className="text-sm text-muted-foreground">
                {slides.length} diapositive{slides.length > 1 ? 's' : ''} — style {style}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Régénérer
              </Button>
              <Button size="sm" onClick={handleExport}>
                <Presentation className="w-4 h-4 mr-1" />
                Exporter vers Slides
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {slides.map((slide) => (
              <SlideCard key={slide.index} slide={slide} total={slides.length} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
