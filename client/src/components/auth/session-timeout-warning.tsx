"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Clock, BellOff } from "lucide-react";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { toast } from "sonner";

const WARN_BEFORE_MS = 5 * 60 * 1000; // 5 minutes
const CHECK_INTERVAL_MS = 30 * 1000; // check every 30 seconds
const SNOOZE_KEY = "session_warning_snoozed_until";
const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Decode JWT expiry from access_token without verifying signature */
function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Check if warning is snoozed */
function isSnoozed(): boolean {
  try {
    const until = localStorage.getItem(SNOOZE_KEY);
    if (!until) return false;
    return Date.now() < parseInt(until, 10);
  } catch {
    return false;
  }
}

export function SessionTimeoutWarning() {
  const { isAuthenticated, logout } = useAuthStore();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(300);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const startCountdown = (expiresAt: number) => {
    stopCountdown();
    countdownRef.current = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((expiresAt - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        stopCountdown();
        setShowWarning(false);
        logout();
        toast.error("Votre session a expiré. Veuillez vous reconnecter.");
      }
    }, 1000);
  };

  const handleExtend = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) {
        logout();
        return;
      }
      const res = await authApi.me();
      void res;
      stopCountdown();
      setShowWarning(false);
      toast.success("Session prolongée");
    } catch {
      logout();
    }
  }, [logout]);

  const handleLogout = useCallback(() => {
    stopCountdown();
    setShowWarning(false);
    logout();
  }, [logout]);

  const handleSnooze = useCallback(() => {
    // Snooze for 24 hours
    const until = Date.now() + SNOOZE_DURATION_MS;
    localStorage.setItem(SNOOZE_KEY, String(until));
    stopCountdown();
    setShowWarning(false);
    toast.info(
      "Rappel désactivé pour 24h. La session sera prolongée automatiquement.",
    );

    // Also try to extend the session silently
    authApi.me().catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowWarning(false);
      stopCountdown();
      return;
    }

    const check = () => {
      // Skip if snoozed
      if (isSnoozed()) {
        // Silently extend session if possible
        authApi.me().catch(() => {});
        return;
      }

      const token = localStorage.getItem("access_token");
      if (!token) return;
      const expiry = getTokenExpiry(token);
      if (!expiry) return;
      const remaining = expiry - Date.now();
      if (remaining <= 0) {
        logout();
        return;
      }
      if (remaining <= WARN_BEFORE_MS && !showWarning) {
        setSecondsLeft(Math.floor(remaining / 1000));
        setShowWarning(true);
        startCountdown(expiry);
      }
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      stopCountdown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (!showWarning) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = (secondsLeft % 60).toString().padStart(2, "0");

  return (
    <AlertDialog open={showWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Session bientôt expirée
          </AlertDialogTitle>
          <AlertDialogDescription>
            Votre session expire dans{" "}
            <span className="font-semibold text-amber-600">
              {mins}:{secs}
            </span>
            . Voulez-vous rester connecté ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={handleSnooze}
          >
            <BellOff className="h-4 w-4 mr-1" />
            Ne plus afficher (24h)
          </Button>
          <div className="flex gap-2 ml-auto">
            <AlertDialogCancel onClick={handleLogout}>
              Se déconnecter
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleExtend}>
              Prolonger la session
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
