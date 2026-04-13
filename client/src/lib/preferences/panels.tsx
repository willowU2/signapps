"use client";

/**
 * Preferences Panels
 *
 * UI components for managing user preferences.
 */

import * as React from "react";
import {
  Sun,
  Moon,
  Monitor,
  Palette,
  Layout,
  Bell,
  BellOff,
  Type,
  Calendar,
  FolderOpen,
  Mail,
  Eye,
  Keyboard,
  Lock,
  RefreshCw,
  Download,
  Upload,
  RotateCcw,
  Globe,
} from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  useThemePreferences,
  useLayoutPreferences,
  useNotificationPreferences,
  useEditorPreferences,
  useCalendarPreferences,
  useStoragePreferences,
  useMailPreferences,
  useAccessibilityPreferences,
  usePrivacyPreferences,
  useLocalePreferences,
  usePreferences,
  SyncStatusIndicator,
} from "./context";
import type {
  ThemeMode,
  AccentColor,
  DensityMode,
  SidebarMode,
  CalendarView,
  FileViewMode,
  FileSortBy,
  DateFormat,
  NumberFormat,
} from "./types";
import { exportPreferences, importPreferences } from "./api";

// ============================================================================
// Theme Panel
// ============================================================================

export function ThemePanel() {
  const { theme, updateTheme } = useThemePreferences();

  const themeModes: {
    value: ThemeMode;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { value: "light", label: "Clair", icon: <Sun className="h-4 w-4" /> },
    { value: "dark", label: "Sombre", icon: <Moon className="h-4 w-4" /> },
    {
      value: "system",
      label: "Système",
      icon: <Monitor className="h-4 w-4" />,
    },
  ];

  const accentColors: { value: AccentColor; label: string; color: string }[] = [
    { value: "indigo", label: "Indigo", color: "#6366f1" },
    { value: "blue", label: "Bleu", color: "#3b82f6" },
    { value: "green", label: "Vert", color: "#10b981" },
    { value: "orange", label: "Orange", color: "#f97316" },
    { value: "pink", label: "Rose", color: "#ec4899" },
    { value: "purple", label: "Violet", color: "#8b5cf6" },
    { value: "red", label: "Rouge", color: "#ef4444" },
    { value: "yellow", label: "Jaune", color: "#eab308" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Apparence
        </CardTitle>
        <CardDescription>
          Personnalisez le thème et les couleurs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Thème</Label>
          <div className="flex gap-2">
            {themeModes.map((mode) => (
              <Button
                key={mode.value}
                variant={theme.mode === mode.value ? "default" : "outline"}
                size="sm"
                onClick={() => updateTheme({ mode: mode.value })}
                className="flex-1"
              >
                {mode.icon}
                <span className="ml-2">{mode.label}</span>
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <Label>Couleur d'accent</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={theme.accentColor === null ? "default" : "outline"}
              size="sm"
              onClick={() => updateTheme({ accentColor: null })}
            >
              Par défaut
            </Button>
            {accentColors.map((color) => (
              <Button
                key={color.value}
                variant={
                  theme.accentColor === color.value ? "default" : "outline"
                }
                size="sm"
                onClick={() => updateTheme({ accentColor: color.value })}
                className="gap-2"
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: color.color }}
                />
                {color.label}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Taille du texte</Label>
              <p className="text-sm text-muted-foreground">
                {Math.round(theme.fontScale * 100)}%
              </p>
            </div>
            <Slider
              value={[theme.fontScale]}
              min={0.8}
              max={1.4}
              step={0.1}
              onValueChange={([v]) => updateTheme({ fontScale: v })}
              className="w-32"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Réduire les animations</Label>
              <p className="text-sm text-muted-foreground">
                Désactive les transitions
              </p>
            </div>
            <Switch
              checked={theme.reduceMotion}
              onCheckedChange={(v) => updateTheme({ reduceMotion: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Contraste élevé</Label>
              <p className="text-sm text-muted-foreground">
                Améliore la lisibilité
              </p>
            </div>
            <Switch
              checked={theme.highContrast}
              onCheckedChange={(v) => updateTheme({ highContrast: v })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Layout Panel
// ============================================================================

export function LayoutPanel() {
  const { layout, updateLayout } = useLayoutPreferences();

  const densityModes: { value: DensityMode; label: string }[] = [
    { value: "comfortable", label: "Confortable" },
    { value: "compact", label: "Compact" },
    { value: "spacious", label: "Aéré" },
  ];

  const sidebarModes: { value: SidebarMode; label: string }[] = [
    { value: "expanded", label: "Étendu" },
    { value: "collapsed", label: "Réduit" },
    { value: "auto", label: "Automatique" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layout className="h-5 w-5" />
          Disposition
        </CardTitle>
        <CardDescription>Configurez la mise en page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Densité de l'interface</Label>
          <RadioGroup
            value={layout.density}
            onValueChange={(v) => updateLayout({ density: v as DensityMode })}
          >
            {densityModes.map((mode) => (
              <div key={mode.value} className="flex items-center space-x-2">
                <RadioGroupItem
                  value={mode.value}
                  id={`density-${mode.value}`}
                />
                <Label htmlFor={`density-${mode.value}`}>{mode.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <Separator />

        <div className="space-y-3">
          <Label>Barre latérale</Label>
          <Select
            value={layout.sidebarMode}
            onValueChange={(v) =>
              updateLayout({ sidebarMode: v as SidebarMode })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sidebarModes.map((mode) => (
                <SelectItem key={mode.value} value={mode.value}>
                  {mode.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Afficher le fil d'Ariane</Label>
            <Switch
              checked={layout.showBreadcrumbs}
              onCheckedChange={(v) => updateLayout({ showBreadcrumbs: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Afficher les titres de page</Label>
            <Switch
              checked={layout.showPageTitles}
              onCheckedChange={(v) => updateLayout({ showPageTitles: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>En-tête fixe</Label>
            <Switch
              checked={layout.fixedHeader}
              onCheckedChange={(v) => updateLayout({ fixedHeader: v })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Notifications Panel
// ============================================================================

export function NotificationsPanel() {
  const { notifications, updateNotifications } = useNotificationPreferences();

  const categories = [
    { key: "tasks", label: "Tâches" },
    { key: "calendar", label: "Calendrier" },
    { key: "mail", label: "Emails" },
    { key: "chat", label: "Messages" },
    { key: "mentions", label: "Mentions" },
    { key: "system", label: "Système" },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {notifications.enabled ? (
            <Bell className="h-5 w-5" />
          ) : (
            <BellOff className="h-5 w-5" />
          )}
          Notifications
        </CardTitle>
        <CardDescription>Gérez vos alertes et rappels.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label>Notifications activées</Label>
            <p className="text-sm text-muted-foreground">
              Recevoir des notifications
            </p>
          </div>
          <Switch
            checked={notifications.enabled}
            onCheckedChange={(v) => updateNotifications({ enabled: v })}
          />
        </div>

        {notifications.enabled && (
          <>
            <Separator />

            <div className="space-y-4">
              <Label>Catégories</Label>
              {categories.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm">{label}</span>
                  <Switch
                    checked={notifications.categories[key]}
                    onCheckedChange={(v) =>
                      updateNotifications({
                        categories: { ...notifications.categories, [key]: v },
                      })
                    }
                  />
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Mode Ne pas déranger</Label>
                  <p className="text-sm text-muted-foreground">
                    Silence temporaire
                  </p>
                </div>
                <Switch
                  checked={notifications.doNotDisturb}
                  onCheckedChange={(v) =>
                    updateNotifications({ doNotDisturb: v })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Sons</Label>
                  <p className="text-sm text-muted-foreground">
                    Volume: {notifications.soundVolume}%
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[notifications.soundVolume]}
                    min={0}
                    max={100}
                    step={10}
                    onValueChange={([v]) =>
                      updateNotifications({ soundVolume: v })
                    }
                    className="w-24"
                    disabled={!notifications.soundEnabled}
                  />
                  <Switch
                    checked={notifications.soundEnabled}
                    onCheckedChange={(v) =>
                      updateNotifications({ soundEnabled: v })
                    }
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Editor Panel
// ============================================================================

export function EditorPanel() {
  const { editor, updateEditor } = useEditorPreferences();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Type className="h-5 w-5" />
          Éditeur
        </CardTitle>
        <CardDescription>Paramètres de l'éditeur de texte.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Taille de police</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={12}
                max={24}
                value={editor.fontSize}
                onChange={(e) =>
                  updateEditor({ fontSize: parseInt(e.target.value) })
                }
              />
              <span className="text-sm text-muted-foreground">px</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Interligne</Label>
            <Select
              value={String(editor.lineHeight)}
              onValueChange={(v) => updateEditor({ lineHeight: parseFloat(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1.2">Serré (1.2)</SelectItem>
                <SelectItem value="1.4">Normal (1.4)</SelectItem>
                <SelectItem value="1.6">Aéré (1.6)</SelectItem>
                <SelectItem value="1.8">Très aéré (1.8)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Retour à la ligne automatique</Label>
            <Switch
              checked={editor.wordWrap}
              onCheckedChange={(v) => updateEditor({ wordWrap: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Sauvegarde automatique</Label>
              <p className="text-sm text-muted-foreground">
                Toutes les {editor.autoSaveInterval} secondes
              </p>
            </div>
            <Select
              value={String(editor.autoSaveInterval)}
              onValueChange={(v) =>
                updateEditor({ autoSaveInterval: parseInt(v) })
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Désactivé</SelectItem>
                <SelectItem value="15">15 sec</SelectItem>
                <SelectItem value="30">30 sec</SelectItem>
                <SelectItem value="60">1 min</SelectItem>
                <SelectItem value="120">2 min</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label>Vérification orthographique</Label>
            <Switch
              checked={editor.spellCheck}
              onCheckedChange={(v) => updateEditor({ spellCheck: v })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Calendar Panel
// ============================================================================

export function CalendarPanel() {
  const { calendar, updateCalendar } = useCalendarPreferences();

  const views: { value: CalendarView; label: string }[] = [
    { value: "month", label: "Mois" },
    { value: "week", label: "Semaine" },
    { value: "day", label: "Jour" },
    { value: "agenda", label: "Agenda" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Calendrier
        </CardTitle>
        <CardDescription>Options d'affichage du calendrier.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Vue par défaut</Label>
          <Select
            value={calendar.defaultView}
            onValueChange={(v) =>
              updateCalendar({ defaultView: v as CalendarView })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {views.map((view) => (
                <SelectItem key={view.value} value={view.value}>
                  {view.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Début de journée</Label>
            <Input
              type="time"
              value={calendar.workingHoursStart}
              onChange={(e) =>
                updateCalendar({ workingHoursStart: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Fin de journée</Label>
            <Input
              type="time"
              value={calendar.workingHoursEnd}
              onChange={(e) =>
                updateCalendar({ workingHoursEnd: e.target.value })
              }
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Afficher les week-ends</Label>
            <Switch
              checked={calendar.showWeekends}
              onCheckedChange={(v) => updateCalendar({ showWeekends: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Afficher les numéros de semaine</Label>
            <Switch
              checked={calendar.showWeekNumbers}
              onCheckedChange={(v) => updateCalendar({ showWeekNumbers: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Rappel par défaut</Label>
              <p className="text-sm text-muted-foreground">
                {calendar.defaultReminder} minutes avant
              </p>
            </div>
            <Select
              value={String(calendar.defaultReminder)}
              onValueChange={(v) =>
                updateCalendar({ defaultReminder: parseInt(v) })
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Aucun</SelectItem>
                <SelectItem value="5">5 min</SelectItem>
                <SelectItem value="15">15 min</SelectItem>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="60">1 heure</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Storage Panel
// ============================================================================

export function StoragePanel() {
  const { storage, updateStorage } = useStoragePreferences();

  const viewModes: { value: FileViewMode; label: string }[] = [
    { value: "grid", label: "Grille" },
    { value: "list", label: "Liste" },
    { value: "details", label: "Détails" },
  ];

  const sortOptions: { value: FileSortBy; label: string }[] = [
    { value: "name", label: "Nom" },
    { value: "modified", label: "Date de modification" },
    { value: "size", label: "Taille" },
    { value: "type", label: "Type" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Fichiers
        </CardTitle>
        <CardDescription>Options d'affichage des fichiers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Mode d'affichage</Label>
          <div className="flex gap-2">
            {viewModes.map((mode) => (
              <Button
                key={mode.value}
                variant={
                  storage.viewMode === mode.value ? "default" : "outline"
                }
                size="sm"
                onClick={() => updateStorage({ viewMode: mode.value })}
              >
                {mode.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Trier par</Label>
            <Select
              value={storage.sortBy}
              onValueChange={(v) => updateStorage({ sortBy: v as FileSortBy })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ordre</Label>
            <Select
              value={storage.sortDirection}
              onValueChange={(v) =>
                updateStorage({ sortDirection: v as "asc" | "desc" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Croissant</SelectItem>
                <SelectItem value="desc">Décroissant</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Afficher les fichiers cachés</Label>
            <Switch
              checked={storage.showHidden}
              onCheckedChange={(v) => updateStorage({ showHidden: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Aperçu au clic</Label>
            <Switch
              checked={storage.previewOnClick}
              onCheckedChange={(v) => updateStorage({ previewOnClick: v })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Privacy Panel
// ============================================================================

export function PrivacyPanel() {
  const { privacy, updatePrivacy } = usePrivacyPreferences();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Confidentialité
        </CardTitle>
        <CardDescription>Contrôlez votre visibilité.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Visibilité du profil</Label>
          <Select
            value={privacy.profileVisibility}
            onValueChange={(v) =>
              updatePrivacy({
                profileVisibility: v as "everyone" | "team" | "private",
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="everyone">Tout le monde</SelectItem>
              <SelectItem value="team">Équipe uniquement</SelectItem>
              <SelectItem value="private">Privé</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Statut en ligne</Label>
              <p className="text-sm text-muted-foreground">
                Afficher quand vous êtes connecté
              </p>
            </div>
            <Switch
              checked={privacy.showOnlineStatus}
              onCheckedChange={(v) => updatePrivacy({ showOnlineStatus: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Statut d'activité</Label>
              <p className="text-sm text-muted-foreground">
                Afficher ce que vous faites
              </p>
            </div>
            <Switch
              checked={privacy.showActivityStatus}
              onCheckedChange={(v) => updatePrivacy({ showActivityStatus: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Accusés de lecture</Label>
              <p className="text-sm text-muted-foreground">
                Indiquer quand vous avez lu un message
              </p>
            </div>
            <Switch
              checked={privacy.readReceipts}
              onCheckedChange={(v) => updatePrivacy({ readReceipts: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Indicateur de saisie</Label>
              <p className="text-sm text-muted-foreground">
                Montrer quand vous écrivez
              </p>
            </div>
            <Switch
              checked={privacy.typingIndicators}
              onCheckedChange={(v) => updatePrivacy({ typingIndicators: v })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Accessibility Panel
// ============================================================================

export function AccessibilityPanel() {
  const { accessibility, updateAccessibility } = useAccessibilityPreferences();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Accessibilité
        </CardTitle>
        <CardDescription>Options d'accessibilité.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Mode lecteur d'écran</Label>
            <p className="text-sm text-muted-foreground">
              Optimisations pour les technologies d'assistance
            </p>
          </div>
          <Switch
            checked={accessibility.screenReaderMode}
            onCheckedChange={(v) =>
              updateAccessibility({ screenReaderMode: v })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Indicateurs de focus</Label>
            <p className="text-sm text-muted-foreground">
              Contours visibles sur les éléments actifs
            </p>
          </div>
          <Switch
            checked={accessibility.focusIndicators}
            onCheckedChange={(v) => updateAccessibility({ focusIndicators: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Raccourcis clavier</Label>
            <p className="text-sm text-muted-foreground">
              Afficher les touches de raccourci
            </p>
          </div>
          <Switch
            checked={accessibility.keyboardHints}
            onCheckedChange={(v) => updateAccessibility({ keyboardHints: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Réduire la transparence</Label>
            <p className="text-sm text-muted-foreground">
              Supprimer les effets de flou
            </p>
          </div>
          <Switch
            checked={accessibility.reduceTransparency}
            onCheckedChange={(v) =>
              updateAccessibility({ reduceTransparency: v })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Zones de clic élargies</Label>
            <p className="text-sm text-muted-foreground">
              Boutons et liens plus grands
            </p>
          </div>
          <Switch
            checked={accessibility.largeClickTargets}
            onCheckedChange={(v) =>
              updateAccessibility({ largeClickTargets: v })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Locale / Regional Panel
// ============================================================================

export function LocalePanel() {
  const { locale, updateLocale } = useLocalePreferences();

  const dateFormats: { value: DateFormat; label: string; example: string }[] = [
    { value: "dd/mm/yyyy", label: "Jour/Mois/Annee", example: "28/03/2026" },
    { value: "mm/dd/yyyy", label: "Mois/Jour/Annee", example: "03/28/2026" },
    {
      value: "yyyy-mm-dd",
      label: "Annee-Mois-Jour (ISO)",
      example: "2026-03-28",
    },
  ];

  const numberFormats: {
    value: NumberFormat;
    label: string;
    example: string;
  }[] = [
    { value: "fr", label: "Francais", example: "1 234,56" },
    { value: "en", label: "English", example: "1,234.56" },
  ];

  const languages = [
    { value: "fr", label: "Francais" },
    { value: "en", label: "English" },
    { value: "de", label: "Deutsch" },
    { value: "es", label: "Espanol" },
    { value: "pt", label: "Portugues" },
    { value: "nl", label: "Nederlands" },
    { value: "it", label: "Italiano" },
    { value: "ar", label: "العربية" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Regional
        </CardTitle>
        <CardDescription>Langue, format de date et de nombre.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Langue</Label>
          <Select
            value={locale?.language || "fr"}
            onValueChange={(v) => updateLocale({ language: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="space-y-3">
          <Label>Format de date</Label>
          <RadioGroup
            value={locale?.dateFormat || "dd/mm/yyyy"}
            onValueChange={(v) => updateLocale({ dateFormat: v as DateFormat })}
          >
            {dateFormats.map((fmt) => (
              <div
                key={fmt.value}
                className="flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={fmt.value} id={`date-${fmt.value}`} />
                  <Label htmlFor={`date-${fmt.value}`}>{fmt.label}</Label>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {fmt.example}
                </span>
              </div>
            ))}
          </RadioGroup>
        </div>

        <Separator />

        <div className="space-y-3">
          <Label>Format des nombres</Label>
          <RadioGroup
            value={locale?.numberFormat || "fr"}
            onValueChange={(v) =>
              updateLocale({ numberFormat: v as NumberFormat })
            }
          >
            {numberFormats.map((fmt) => (
              <div
                key={fmt.value}
                className="flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={fmt.value} id={`num-${fmt.value}`} />
                  <Label htmlFor={`num-${fmt.value}`}>{fmt.label}</Label>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {fmt.example}
                </span>
              </div>
            ))}
          </RadioGroup>
        </div>

        <Separator />

        <div className="space-y-3">
          <Label>Fuseau horaire</Label>
          <Select
            value={locale?.timezone || "Europe/Paris"}
            onValueChange={(v) => updateLocale({ timezone: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "Europe/Paris",
                "Europe/London",
                "Europe/Berlin",
                "Europe/Brussels",
                "Europe/Zurich",
                "America/New_York",
                "America/Chicago",
                "America/Los_Angeles",
                "America/Toronto",
                "Asia/Tokyo",
                "Asia/Shanghai",
                "Asia/Dubai",
                "Pacific/Auckland",
                "Australia/Sydney",
              ].map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Preferences Page
// ============================================================================

export function PreferencesPage() {
  const { preferences, syncStatus, sync, reset } = usePreferences();
  const [activeTab, setActiveTab] = React.useState("theme");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      const blob = await exportPreferences();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `preferences-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Préférences exportées");
    } catch {
      toast.error("Échec de l'export");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await importPreferences(file);
      toast.success("Préférences importées");
      window.location.reload();
    } catch {
      toast.error("Échec de l'import");
    }
  };

  const handleReset = () => {
    if (
      confirm("Réinitialiser toutes les préférences aux valeurs par défaut ?")
    ) {
      reset();
      toast.success("Préférences réinitialisées");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Préférences</h1>
          <SyncStatusIndicator />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => sync()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Synchroniser
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            Importer
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Réinitialiser
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-9">
          <TabsTrigger value="theme">Apparence</TabsTrigger>
          <TabsTrigger value="locale">Regional</TabsTrigger>
          <TabsTrigger value="layout">Disposition</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="editor">Editeur</TabsTrigger>
          <TabsTrigger value="calendar">Calendrier</TabsTrigger>
          <TabsTrigger value="storage">Fichiers</TabsTrigger>
          <TabsTrigger value="privacy">Confidentialite</TabsTrigger>
          <TabsTrigger value="accessibility">Accessibilite</TabsTrigger>
        </TabsList>

        <ScrollArea className="h-[calc(100vh-280px)] mt-6">
          <TabsContent value="theme">
            <ThemePanel />
          </TabsContent>
          <TabsContent value="locale">
            <LocalePanel />
          </TabsContent>
          <TabsContent value="layout">
            <LayoutPanel />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationsPanel />
          </TabsContent>
          <TabsContent value="editor">
            <EditorPanel />
          </TabsContent>
          <TabsContent value="calendar">
            <CalendarPanel />
          </TabsContent>
          <TabsContent value="storage">
            <StoragePanel />
          </TabsContent>
          <TabsContent value="privacy">
            <PrivacyPanel />
          </TabsContent>
          <TabsContent value="accessibility">
            <AccessibilityPanel />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
