"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useVaultStore } from "@/stores/vault-store";

// Retrieve connected user email from auth store
function useCurrentUserEmail(): string {
  // Try to get from localStorage / auth store
  if (typeof window !== "undefined") {
    try {
      const authRaw = localStorage.getItem("auth-storage");
      if (authRaw) {
        const auth = JSON.parse(authRaw);
        return auth?.state?.user?.email || auth?.state?.email || "";
      }
    } catch {
      // ignore
    }
  }
  return "";
}

export function VaultUnlock() {
  const { unlock, initialize, loading, error, clearError } = useVaultStore();
  const email = useCurrentUserEmail();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"unlock" | "init">("unlock");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    clearError();

    try {
      if (mode === "init") {
        await initialize(password, email);
      } else {
        await unlock(password, email);
      }
    } catch {
      // error is set in store
    }
  };

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
          <Lock className="h-8 w-8 text-emerald-500" />
        </div>
        <CardTitle className="text-xl">
          {mode === "unlock"
            ? "Déverrouiller le coffre-fort"
            : "Initialiser le coffre-fort"}
        </CardTitle>
        <CardDescription>
          {mode === "unlock"
            ? "Saisissez votre mot de passe maître pour accéder à vos secrets."
            : "Choisissez un mot de passe maître pour votre nouveau coffre-fort."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="vault-password">Mot de passe maître</Label>
            <div className="relative">
              <Input
                id="vault-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "unlock" ? "current-password" : "new-password"
                }
                autoFocus
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={loading || !password.trim()}
          >
            <KeyRound className="h-4 w-4" />
            {loading
              ? mode === "unlock"
                ? "Déverrouillage…"
                : "Initialisation…"
              : mode === "unlock"
                ? "Déverrouiller"
                : "Créer le coffre-fort"}
          </Button>
        </form>

        {/* Toggle mode */}
        <div className="text-center text-sm text-muted-foreground pt-2 border-t border-border">
          {mode === "unlock" ? (
            <button
              type="button"
              onClick={() => {
                setMode("init");
                clearError();
              }}
              className="text-emerald-600 hover:text-emerald-500 hover:underline transition-colors"
            >
              Première utilisation ? Initialiser le coffre-fort
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode("unlock");
                clearError();
              }}
              className="text-muted-foreground hover:text-foreground hover:underline transition-colors"
            >
              Retour à la connexion
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
