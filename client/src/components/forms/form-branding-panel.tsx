"use client";

/**
 * FM2 — Public Form Branding
 *
 * Allows form owners to customise the visual appearance of their public form:
 * logo, primary color, background color, and font.
 *
 * The branding config is serialised as JSON and stored in localStorage keyed
 * by form id (later can be persisted to the forms.forms metadata column).
 */

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Palette, Type, Image as ImageIcon, Upload, Layout } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FontOption = "inter" | "geist" | "georgia" | "roboto-mono";

export interface FormBranding {
  logoUrl?: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  font: FontOption;
  fontSize: number;
  borderRadius: number;
  containerShadow: "none" | "sm" | "md" | "lg" | "xl";
  /** Page background image (full-width) */
  coverImageUrl?: string;
  /** Accent / border style for each field */
  fieldStyle: "outline" | "filled" | "underline" | "card";
}

export const DEFAULT_BRANDING: FormBranding = {
  logoUrl: undefined,
  primaryColor: "#2563eb",
  backgroundColor: "#ffffff",
  textColor: "#111827",
  font: "inter",
  fontSize: 16,
  borderRadius: 8,
  containerShadow: "md",
  coverImageUrl: undefined,
  fieldStyle: "outline",
};

const FONT_LABELS: Record<FontOption, string> = {
  inter: "Inter (sans-serif moderne)",
  geist: "Geist (sans-serif tech)",
  georgia: "Georgia (sérif classique)",
  "roboto-mono": "Roboto Mono (monospace)",
};

const FONT_CSS: Record<FontOption, string> = {
  inter: "font-sans",
  geist: "font-sans tracking-tight",
  georgia: "font-serif",
  "roboto-mono": "font-mono",
};

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function brandingKey(formId: string) {
  return `form:branding:${formId}`;
}

export function loadBranding(formId: string): FormBranding {
  if (typeof window === "undefined") return { ...DEFAULT_BRANDING };
  try {
    const raw = localStorage.getItem(brandingKey(formId));
    if (!raw) return { ...DEFAULT_BRANDING };
    return { ...DEFAULT_BRANDING, ...JSON.parse(raw) } as FormBranding;
  } catch {
    return { ...DEFAULT_BRANDING };
  }
}

export function saveBranding(formId: string, branding: FormBranding) {
  if (typeof window === "undefined") return;
  localStorage.setItem(brandingKey(formId), JSON.stringify(branding));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FormBrandingPanelProps {
  formId: string;
}

export function FormBrandingPanel({ formId }: FormBrandingPanelProps) {
  const [branding, setBranding] = useState<FormBranding>(() =>
    loadBranding(formId),
  );

  const update = useCallback((patch: Partial<FormBranding>) => {
    setBranding((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSave = () => {
    saveBranding(formId, branding);
    toast.success("Personnalisation enregistrée");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error("Logo trop grand (max 500 Ko)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      update({ logoUrl: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Personnalisation du formulaire public
        </CardTitle>
        <CardDescription>
          Modifiez l'apparence de votre formulaire public (logo, couleurs,
          police).
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

        {/* Cover image */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <ImageIcon className="h-3.5 w-3.5" />
            Image d&apos;en-tête (cover)
          </Label>
          <div className="flex items-center gap-3">
            {branding.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.coverImageUrl}
                alt="Cover"
                className="h-16 w-32 object-cover rounded border border-border"
              />
            ) : (
              <div className="h-16 w-32 rounded border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
                Aucune
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
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 2 * 1024 * 1024) {
                    toast.error("Image trop grande (max 2 Mo)");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = (ev) =>
                    update({ coverImageUrl: ev.target?.result as string });
                  reader.readAsDataURL(f);
                }}
              />
            </label>
            {branding.coverImageUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => update({ coverImageUrl: undefined })}
              >
                Supprimer
              </Button>
            )}
          </div>
        </div>

        {/* Colors */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Couleur principale</Label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={branding.primaryColor}
                onChange={(e) => update({ primaryColor: e.target.value })}
                className="h-9 w-9 rounded border border-border cursor-pointer p-0.5"
              />
              <Input
                className="h-9 font-mono text-xs"
                value={branding.primaryColor}
                onChange={(e) => update({ primaryColor: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Couleur de fond</Label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={branding.backgroundColor}
                onChange={(e) => update({ backgroundColor: e.target.value })}
                className="h-9 w-9 rounded border border-border cursor-pointer p-0.5"
              />
              <Input
                className="h-9 font-mono text-xs"
                value={branding.backgroundColor}
                onChange={(e) => update({ backgroundColor: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Couleur texte</Label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={branding.textColor}
                onChange={(e) => update({ textColor: e.target.value })}
                className="h-9 w-9 rounded border border-border cursor-pointer p-0.5"
              />
              <Input
                className="h-9 font-mono text-xs"
                value={branding.textColor}
                onChange={(e) => update({ textColor: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Field style */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <Layout className="h-3.5 w-3.5" />
            Style des champs
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                { v: "outline", label: "Contour" },
                { v: "filled", label: "Rempli" },
                { v: "underline", label: "Souligné" },
                { v: "card", label: "Carte" },
              ] as const
            ).map(({ v, label }) => (
              <button
                key={v}
                type="button"
                onClick={() => update({ fieldStyle: v })}
                className={`h-9 rounded-md border text-xs font-medium transition-all ${
                  branding.fieldStyle === v
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders: fontSize + borderRadius */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs font-medium">Taille texte</Label>
              <span className="text-xs tabular-nums">{branding.fontSize}px</span>
            </div>
            <Slider
              value={[branding.fontSize]}
              min={12}
              max={22}
              step={1}
              onValueChange={([v]) => update({ fontSize: v })}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs font-medium">Arrondi</Label>
              <span className="text-xs tabular-nums">
                {branding.borderRadius}px
              </span>
            </div>
            <Slider
              value={[branding.borderRadius]}
              min={0}
              max={32}
              step={1}
              onValueChange={([v]) => update({ borderRadius: v })}
            />
          </div>
        </div>

        {/* Shadow */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Ombre du formulaire</Label>
          <div className="grid grid-cols-5 gap-1">
            {(["none", "sm", "md", "lg", "xl"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => update({ containerShadow: s })}
                className={`h-8 rounded-md border text-[10px] font-medium uppercase transition-all ${
                  branding.containerShadow === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Font */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <Type className="h-3.5 w-3.5" />
            Police
          </Label>
          <Select
            value={branding.font}
            onValueChange={(v) => update({ font: v as FontOption })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FONT_LABELS) as FontOption[]).map((f) => (
                <SelectItem key={f} value={f}>
                  {FONT_LABELS[f]}
                </SelectItem>
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
  );
}

/**
 * Apply branding CSS variables to a container element.
 * Used in the public form renderer + builder preview.
 */
export function applyBranding(branding: FormBranding): React.CSSProperties {
  return {
    backgroundColor: branding.backgroundColor,
    color: branding.textColor,
    fontSize: `${branding.fontSize}px`,
    ["--form-primary" as string]: branding.primaryColor,
    ["--form-radius" as string]: `${branding.borderRadius}px`,
  } as React.CSSProperties;
}

/** Tailwind shadow class for the form container. */
export function brandingShadowClass(branding: FormBranding): string {
  switch (branding.containerShadow) {
    case "sm":
      return "shadow-sm";
    case "md":
      return "shadow-md";
    case "lg":
      return "shadow-lg";
    case "xl":
      return "shadow-2xl";
    default:
      return "";
  }
}

export { FONT_CSS };
