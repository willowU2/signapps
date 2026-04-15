"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ListItemProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

/**
 * COH-050 — ListItem: unified list item structure
 * icon + title + subtitle + actions
 */
export function ListItem({
  icon,
  title,
  subtitle,
  actions,
  className,
  onClick,
}: ListItemProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
        onClick && "hover:bg-muted/60 cursor-pointer w-full text-left",
        className,
      )}
      onClick={onClick}
    >
      {icon && (
        <span className="shrink-0 flex items-center justify-center text-muted-foreground">
          {icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{title}</div>
        {subtitle && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {subtitle}
          </div>
        )}
      </div>
      {actions && (
        <div
          className="shrink-0 flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </Tag>
  );
}
