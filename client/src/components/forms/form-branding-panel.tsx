"use client"

/**
 * FM2 — Public Form Branding
 *
 * Allows form owners to customise the visual appearance of their public form:
 * logo, primary color, background color, and font.
 *
 * The branding config is serialised as JSON and stored in localStorage keyed
 * by form id (later can be persisted to the forms.forms metadata column).
 */

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Palette, Type, Image as ImageIcon, Upload } from "lucide-react"
import { toast } from "sonner"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FontOption = "inter" | "geist" | "georgia" | "roboto-mono"

export interface FormBranding {
  logoUrl?: string
  primaryColor: string
  backgroundColor: string
  font: FontOption
}

export const DEFAULT_BRANDING: FormBranding = {
  logoUrl: undefined,
  primaryColor: "#2563eb",
  backgroundColor: "#ffffff",
  font: "inter",
}

const FONT_LABELS: Record<FontOption, string> = {
  inter: "Inter (sans-serif moderne)",
  geist: "Geist (sans-serif tech)",
  georgia: "Georgia (sérif classique)",
  "roboto-mono": "Roboto Mono (monospace)",
}

const FONT_CSS: Record<FontOption, string> = {
  inter: "font-sans",
  geist: "font-sans tracking-tight",
  georgia: "font-serif",
  "roboto-mono": "font-mono",
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function brandingKey(formId: string) {
  return `form:branding:${formId}`
}

export function loadBranding(formId: string): FormBranding {
  if (typeof window === "undefined") return { ...DEFAULT_BRANDING }
  try {
    const raw = localStorage.getItem(brandingKey(formId))
    if (!raw) return { ...DEFAULT_BRANDING }
    return { ...DEFAULT_BRANDING, ...JSON.parse(raw) } as FormBranding
  } catch {
    return { ...DEFAULT_BRANDING }
  }
}

export function saveBranding(formId: string, branding: FormBranding) {
  if (typeof window === "undefined") return
  localStorage.setItem(brandingKey(formId), JSON.stringify(branding))
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FormBrandingPanelProps {
  formId: string
}

export function FormBrandingPanel({ formId }: FormBrandingPanelProps) {
  const [branding, setBranding] = useState<FormBranding>(() => loadBranding(formId))

  const update = useCallback((patch: Partial<FormBranding>) => {
    setBranding(prev => ({ ...prev, ...patch }))
  }, [])

  const handleSave = () => {
    saveBranding(formId, branding)
    toast.success("Personnalisation enregistrée")
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500 * 1024) {
      toast.error("Logo trop grand (max 500 Ko)")
      return
    }
    const reader = new FileReader()
    reader.onload = ev => {
      update({ logoUrl: ev.target?.result as string })
    }
    reader.readAsDataURL(file)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Personnalisation du formulaire public
        </CardTitle>
        <CardDescription>
          Modifiez l'apparence de votre formulaire public (logo, couleurs, police).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Logo */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <ImageIcon className="h-3.5 w-3.5" />
            Logo
          </Label>
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="h-10 w-auto max-w-[120px] object-contain rounded border border-border"
              />
            ) : (
              <div className="h-10 w-24 rounded border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
                Aucun logo
              </div>
            )}
            <label>
              <Button variant="outline" size="sm" asChild>
                <span className="gap-1.5 cursor-pointer">
                  <Upload className="h-3.5 w-3.5" />
                  Choisir
                </span>
              </Button>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleLogoUpload}
              />
            </label>
            {branding.logoUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => update({ logoUrl: undefined })}
              >
                Supprimer
              </Button>
            )}
          </div>
        </div>

        {/* Colors */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Couleur principale</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={branding.primaryColor}
                onChange={e => update({ primaryColor: e.target.value })}
                className="h-9 w-9 rounded border border-border cursor-pointer p-0.5"
              />
              <Input
                className="h-9 font-mono text-xs"
                value={branding.primaryColor}
                onChange={e => update({ primaryColor: e.target.value })}
                placeholder="#2563eb"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Couleur de fond</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={branding.backgroundColor}
                onChange={e => update({ backgroundColor: e.target.value })}
                className="h-9 w-9 rounded border border-border cursor-pointer p-0.5"
              />
              <Input
                className="h-9 font-mono text-xs"
                value={branding.backgroundColor}
                onChange={e => update({ backgroundColor: e.target.value })}
                placeholder="#ffffff"
              />
            </div>
          </div>
        </div>

        {/* Font */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <Type className="h-3.5 w-3.5" />
            Police
          </Label>
          <Select value={branding.font} onValueChange={v => update({ font: v as FontOption })}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FONT_LABELS) as FontOption[]).map(f => (
                <SelectItem key={f} value={f}>{FONT_LABELS[f]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Preview */}
        <div
          className="rounded-lg border p-4 space-y-2"
          style={{
            backgroundColor: branding.backgroundColor,
            borderColor: branding.primaryColor + "40",
          }}
        >
          <p
            className={`text-sm font-semibold ${FONT_CSS[branding.font]}`}
            style={{ color: branding.primaryColor }}
          >
            Aperçu — Titre du formulaire
          </p>
          <p className={`text-xs text-gray-500 ${FONT_CSS[branding.font]}`}>
            Voici à quoi ressemblera votre formulaire public.
          </p>
          <div
            className="inline-flex h-7 items-center rounded px-3 text-xs font-medium text-white"
            style={{ backgroundColor: branding.primaryColor }}
          >
            Envoyer
          </div>
        </div>

        <Button onClick={handleSave} size="sm">
          Sauvegarder la personnalisation
        </Button>
      </CardContent>
    </Card>
  )
}

/**
 * Apply branding CSS variables to a container element.
 * Used in the public form renderer.
 */
export function applyBranding(branding: FormBranding): React.CSSProperties {
  return {
    backgroundColor: branding.backgroundColor,
    "--form-primary": branding.primaryColor,
  } as React.CSSProperties
}

export { FONT_CSS }
