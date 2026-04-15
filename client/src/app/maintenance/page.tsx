"use client";

import { useEffect } from "react";

export default function MaintenancePage() {
  useEffect(() => {
    const timer = setInterval(() => {
      fetch("/api/v1/health", { cache: "no-store" })
        .then((r) => {
          if (r.ok) window.location.href = "/";
        })
        .catch(() => {
          // still down, keep polling
        });
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
      <div className="text-center max-w-md p-8">
        <div className="mx-auto mb-6 h-10 w-10 rounded-full border-4 border-muted border-t-primary animate-spin" />
        <h1 className="text-2xl font-semibold mb-4">Mise à jour en cours</h1>
        <p className="text-muted-foreground">
          SignApps sera de retour dans quelques instants.
          <br />
          Cette page se rafraîchit automatiquement.
        </p>
      </div>
    </div>
  );
}
