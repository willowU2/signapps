"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  ExternalLink,
  Copy,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { socialApi } from "@/lib/api/social";

// ---------------------------------------------------------------------------
// Per-platform setup guides
// ---------------------------------------------------------------------------

interface SetupStep {
  title: string;
  desc: string;
}

interface PlatformGuide {
  name: string;
  devUrl: string;
  steps: SetupStep[];
  callbackPath: string;
  envKeys: { id: string; secret: string };
}

const SETUP_GUIDES: Record<string, PlatformGuide> = {
  twitter: {
    name: "Twitter / X",
    devUrl: "https://developer.twitter.com/en/portal/projects-and-apps",
    steps: [
      {
        title: "Créer un compte développeur",
        desc: "Allez sur developer.twitter.com et connectez-vous avec votre compte Twitter. Acceptez les conditions d'utilisation.",
      },
      {
        title: "Créer un projet et une app",
        desc: "Cliquez sur '+ Add App', donnez un nom (ex: 'Mon SignApps'), sélectionnez 'Web App, Automated App or Bot'.",
      },
      {
        title: "Configurer OAuth 2.0",
        desc: "Dans les settings de l'app, activez OAuth 2.0. Sous 'Callback / Redirect URLs', ajoutez l'URL de callback ci-dessous. Assurez-vous que 'Read and Write' est activé.",
      },
      {
        title: "Copier les clés",
        desc: "Depuis 'Keys and tokens', copiez le Client ID (OAuth 2.0) et le Client Secret. Collez-les dans les champs ci-dessous.",
      },
    ],
    callbackPath: "/api/v1/social/oauth/twitter/callback",
    envKeys: { id: "TWITTER_CLIENT_ID", secret: "TWITTER_CLIENT_SECRET" },
  },
  linkedin: {
    name: "LinkedIn",
    devUrl: "https://www.linkedin.com/developers/apps",
    steps: [
      {
        title: "Créer une app LinkedIn",
        desc: "Allez sur linkedin.com/developers et cliquez 'Create app'. Donnez un nom, associez une page LinkedIn et téléversez un logo.",
      },
      {
        title: "Configurer les permissions",
        desc: "Dans l'onglet 'Products', ajoutez 'Share on LinkedIn' et 'Sign In with LinkedIn'. Attendez l'approbation (quelques secondes à quelques minutes).",
      },
      {
        title: "Ajouter l'URL de redirection",
        desc: "Dans l'onglet 'Auth', sous 'OAuth 2.0 settings > Authorized redirect URLs', ajoutez l'URL de callback ci-dessous.",
      },
      {
        title: "Copier les clés",
        desc: "Dans l'onglet 'Auth', copiez le Client ID et le Client Secret. Collez-les dans les champs ci-dessous.",
      },
    ],
    callbackPath: "/api/v1/social/oauth/linkedin/callback",
    envKeys: { id: "LINKEDIN_CLIENT_ID", secret: "LINKEDIN_CLIENT_SECRET" },
  },
  facebook: {
    name: "Facebook",
    devUrl: "https://developers.facebook.com/apps/",
    steps: [
      {
        title: "Créer une app Meta",
        desc: "Allez sur developers.facebook.com, cliquez 'Créer une app', choisissez le type 'Business' ou 'Consommateur'.",
      },
      {
        title: "Ajouter Facebook Login",
        desc: "Dans votre app, cliquez 'Ajouter un produit' et ajoutez 'Facebook Login'. Choisissez 'Web' comme plateforme.",
      },
      {
        title: "Configurer OAuth",
        desc: "Dans 'Facebook Login > Paramètres', ajoutez l'URL de callback ci-dessous dans 'URI de redirection OAuth valides'.",
      },
      {
        title: "Copier les clés",
        desc: "Dans 'Paramètres > Général', copiez l'Identifiant de l'app (App ID) et la Clé secrète de l'app (App Secret). Collez-les ci-dessous.",
      },
    ],
    callbackPath: "/api/v1/social/oauth/facebook/callback",
    envKeys: { id: "FACEBOOK_CLIENT_ID", secret: "FACEBOOK_CLIENT_SECRET" },
  },
  instagram: {
    name: "Instagram",
    devUrl: "https://developers.facebook.com/apps/",
    steps: [
      {
        title: "Utiliser la même app Meta",
        desc: "Instagram utilise la même app Facebook/Meta. Si vous avez déjà configuré Facebook, les clés sont identiques — passez directement à l'étape 4.",
      },
      {
        title: "Activer Instagram Basic Display",
        desc: "Dans votre app Meta, cliquez 'Ajouter un produit' et ajoutez 'Instagram Basic Display'. Cliquez 'Créer une nouvelle app'.",
      },
      {
        title: "Configurer les URLs de callback",
        desc: "Dans 'Instagram Basic Display > Paramètres', ajoutez l'URL de callback ci-dessous dans 'URI de redirection OAuth valides'.",
      },
      {
        title: "Copier les clés",
        desc: "Utilisez le même App ID et App Secret que pour Facebook (dans 'Paramètres > Général'). Collez-les ci-dessous.",
      },
    ],
    callbackPath: "/api/v1/social/oauth/instagram/callback",
    envKeys: { id: "FACEBOOK_CLIENT_ID", secret: "FACEBOOK_CLIENT_SECRET" },
  },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OAuthSetupWizardProps {
  platform: string;
  open: boolean;
  onClose: () => void;
  onCredentialsSaved: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OAuthSetupWizard({
  platform,
  open,
  onClose,
  onCredentialsSaved,
}: OAuthSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const guide = SETUP_GUIDES[platform];

  // Reset state when dialog opens/closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setCurrentStep(0);
      setClientId("");
      setClientSecret("");
      setSaveError(null);
      onClose();
    }
  };

  if (!guide) return null;

  const totalSteps = guide.steps.length;
  const isLastStep = currentStep === totalSteps - 1;

  // Build callback URL from current hostname
  const callbackUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}${guide.callbackPath}`
      : guide.callbackPath;

  const handleCopyCallback = async () => {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  };

  const handleSave = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setSaveError("Le Client ID et le Client Secret sont requis.");
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      await socialApi.oauth.saveCredentials({
        platform,
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
      });
      setSaving(false);
      onCredentialsSaved();
      handleOpenChange(false);
    } catch (err: unknown) {
      setSaving(false);
      const errorMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ??
        (err as Error)?.message ??
        "Erreur lors de la sauvegarde des credentials.";
      setSaveError(errorMsg);
    }
  };

  const step = guide.steps[currentStep];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Configurer {guide.name}
            <Badge variant="outline" className="text-xs font-normal">
              Étape {currentStep + 1} / {totalSteps}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Suivez ces étapes pour créer vos credentials OAuth et connecter{" "}
            {guide.name} à SignApps.
          </DialogDescription>
        </DialogHeader>

        {/* Step progress dots */}
        <div className="flex gap-1.5 justify-center my-1">
          {guide.steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === currentStep
                  ? "w-6 bg-primary"
                  : i < currentStep
                    ? "w-1.5 bg-primary/50"
                    : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-2">
            <h3 className="font-semibold text-sm">{step.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step.desc}
            </p>
          </div>

          {/* Callback URL (shown on step 3, 0-indexed = step 2) */}
          {currentStep === 2 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                URL de callback à copier
              </Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={callbackUrl}
                  className="text-xs font-mono h-8 bg-muted"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-8"
                  onClick={handleCopyCallback}
                >
                  {copied ? (
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Credentials inputs on the last step */}
          {isLastStep && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="wizard-client-id" className="text-xs">
                  Client ID{" "}
                  <span className="text-muted-foreground">
                    ({guide.envKeys.id})
                  </span>
                </Label>
                <Input
                  id="wizard-client-id"
                  placeholder="Collez votre Client ID ici"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wizard-client-secret" className="text-xs">
                  Client Secret{" "}
                  <span className="text-muted-foreground">
                    ({guide.envKeys.secret})
                  </span>
                </Label>
                <Input
                  id="wizard-client-secret"
                  type="password"
                  placeholder="Collez votre Client Secret ici"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
              {saveError && (
                <div className="flex items-start gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{saveError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 gap-2">
          {/* Dev portal link */}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() =>
              window.open(guide.devUrl, "_blank", "noopener,noreferrer")
            }
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ouvrir le portail développeur
          </Button>

          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep((s) => s - 1)}
                disabled={saving}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Précédent
              </Button>
            )}

            {isLastStep ? (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !clientId.trim() || !clientSecret.trim()}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Sauvegarde…
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                    Tester la connexion
                  </>
                )}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setCurrentStep((s) => s + 1)}>
                Suivant
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
