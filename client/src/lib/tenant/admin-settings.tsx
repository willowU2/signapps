"use client";

/**
 * Tenant Admin Settings Components
 *
 * UI components for managing tenant configuration.
 */

import * as React from "react";
import {
  Palette,
  Globe,
  Shield,
  Mail,
  Database,
  ToggleLeft,
  Check,
  X,
  Save,
  RefreshCw,
  Eye,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTenant } from "./context";
import type {
  TenantConfig,
  TenantBranding,
  TenantFeatureToggles,
  FeatureToggleKey,
  EmailTemplateType,
  SupportedLocale,
} from "./types";
import { DEFAULT_TEMPLATES, getTemplatePreview } from "./email-templates";

// ============================================================================
// Branding Settings
// ============================================================================

interface BrandingSettingsProps {
  branding: TenantBranding;
  onUpdate: (branding: Partial<TenantBranding>) => void;
}

export function BrandingSettings({
  branding,
  onUpdate,
}: BrandingSettingsProps) {
  const [form, setForm] = React.useState(branding);

  const handleSave = () => {
    onUpdate(form);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Identité visuelle
          </CardTitle>
          <CardDescription>
            Personnalisez le logo et les couleurs de votre organisation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de l'organisation</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">Slogan</Label>
              <Input
                id="tagline"
                value={form.tagline || ""}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                placeholder="Votre espace de travail digital"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium">Logos</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="logo-primary">Logo principal</Label>
                <Input
                  id="logo-primary"
                  value={form.logo.primary}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      logo: { ...form.logo, primary: e.target.value },
                    })
                  }
                  placeholder="/logo.svg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo-favicon">Favicon</Label>
                <Input
                  id="logo-favicon"
                  value={form.logo.favicon || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      logo: { ...form.logo, favicon: e.target.value },
                    })
                  }
                  placeholder="/favicon.ico"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium">Couleurs</h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="color-primary">Couleur principale</Label>
                <div className="flex gap-2">
                  <Input
                    id="color-primary"
                    type="color"
                    value={form.colors.primary}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        colors: { ...form.colors, primary: e.target.value },
                      })
                    }
                    className="w-12 h-10 p-1"
                  />
                  <Input
                    value={form.colors.primary}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        colors: { ...form.colors, primary: e.target.value },
                      })
                    }
                    placeholder="#6366f1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="color-secondary">Couleur secondaire</Label>
                <div className="flex gap-2">
                  <Input
                    id="color-secondary"
                    type="color"
                    value={form.colors.secondary || "#000000"}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        colors: { ...form.colors, secondary: e.target.value },
                      })
                    }
                    className="w-12 h-10 p-1"
                  />
                  <Input
                    value={form.colors.secondary || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        colors: { ...form.colors, secondary: e.target.value },
                      })
                    }
                    placeholder="#10b981"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Feature Toggles Settings
// ============================================================================

interface FeatureTogglesSettingsProps {
  features: TenantFeatureToggles;
  onUpdate: (features: Partial<TenantFeatureToggles>) => void;
}

const featureGroups = [
  {
    title: "Modules principaux",
    features: [
      "storage",
      "calendar",
      "tasks",
      "mail",
      "chat",
      "docs",
      "meet",
    ] as FeatureToggleKey[],
  },
  {
    title: "Modules avancés",
    features: ["containers", "vpn", "monitoring", "ai"] as FeatureToggleKey[],
  },
  {
    title: "Fonctionnalités",
    features: [
      "dashboardCustomization",
      "viewsSystem",
      "commandBar",
      "darkMode",
      "multiLanguage",
    ] as FeatureToggleKey[],
  },
  {
    title: "Administration",
    features: [
      "userManagement",
      "roleManagement",
      "auditLog",
      "apiAccess",
    ] as FeatureToggleKey[],
  },
  {
    title: "Intégrations",
    features: [
      "ldapAuth",
      "samlAuth",
      "webhooks",
      "apiKeys",
    ] as FeatureToggleKey[],
  },
];

