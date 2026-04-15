"use client";

import { useEffect, useState, useCallback } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Palette,
  Type,
  Minimize2,
  RectangleHorizontal,
  Check,
  RotateCcw,
  Sun,
  Moon,
  Monitor,
  Contrast,
  ZoomIn,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

// ── Types ──
interface ThemePreferences {
  primaryColor: string;
  fontSize: string;
  compactMode: boolean;
  borderRadius: string;
  highContrast: boolean;
  fontSizePx: number;
}

const STORAGE_KEY = "signapps-theme-preferences";

const DEFAULT_PREFS: ThemePreferences = {
  primaryColor: "blue",
  fontSize: "medium",
  compactMode: false,
  borderRadius: "rounded",
  highContrast: false,
  fontSizePx: 16,
};

const COLOR_OPTIONS = [
  { id: "blue", label: "Bleu", hex: "#135bec", darkHex: "#3b82f6" },
  { id: "green", label: "Vert", hex: "#059669", darkHex: "#10b981" },
  { id: "purple", label: "Violet", hex: "#7c3aed", darkHex: "#8b5cf6" },
  { id: "orange", label: "Orange", hex: "#ea580c", darkHex: "#f97316" },
  { id: "red", label: "Rouge", hex: "#dc2626", darkHex: "#ef4444" },
];

const FONT_SIZE_OPTIONS = [
  { id: "small", label: "Petit (13px)", preview: "13px" },
  { id: "medium", label: "Normal (15px)", preview: "15px" },
  { id: "large", label: "Grand (17px)", preview: "17px" },
];

const BORDER_RADIUS_OPTIONS = [
  { id: "sharp", label: "Anguleux", preview: "2px" },
  { id: "rounded", label: "Arrondi", preview: "10px" },
  { id: "pill", label: "Pilule", preview: "24px" },
];

function loadPreferences(): ThemePreferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
  } catch {
    /* ignore */
  }
  return DEFAULT_PREFS;
}

