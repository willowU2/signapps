"use client";

import React from "react";
import { FolderTree, Users, Shield, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatsBarProps {
  nodeCount: number;
  personCount: number;
  policyCount: number;
  siteCount: number;
}

export function StatsBar({
  nodeCount,
  personCount,
  policyCount,
  siteCount,
}: StatsBarProps) {
  const stats = [
    {
      label: "Noeuds",
      value: nodeCount,
      icon: FolderTree,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "Personnes",
      value: personCount,
      icon: Users,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-900/20",
    },
    {
      label: "Politiques",
      value: policyCount,
      icon: Shield,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      label: "Sites",
      value: siteCount,
      icon: MapPin,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-900/20",
    },
  ];

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card/50">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg",
              stat.bg,
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", stat.color)} />
            <span className={cn("text-sm font-bold", stat.color)}>
              {stat.value}
            </span>
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
        );
      })}
    </div>
  );
}