const featureLabels: Record<FeatureToggleKey, string> = {
  storage: "Stockage",
  calendar: "Calendrier",
  tasks: "Tâches",
  mail: "Email",
  chat: "Chat",
  docs: "Documents",
  meet: "Visioconférence",
  containers: "Containers",
  vpn: "VPN",
  monitoring: "Monitoring",
  ai: "Intelligence Artificielle",
  dashboardCustomization: "Dashboard personnalisable",
  viewsSystem: "Système de vues",
  commandBar: "Barre de commandes",
  darkMode: "Mode sombre",
  multiLanguage: "Multi-langues",
  userManagement: "Gestion utilisateurs",
  roleManagement: "Gestion des rôles",
  auditLog: "Journal d'audit",
  apiAccess: "Accès API",
  ldapAuth: "Authentification LDAP",
  samlAuth: "Authentification SAML",
  webhooks: "Webhooks",
  apiKeys: "Clés API",
};

export function FeatureTogglesSettings({
  features,
  onUpdate,
}: FeatureTogglesSettingsProps) {
  const handleToggle = (feature: FeatureToggleKey) => {
    onUpdate({ [feature]: !features[feature] });
  };

  return (
    <div className="space-y-6">
      {featureGroups.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ToggleLeft className="h-5 w-5" />
              {group.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {group.features.map((feature) => (
                <div
                  key={feature}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center gap-3">
                    <span>{featureLabels[feature]}</span>
                    {features[feature] ? (
                      <Badge variant="default" className="bg-green-500">
                        <Check className="h-3 w-3 mr-1" />
                        Actif
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <X className="h-3 w-3 mr-1" />
                        Désactivé
                      </Badge>
                    )}
                  </div>
                  <Switch
                    checked={features[feature]}
                    onCheckedChange={() => handleToggle(feature)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// Localization Settings
// ============================================================================

interface LocalizationSettingsProps {
  config: TenantConfig;
  onUpdate: (data: Partial<TenantConfig["localization"]>) => void;
}

const localeLabels: Record<SupportedLocale, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
};

export function LocalizationSettings({
  config,
  onUpdate,
}: LocalizationSettingsProps) {
  const localization = config.localization;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Localisation
        </CardTitle>
        <CardDescription>Configurez les paramètres régionaux.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Langue par défaut</Label>
            <Select
              value={localization.defaultLocale}
              onValueChange={(v) =>
                onUpdate({ defaultLocale: v as SupportedLocale })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(localeLabels).map(([code, label]) => (
                  <SelectItem key={code} value={code}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fuseau horaire</Label>
            <Select
              value={localization.timezone}
              onValueChange={(v) => onUpdate({ timezone: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                <SelectItem value="Europe/London">Europe/London</SelectItem>
                <SelectItem value="America/New_York">
                  America/New_York
                </SelectItem>
                <SelectItem value="America/Los_Angeles">
                  America/Los_Angeles
                </SelectItem>
                <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Format de date</Label>
            <Select
              value={localization.dateFormat}
              onValueChange={(v) =>
                onUpdate({
                  dateFormat: v as "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Format d'heure</Label>
            <Select
              value={localization.timeFormat}
              onValueChange={(v) =>
                onUpdate({ timeFormat: v as "12h" | "24h" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">24 heures</SelectItem>
                <SelectItem value="12h">12 heures (AM/PM)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Security Settings
// ============================================================================

interface SecuritySettingsProps {
  config: TenantConfig;
  onUpdate: (data: Partial<TenantConfig["security"]>) => void;
}

export function SecuritySettings({ config, onUpdate }: SecuritySettingsProps) {
  const security = config.security;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Sécurité
        </CardTitle>
        <CardDescription>
          Configurez les politiques de sécurité.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Authentification à deux facteurs</p>
            <p className="text-sm text-muted-foreground">
              Exiger la 2FA pour tous les utilisateurs
            </p>
          </div>
          <Switch
            checked={security.requireMfa}
            onCheckedChange={(v) => onUpdate({ requireMfa: v })}
          />
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="font-medium">Politique de mot de passe</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Longueur minimale</Label>
              <Input
                type="number"
                min={6}
                max={32}
                value={security.passwordPolicy.minLength}
                onChange={(e) =>
                  onUpdate({
                    passwordPolicy: {
                      ...security.passwordPolicy,
                      minLength: parseInt(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Expiration (jours, 0 = jamais)</Label>
              <Input
                type="number"
                min={0}
                value={security.passwordPolicy.maxAge}
                onChange={(e) =>
                  onUpdate({
                    passwordPolicy: {
                      ...security.passwordPolicy,
                      maxAge: parseInt(e.target.value),
                    },
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            {[
              { key: "requireUppercase", label: "Majuscules requises" },
              { key: "requireLowercase", label: "Minuscules requises" },
              { key: "requireNumbers", label: "Chiffres requis" },
              {
                key: "requireSpecialChars",
                label: "Caractères spéciaux requis",
              },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between py-1">
                <span className="text-sm">{label}</span>
                <Switch
                  checked={
                    security.passwordPolicy[
                      key as keyof typeof security.passwordPolicy
                    ] as boolean
                  }
                  onCheckedChange={(v) =>
                    onUpdate({
                      passwordPolicy: {
                        ...security.passwordPolicy,
                        [key]: v,
                      },
                    })
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="font-medium">Sessions</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Durée max (heures)</Label>
              <Input
                type="number"
                min={1}
                value={security.session.maxDuration}
                onChange={(e) =>
                  onUpdate({
                    session: {
                      ...security.session,
                      maxDuration: parseInt(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Timeout inactivité (minutes)</Label>
              <Input
                type="number"
                min={5}
                value={security.session.idleTimeout}
                onChange={(e) =>
                  onUpdate({
                    session: {
                      ...security.session,
                      idleTimeout: parseInt(e.target.value),
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Settings Page
// ============================================================================

export function TenantSettingsPage() {
  const { config, updateConfig, isLoading, refreshConfig } = useTenant();
  const [activeTab, setActiveTab] = React.useState("branding");

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Paramètres du Tenant</h1>
          <p className="text-muted-foreground">
            Configurez l'apparence et les fonctionnalités de votre organisation.
          </p>
        </div>
        <Button variant="outline" onClick={refreshConfig}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <TabsTrigger value="branding">
            <Palette className="h-4 w-4 mr-2" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="features">
            <ToggleLeft className="h-4 w-4 mr-2" />
            Fonctionnalités
          </TabsTrigger>
          <TabsTrigger value="localization">
            <Globe className="h-4 w-4 mr-2" />
            Localisation
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Sécurité
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="h-4 w-4 mr-2" />
            Emails
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="h-[calc(100vh-280px)] mt-6">
          <TabsContent value="branding" className="space-y-6">
            <BrandingSettings
              branding={config.branding}
              onUpdate={(data) => updateConfig("branding", data)}
            />
          </TabsContent>

          <TabsContent value="features" className="space-y-6">
            <FeatureTogglesSettings
              features={config.features}
              onUpdate={(data) => updateConfig("features", data)}
            />
          </TabsContent>

          <TabsContent value="localization" className="space-y-6">
            <LocalizationSettings
              config={config}
              onUpdate={(data) => updateConfig("localization", data)}
            />
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <SecuritySettings
              config={config}
              onUpdate={(data) => updateConfig("security", data)}
            />
          </TabsContent>

          <TabsContent value="email" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Templates d'email
                </CardTitle>
                <CardDescription>
                  Personnalisez les emails envoyés aux utilisateurs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  La personnalisation des templates d'email sera disponible dans
                  une prochaine version.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
