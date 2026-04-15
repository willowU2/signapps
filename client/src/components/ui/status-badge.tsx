"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type StatusValue =
  | "actif"
  | "en_attente"
  | "erreur"
  | "inactif"
  | "active"
  | "inactive"
  | "pending"
  | "error"
  | "enabled"
  | "disabled"
  | boolean;

/** COH-046 — semantic variant aliases */
export type StatusVariant =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral";

const VARIANT_CLASS: Record<StatusVariant, string> = {
  success:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
  warning:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  error:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  neutral: "bg-muted text-muted-foreground border-border",
};

const STATUS_CONFIG: Record<string, { label: string; variant: StatusVariant }> =
  {
    actif: { label: "Actif", variant: "success" },
    active: { label: "Actif", variant: "success" },
    enabled: { label: "Actif", variant: "success" },
    en_attente: { label: "En attente", variant: "warning" },
    pending: { label: "En attente", variant: "warning" },
    erreur: { label: "Erreur", variant: "error" },
    error: { label: "Erreur", variant: "error" },
    inactif: { label: "Inactif", variant: "neutral" },
    inactive: { label: "Inactif", variant: "neutral" },
    disabled: { label: "Inactif", variant: "neutral" },
  };

interface StatusBadgeProps {
  /** Use `status` for semantic statuses or `variant` for explicit styling */
  status?: StatusValue;
  variant?: StatusVariant;
  label?: string;
  className?: string;
  children?: React.ReactNode;
}

export function StatusBadge({
  status,
  variant,
  label,
  className,
  children,
}: StatusBadgeProps) {
  let resolvedVariant: StatusVariant = variant ?? "neutral";
  let resolvedLabel = label ?? "";

  if (status !== undefined && variant === undefined) {
    const key =
      typeof status === "boolean"
        ? status
          ? "active"
          : "inactive"
        : String(status).toLowerCase().replace(/\s+/g, "_");
    const config = STATUS_CONFIG[key] ?? {
      label: String(status),
      variant: "neutral" as StatusVariant,
    };
    resolvedVariant = config.variant;
    resolvedLabel = label ?? config.label;
  }

  return (
    <Badge
      className={cn(
        "text-xs px-2 py-0.5 rounded-full border font-medium",
        VARIANT_CLASS[resolvedVariant],
        className,
      )}
    >
      {children ?? resolvedLabel}
    </Badge>
  );
}
