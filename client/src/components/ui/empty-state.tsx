import * as React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  animate?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  animate = true,
}: EmptyStateProps) {
  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-dashed border-border/60 bg-muted/10",
        className
      )}
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 shadow-sm mb-6 ring-1 ring-primary/20">
        <Icon className="h-10 w-10 text-primary/70" />
      </div>
      <h3 className="text-xl font-semibold tracking-tight text-foreground mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
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