function savePreferences(prefs: ThemePreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/** Apply theme classes to the document root */
function applyTheme(prefs: ThemePreferences) {
  const root = document.documentElement;

  // Primary color
  COLOR_OPTIONS.forEach((c) => root.classList.remove(`theme-${c.id}`));
  root.classList.add(`theme-${prefs.primaryColor}`);

  // Font size (discrete)
  FONT_SIZE_OPTIONS.forEach((f) => root.classList.remove(`font-size-${f.id}`));
  root.classList.add(`font-size-${prefs.fontSize}`);

  // AC4: Dynamic font size (px slider)
  const px = Math.max(14, Math.min(20, prefs.fontSizePx));
  root.style.setProperty("--font-size-base", `${px}px`);

  // Compact mode
  root.classList.toggle("compact-mode", prefs.compactMode);

  // Border radius
  BORDER_RADIUS_OPTIONS.forEach((b) => root.classList.remove(`radius-${b.id}`));
  root.classList.add(`radius-${prefs.borderRadius}`);

  // AC4: High contrast mode
  root.classList.toggle("high-contrast", prefs.highContrast);
}

export default function SettingsAppearancePage() {
  usePageTitle("Appearance");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [prefs, setPrefs] = useState<ThemePreferences>(DEFAULT_PREFS);

  useEffect(() => {
    setMounted(true);
    const loaded = loadPreferences();
    setPrefs(loaded);
    applyTheme(loaded);
  }, []);

  const updatePref = useCallback(
    <K extends keyof ThemePreferences>(key: K, value: ThemePreferences[K]) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value };
        savePreferences(next);
        applyTheme(next);
        return next;
      });
    },
    [],
  );

  const resetDefaults = useCallback(() => {
    setPrefs(DEFAULT_PREFS);
    savePreferences(DEFAULT_PREFS);
    applyTheme(DEFAULT_PREFS);
    setTheme("system");
  }, [setTheme]);

  if (!mounted) return null;

  const themes = [
    { id: "light", label: "Clair", icon: Sun },
    { id: "dark", label: "Sombre", icon: Moon },
    { id: "system", label: "Systeme", icon: Monitor },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Apparence</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Personnalisez l'apparence de SignApps selon vos preferences.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetDefaults}
            className="gap-1.5 btn-press"
          >
            <RotateCcw className="w-4 h-4" />
            Reinitialiser
          </Button>
        </div>

        {/* ── Dark / Light Mode ── */}
        <Card className="card-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Monitor className="w-5 h-5" />
              Theme
            </CardTitle>
            <CardDescription>
              Choisissez le mode d'affichage adapte a votre environnement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {themes.map((t) => {
                const Icon = t.icon;
                const isActive = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all btn-press",
                      isActive
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-transparent bg-muted hover:bg-muted/80 text-muted-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-7 h-7 mb-2",
                        isActive ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <span className="font-medium text-sm">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Primary Color ── */}
        <Card className="card-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Palette className="w-5 h-5" />
              Couleur primaire
            </CardTitle>
            <CardDescription>
              Definissez la couleur d'accent de l'interface.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="flex flex-wrap gap-3"
              role="radiogroup"
              aria-label="Couleur primaire"
            >
              {COLOR_OPTIONS.map((color) => {
                const isActive = prefs.primaryColor === color.id;
                return (
                  <button
                    key={color.id}
                    role="radio"
                    aria-checked={isActive}
                    aria-label={color.label}
                    onClick={() => updatePref("primaryColor", color.id)}
                    className={cn(
                      "relative w-12 h-12 rounded-full border-2 transition-all btn-press flex items-center justify-center",
                      isActive
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ backgroundColor: color.hex }}
                  >
                    {isActive && (
                      <Check className="w-5 h-5 text-white drop-shadow-md" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Actif:{" "}
                {COLOR_OPTIONS.find((c) => c.id === prefs.primaryColor)?.label}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* ── Font Size ── */}
        <Card className="card-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Type className="w-5 h-5" />
              Taille de police
            </CardTitle>
            <CardDescription>
              Ajustez la taille du texte dans l'interface.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {FONT_SIZE_OPTIONS.map((fs) => {
                const isActive = prefs.fontSize === fs.id;
                return (
                  <button
                    key={fs.id}
                    onClick={() => updatePref("fontSize", fs.id)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all btn-press",
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-muted hover:bg-muted/80",
                    )}
                  >
                    <span
                      style={{ fontSize: fs.preview }}
                      className="font-medium mb-1"
                    >
                      Aa
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fs.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Compact Mode ── */}
        <Card className="card-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Minimize2 className="w-5 h-5" />
              Mode compact
            </CardTitle>
            <CardDescription>
              Reduisez l'espacement pour afficher plus de contenu a l'ecran.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between max-w-md">
              <div className="space-y-0.5">
                <Label htmlFor="compact-mode" className="text-base font-medium">
                  Activer le mode compact
                </Label>
                <p className="text-sm text-muted-foreground">
                  Reduit les marges et les paddings de l'interface.
                </p>
              </div>
              <Switch
                id="compact-mode"
                checked={prefs.compactMode}
                onCheckedChange={(v) => updatePref("compactMode", v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── AC4: High Contrast Mode ── */}
        <Card className="card-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Contrast className="w-5 h-5" />
              Contraste eleve
            </CardTitle>
            <CardDescription>
              Ameliore la lisibilite pour les personnes malvoyantes (WCAG AA).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* High contrast toggle */}
            <div className="flex items-center justify-between max-w-md">
              <div className="space-y-0.5">
                <Label
                  htmlFor="high-contrast"
                  className="text-base font-medium"
                >
                  Mode contraste eleve
                </Label>
                <p className="text-sm text-muted-foreground">
                  Interface fond noir / texte blanc avec couleurs vives.
                </p>
              </div>
              <Switch
                id="high-contrast"
                checked={prefs.highContrast}
                onCheckedChange={(v) => updatePref("highContrast", v)}
                aria-describedby="high-contrast-desc"
              />
            </div>
            <p id="high-contrast-desc" className="sr-only">
              Active le mode contraste eleve pour ameliorer la lisibilite
            </p>

            {/* Font size slider */}
            <div className="max-w-md space-y-3">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="font-size-slider"
                  className="text-base font-medium flex items-center gap-2"
                >
                  <ZoomIn className="w-4 h-4" />
                  Taille du texte
                </Label>
                <Badge variant="outline">{prefs.fontSizePx}px</Badge>
              </div>
              <input
                id="font-size-slider"
                type="range"
                min={14}
                max={20}
                step={1}
                value={prefs.fontSizePx}
                onChange={(e) =>
                  updatePref("fontSizePx", parseInt(e.target.value))
                }
                className="w-full accent-primary"
                aria-label={`Taille de police: ${prefs.fontSizePx}px`}
                aria-valuemin={14}
                aria-valuemax={20}
                aria-valuenow={prefs.fontSizePx}
                aria-valuetext={`${prefs.fontSizePx} pixels`}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>14px (min)</span>
                <span>17px (par defaut)</span>
                <span>20px (max)</span>
              </div>
              <p
                className="text-sm text-muted-foreground"
                style={{ fontSize: `${prefs.fontSizePx}px` }}
              >
                Apercu: Ceci est un exemple de texte a {prefs.fontSizePx}px.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Border Radius ── */}
        <Card className="card-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RectangleHorizontal className="w-5 h-5" />
              Coins des elements
            </CardTitle>
            <CardDescription>
              Choisissez le style d'arrondi des boutons et cartes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {BORDER_RADIUS_OPTIONS.map((br) => {
                const isActive = prefs.borderRadius === br.id;
                return (
                  <button
                    key={br.id}
                    onClick={() => updatePref("borderRadius", br.id)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex flex-col items-center justify-center p-4 border-2 transition-all btn-press",
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-muted hover:bg-muted/80",
                    )}
                    style={{ borderRadius: br.preview }}
                  >
                    <div
                      className="w-16 h-10 bg-primary/20 border border-primary/40 mb-2"
                      style={{ borderRadius: br.preview }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {br.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Live Preview ── */}
        <Card className="card-lift">
          <CardHeader>
            <CardTitle className="text-lg">Apercu en direct</CardTitle>
            <CardDescription>
              Visualisez vos reglages avant de quitter la page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 p-4 rounded-xl border bg-background">
              <div className="flex items-center gap-3">
                <Button size="sm" className="btn-press">
                  Bouton primaire
                </Button>
                <Button size="sm" variant="outline" className="btn-press">
                  Secondaire
                </Button>
                <Button size="sm" variant="destructive" className="btn-press">
                  Supprimer
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Badge>Badge</Badge>
                <Badge variant="secondary">Secondaire</Badge>
                <Badge variant="outline">Outline</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Ceci est un exemple de texte dans l'interface avec vos
                parametres actuels.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
