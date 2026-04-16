"use client";

import { SpinnerInfinity } from "spinners-react";

/**
 * OAuth Callback Page
 *
 * Handles OAuth callback from external calendar providers.
 */

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { useExternalSyncStore } from "@/stores/external-sync-store";
import type { CalendarProvider } from "@/lib/calendar/external-sync/types";
import { PROVIDER_LABELS } from "@/lib/calendar/external-sync/types";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/use-page-title";

type CallbackStatus = "processing" | "success" | "error";

export default function OAuthCallbackPage() {
  usePageTitle("Synchronisation calendrier");
  const searchParams = useSearchParams();
  const router = useRouter();
  const { handleOAuthCallback, error } = useExternalSyncStore();

  const [status, setStatus] = useState<CallbackStatus>("processing");
  const [providerName, setProviderName] = useState<string>("");

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const provider = searchParams.get("provider") as CalendarProvider | null;
      const errorParam = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      // Handle OAuth error
      if (errorParam) {
        console.error("OAuth error:", errorParam, errorDescription);
        toast.error(`Erreur OAuth: ${errorDescription || errorParam}`);
        setStatus("error");
        return;
      }

      // Validate required params
      if (!code || !state || !provider) {
        console.error("Missing OAuth parameters");
        toast.error("Paramètres OAuth manquants ou invalides");
        setStatus("error");
        return;
      }

      setProviderName(PROVIDER_LABELS[provider] || provider);

      try {
        await handleOAuthCallback(provider, code, state);
        setStatus("success");

        // Close popup after success
        if (window.opener) {
          window.opener.postMessage(
            { type: "oauth-success", provider },
            window.location.origin,
          );
          setTimeout(() => window.close(), 2000);
        } else {
          // Redirect to settings page if not in popup
          setTimeout(() => router.push("/settings/calendar"), 2000);
        }
      } catch (err) {
        console.error("OAuth callback error:", err);
        toast.error("Erreur lors du traitement du callback OAuth");
        setStatus("error");
      }
    };

    processCallback();
  }, [searchParams, handleOAuthCallback, router]);

  const handleClose = () => {
    if (window.opener) {
      window.close();
    } else {
      router.push("/settings/calendar");
    }
  };

  return (
    <main
      id="main-content"
      className="min-h-screen flex items-center justify-center bg-muted dark:bg-gray-900 p-4"
    >
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          {status === "processing" && (
            <div className="space-y-4">
              <SpinnerInfinity
                size={24}
                secondaryColor="rgba(128,128,128,0.2)"
                color="currentColor"
                speed={120}
                className="h-12 w-12 mx-auto  text-blue-500"
              />
              <div>
                <h2 className="text-xl font-bold">Connexion en cours</h2>
                <p className="text-muted-foreground mt-2">
                  Veuillez patienter pendant la connexion à {providerName}...
                </p>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
              <div>
                <h2 className="text-xl font-bold text-green-700 dark:text-green-400">
                  Connexion réussie !
                </h2>
                <p className="text-muted-foreground mt-2">
                  Votre compte {providerName} a été connecté avec succès.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Cette fenêtre se fermera automatiquement...
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <XCircle className="h-12 w-12 mx-auto text-red-500" />
              <div>
                <h2 className="text-xl font-bold text-red-700 dark:text-red-400">
                  Échec de la connexion
                </h2>
                <p className="text-muted-foreground mt-2">
                  {error || "Une erreur est survenue lors de la connexion."}
                </p>
              </div>

              {searchParams.get("error_description") && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {searchParams.get("error_description")}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={handleClose}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour aux paramètres
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
