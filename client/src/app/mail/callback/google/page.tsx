"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * OAuth callback page for Gmail.
 * Google redirects here with ?code=... after user grants permission.
 * This page posts the code to the parent window via postMessage and closes itself.
 */
export default function GoogleMailCallbackPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (window.opener) {
      if (code) {
        window.opener.postMessage(
          { type: "oauth_callback", code },
          window.location.origin,
        );
      } else if (error) {
        window.opener.postMessage(
          { type: "oauth_error", error },
          window.location.origin,
        );
      }
      window.close();
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-2">
        <p className="text-lg font-medium">Connexion Google en cours...</p>
        <p className="text-sm text-muted-foreground">
          Cette fenetre va se fermer automatiquement.
        </p>
      </div>
    </div>
  );
}
