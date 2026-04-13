"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function FormsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Forms Error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="rounded-full bg-destructive/10 p-4 mb-6">
        <AlertTriangle className="h-10 w-10 text-destructive" />
      </div>
      <h1 className="text-2xl font-semibold mb-2">Erreur des formulaires</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-lg">
        Une erreur est survenue dans le module de formulaires. Vous pouvez
        réessayer ou retourner au tableau de bord.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Réessayer
        </Button>
        <Button asChild>
          <Link href="/dashboard">
            <Home className="h-4 w-4 mr-2" />
            Tableau de bord
          </Link>
        </Button>
      </div>
      {error.digest && (
        <p className="text-xs text-muted-foreground mt-6 font-mono">
          Ref: {error.digest}
        </p>
      )}
    </div>
  );
}
