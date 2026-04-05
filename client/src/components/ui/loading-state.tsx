"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  /** What is being loaded */
  message?: string;
  /** Show as full page, inline, or skeleton placeholder */
  variant?: "page" | "inline" | "skeleton";
  /** Additional className */
  className?: string;
}

/**
 * Standardized loading component with three display variants.
 *
 * - `page`: centered spinner with message, suitable for full page loading
 * - `inline`: small spinner + text for inline/embedded use
 * - `skeleton`: animated skeleton blocks mimicking page structure
 *
 * @example
 * ```tsx
 * if (isLoading) return <LoadingState />;
 * if (isLoading) return <LoadingState variant="skeleton" />;
 * if (isSaving) return <LoadingState variant="inline" message="Enregistrement..." />;
 * ```
 */
export function LoadingState({
  message = "Chargement...",
  variant = "page",
  className,
}: LoadingStateProps) {
  if (variant === "inline") {
    return (
      <div
        role="status"
        aria-label={message}
        className={cn(
          "flex items-center gap-2 text-sm text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{message}</span>
      </div>
    );
  }

  if (variant === "skeleton") {
    return (
      <div
        role="status"
        aria-label={message}
        className={cn("space-y-4", className)}
      >
        <div className="h-8 w-1/3 rounded-md bg-muted animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded-md bg-muted animate-pulse" />
          <div className="h-4 w-5/6 rounded-md bg-muted animate-pulse" />
          <div className="h-4 w-4/6 rounded-md bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-24 rounded-lg bg-muted animate-pulse" />
          <div className="h-24 rounded-lg bg-muted animate-pulse" />
          <div className="h-24 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={message}
      className={cn(
        "flex flex-col items-center justify-center py-16 text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="h-8 w-8 animate-spin mb-4" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
