"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, FlaskConical, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { testProvider } from "@/lib/api/oauth-providers";
import type { ProviderConfigDetail } from "@/types/oauth-providers";

interface Props {
  detail: ProviderConfigDetail;
  /** Pending credentials edited in this session (not yet saved). */
  clientId: string;
  clientSecret: string;
  onChangeClientId: (v: string) => void;
  onChangeClientSecret: (v: string) => void;
}

export function CredentialsTab({
  detail,
  clientId,
  clientSecret,
  onChangeClientId,
  onChangeClientSecret,
}: Props) {
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);

  async function handleTest() {
    setTesting(true);
    try {
      const res = await testProvider(detail.provider_key, {
        client_id: clientId || undefined,
        client_secret: clientSecret || undefined,
        purpose: "integration",
      });
      // Open the auth URL in a new tab so the admin can verify the flow.
      window.open(res.authorization_url, "_blank", "noopener,noreferrer");
      toast.success("URL d'autorisation générée — vérifiez le nouvel onglet.");
    } catch (err) {
      console.error("testProvider failed", err);
      toast.error("Échec du test — vérifiez les credentials.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Status badge */}
      <div className="flex items-center gap-2">
        <Badge
          variant={detail.has_credentials ? "default" : "outline"}
          className={
            detail.has_credentials
              ? "bg-green-500/15 text-green-700 border-green-500/30"
              : "text-muted-foreground"
          }
        >
          {detail.has_credentials
            ? "Credentials enregistrés"
            : "Aucun credential enregistré"}
        </Badge>
        {detail.has_credentials && (
          <span className="text-xs text-muted-foreground">
            Laissez vide pour conserver les credentials existants.
          </span>
        )}
      </div>

      {/* Client ID */}
      <div className="space-y-2">
        <Label
          htmlFor="oauth-client-id"
          className="text-sm font-semibold text-foreground"
        >
          Client ID
        </Label>
        <Input
          id="oauth-client-id"
          value={clientId}
          onChange={(e) => onChangeClientId(e.target.value)}
          placeholder={
            detail.has_credentials ? "••••••••  (existant)" : "Votre Client ID"
          }
          className="font-mono text-sm"
          autoComplete="off"
        />
      </div>

      {/* Client Secret */}
      <div className="space-y-2">
        <Label
          htmlFor="oauth-client-secret"
          className="text-sm font-semibold text-foreground"
        >
          Client Secret
        </Label>
        <div className="relative">
          <Input
            id="oauth-client-secret"
            type={showSecret ? "text" : "password"}
            value={clientSecret}
            onChange={(e) => onChangeClientSecret(e.target.value)}
            placeholder={
              detail.has_credentials
                ? "••••••••  (existant)"
                : "Votre Client Secret"
            }
            className="font-mono text-sm pr-10"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowSecret((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showSecret ? "Masquer" : "Afficher"}
          >
            {showSecret ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Chiffré côté serveur avant stockage (AES-256-GCM).
        </p>
      </div>

      {/* Test button */}
      <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Tester la configuration
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Génère une URL d&apos;autorisation OAuth pour vérifier que les
            credentials sont valides. Aucune donnée n&apos;est persistée.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={testing}
          className="gap-2"
        >
          <FlaskConical className="h-4 w-4" />
          {testing ? "Test en cours…" : "Tester"}
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}
