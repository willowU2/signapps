"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Short description under the title */
  description?: string;
  /** Icon element (lucide icon) */
  icon?: React.ReactNode;
  /** Action buttons (right-aligned) */
  actions?: React.ReactNode;
  /** Additional className */
  className?: string;
  /** Badge next to title (e.g., count) */
  badge?: React.ReactNode;
}

/**
 * Standard page header: icon? + title + badge? + description + actions.
 * Used on all top-level admin pages for visual consistency.
 *
 * @example
 * ```tsx
 * <PageHeader
 *   title="Employés"
 *   description="Gérer les employés de l'organisation"
 *   icon={<Users className="h-5 w-5 text-primary" />}
 *   badge={<Badge>{count}</Badge>}
 *   actions={<Button>Ajouter</Button>}
 * />
 * ```
 */
export function PageHeader({
  title,
  description,
  icon,
  actions,
  className,
  badge,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="rounded-lg bg-primary/10 p-2 shrink-0 mt-0.5">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
