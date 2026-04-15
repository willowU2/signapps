"use client";

import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveStatus = "saved" | "saving" | "unsaved";

interface AutoSaveIndicatorProps {
  status: SaveStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  SaveStatus,
  { icon: React.ReactNode; label: string; color: string }
> = {
  saved: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: "Sauvegarde",
    color: "text-green-600 dark:text-green-400",
  },
  saving: {
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    label: "Sauvegarde en cours...",
    color: "text-muted-foreground",
  },
  unsaved: {
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    label: "Non sauvegarde",
    color: "text-yellow-600 dark:text-yellow-400",
  },
};

export function AutoSaveIndicator({
  status,
  className,
}: AutoSaveIndicatorProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs transition-colors",
        config.color,
        className,
      )}
    >
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
}
