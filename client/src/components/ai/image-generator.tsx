'use client'

/**
 * AM1 — AI image generation for social/slides
 *
 * Text prompt + style selector → calls useAiImageGen → shows generated image
 * with download/insert actions. Integrates as a panel in social compose and slides editor.
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import {
  ImageIcon,
  Sparkles,
  Download,
  Copy,
  ExternalLink,
  Loader2,
  Presentation,
  Share2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAiImageGen } from '@/hooks/use-ai-image-gen'

// ─── Style options ────────────────────────────────────────────────────────────

const STYLES = [
  { id: 'photorealistic', label: 'Photo-réaliste' },
  { id: 'illustration', label: 'Illustration' },
  { id: 'abstract', label: 'Abstrait' },
  { id: 'logo', label: 'Logo / Icône' },
  { id: 'watercolor', label: 'Aquarelle' },
  { id: 'sketch', label: 'Croquis' },
  { id: 'digital-art', label: 'Art numérique' },
  { id: '3d-render', label: 'Rendu 3D' },
] as const

type StyleId = (typeof STYLES)[number]['id']

// ─── Sizes ────────────────────────────────────────────────────────────────────

const SIZES: { label: string; w: number; h: number }[] = [
  { label: 'Carré (1:1)', w: 1024, h: 1024 },
  { label: 'Paysage (16:9)', w: 1792, h: 1024 },
  { label: 'Portrait (9:16)', w: 1024, h: 1792 },
  { label: 'Social (4:5)', w: 1024, h: 1280 },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface ImageGeneratorProps {
  /** Called when "Insert into slide" is clicked */
  onInsertToSlide?: (imageUrl: string) => void
  /** Called when "Attach to post" is clicked */
  onAttachToPost?: (imageUrl: string) => void
  /** Compact mode for panel embedding */
  compact?: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ImageGenerator({
  onInsertToSlide,
  onAttachToPost,
  compact = false,
}: ImageGeneratorProps) {
  const { generating, result, error, generate, reset } = useAiImageGen()

  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState<StyleId>('photorealistic')
  const [size, setSize] = useState(SIZES[0])

  // Surface API errors
  useEffect(() => {
    if (error) toast.error(`Erreur: ${error}`)
  }, [error])

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Veuillez saisir une description')
      return
    }
    reset()
    await generate({
      prompt: `${prompt.trim()}, style: ${style}`,
      style,
      width: size.w,
      height: size.h,
    })
  }

  const handleDownload = () => {
    if (!result?.image_url) return
    const a = document.createElement('a')
    a.href = result.image_url
    a.download = `signapps-image-${Date.now()}.png`
    a.click()
    toast.success('Image téléchargée')
  }

  const handleCopyUrl = () => {
    if (!result?.image_url) return
    navigator.clipboard.writeText(result.image_url)
    toast.success('URL copiée')
  }

  const handleInsertSlide = () => {
    if (!result?.image_url) return
    if (onInsertToSlide) {
      onInsertToSlide(result.image_url)
      toast.success('Image insérée dans la présentation')
    } else {
      toast.info('Insérer dans la diapositive active (intégrez ce composant dans l\'éditeur Slides)')
    }
  }

  const handleAttachPost = () => {
    if (!result?.image_url) return
    if (onAttachToPost) {
      onAttachToPost(result.image_url)
      toast.success('Image attachée au post')
    } else {
      toast.info('Attachez ce composant dans l\'éditeur Social')
    }
  }

  return (
    <Card className={compact ? 'shadow-none border-0' : ''}>
      {!compact && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Générateur d'images IA
          </CardTitle>
        </CardHeader>
      )}

      <CardContent className="space-y-4">
        {/* Prompt */}
        <div className="space-y-1.5">
          <Label htmlFor="img-prompt">Description de l'image</Label>
          <Textarea
            id="img-prompt"
            placeholder="Ex: Un bureau moderne avec une vue sur la mer, ambiance professionnelle…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={compact ? 2 : 3}
            className="resize-none"
          />
        </div>

        {/* Style + Size */}
        <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2'}`}>
          <div className="space-y-1.5">
            <Label>Style</Label>
            <Select value={style} onValueChange={(v) => setStyle(v as StyleId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Format</Label>
            <Select
              value={`${size.w}x${size.h}`}
              onValueChange={(v) => {
                const found = SIZES.find((s) => `${s.w}x${s.h}` === v)
                if (found) setSize(found)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((s) => (
                  <SelectItem key={`${s.w}x${s.h}`} value={`${s.w}x${s.h}`}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Generate button */}
        <Button
          className="w-full"
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
        >
          {generating ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Génération en cours…</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" /> Générer</>
          )}
        </Button>

        {/* Result */}
        {result?.image_url && (
          <div className="space-y-3">
            <div className="relative rounded-lg overflow-hidden border bg-muted/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.image_url}
                alt={prompt}
                className="w-full object-contain max-h-72"
              />
              <div className="absolute top-2 right-2 flex gap-1">
                <Badge variant="secondary" className="text-xs">
                  {result.width}×{result.height}
                </Badge>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleDownload}>
                <Download className="w-3.5 h-3.5 mr-1" />
                Télécharger
              </Button>
              <Button size="sm" variant="outline" onClick={handleCopyUrl}>
                <Copy className="w-3.5 h-3.5 mr-1" />
                Copier URL
              </Button>
              <Button size="sm" variant="outline" onClick={handleInsertSlide}>
                <Presentation className="w-3.5 h-3.5 mr-1" />
                Insérer dans Slides
              </Button>
              <Button size="sm" variant="outline" onClick={handleAttachPost}>
                <Share2 className="w-3.5 h-3.5 mr-1" />
                Attacher au post
              </Button>
            </div>

            {result.model_used && (
              <p className="text-xs text-muted-foreground">
                Modèle: {result.model_used}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
