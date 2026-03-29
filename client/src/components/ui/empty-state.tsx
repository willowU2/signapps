"use client";

import * as React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  /** Module-specific icon (FileText, Mail, Users, etc.) */
  icon: LucideIcon;
  /** Short title: "Aucun élément" for empty list, "Aucun résultat" for search miss */
  title: string;
  description?: string;
  /** Label for the primary CTA (create action for this module) */
  actionLabel?: string;
  onAction?: () => void;
  /** Arbitrary React node for more complex actions */
  action?: React.ReactNode;
  className?: string;
  animate?: boolean;
  /** "empty" = empty list context, "search" = no search results */
  context?: "empty" | "search";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  action,
  className,
  animate = true,
  context = "empty",
}: EmptyStateProps) {
  const resolvedTitle =
    title ||
    (context === "search" ? "Aucun résultat" : "Aucun élément");

  const iconEl = (
    <motion.div
      animate={
        animate
          ? {
              y: [0, -6, 0],
              opacity: [0.8, 1, 0.8],
            }
          : undefined
      }
      transition={
        animate
          ? {
              duration: 3,
              ease: "easeInOut",
              repeat: Infinity,
              repeatType: "loop",
            }
          : undefined
      }
      className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 shadow-sm mb-6 ring-1 ring-primary/20"
    >
      <Icon className="h-8 w-8 text-primary/70" />
    </motion.div>
  );

  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-dashed border-border/60 bg-muted/10",
        className
      )}
    >
      {iconEl}
      <h3 className="text-xl font-semibold tracking-tight text-foreground mb-2">
        {resolvedTitle}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
      {!action && actionLabel && onAction && (
        <Button onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );

  if (!animate) {
    return content;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full h-full flex items-center justify-center p-4 min-h-[300px]"
    >
      {content}
    </motion.div>
  );
}
