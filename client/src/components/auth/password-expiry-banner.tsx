"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { AlertTriangle, X } from "lucide-react";
import Link from "next/link";

const EXPIRY_KEY = "password_expiry_date";
const DISMISSED_KEY = "password_expiry_dismissed";

/** Returns the number of days until password expiry, or null if not set */
function getDaysUntilExpiry(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(EXPIRY_KEY);
  if (!raw) return null;
  const expiry = new Date(raw).getTime();
  if (isNaN(expiry)) return null;
  const diff = expiry - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function isDismissedToday(): boolean {
  if (typeof window === "undefined") return false;
  const dismissed = localStorage.getItem(DISMISSED_KEY);
  if (!dismissed) return false;
  return new Date(dismissed).toDateString() === new Date().toDateString();
}

export function PasswordExpiryBanner() {
  const { isAuthenticated } = useAuthStore();
  const [days, setDays] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (isDismissedToday()) {
      setDismissed(true);
      return;
    }
    const d = getDaysUntilExpiry();
    setDays(d);
  }, [isAuthenticated]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
    setDismissed(true);
  };

  if (!isAuthenticated || dismissed || days === null) return null;
  if (days > 7) return null; // only show J-7 and J-1

  const isUrgent = days <= 1;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
        isUrgent
          ? "bg-red-500/10 border-b border-red-500/30 text-red-700 dark:text-red-400"
          : "bg-amber-500/10 border-b border-amber-500/30 text-amber-700 dark:text-amber-400"
      }`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        {isUrgent
          ? `Your password expires ${days <= 0 ? "today" : "tomorrow"}. `
          : `Your password will expire in ${days} days. `}
        <Link
          href="/settings/security"
          className="underline font-medium hover:no-underline"
        >
          Change it now
        </Link>
      </span>
      <button
        onClick={handleDismiss}
        className="hover:opacity-70 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Utility to set the password expiry date (call after login or password change) */
export function setPasswordExpiry(expiryDate: string | Date) {
  if (typeof window === "undefined") return;
  localStorage.setItem(EXPIRY_KEY, new Date(expiryDate).toISOString());
  localStorage.removeItem(DISMISSED_KEY);
}
