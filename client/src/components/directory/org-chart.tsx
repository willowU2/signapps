"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface OrgChartNode {
  id: string;
  name: string;
  title: string;
  department: string;
  avatarUrl?: string;
  children?: OrgChartNode[];
}

interface TreeNodeProps {
  node: OrgChartNode;
  level: number;
}

function OrgChartNodeComponent({ node, level }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const departmentColors: Record<string, string> = {
    engineering: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
    product: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
    design: "bg-pink-500/20 text-pink-700 dark:text-pink-400",
    marketing: "bg-orange-500/20 text-orange-700 dark:text-orange-400",
    sales: "bg-green-500/20 text-green-700 dark:text-green-400",
    operations: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
    hr: "bg-red-500/20 text-red-700 dark:text-red-400",
    finance: "bg-slate-500/20 text-slate-700 dark:text-slate-400",
  };

  const deptColor =
    departmentColors[node.department.toLowerCase()] ||
    "bg-gray-500/20 text-muted-foreground dark:text-gray-400";

  return (
    <div className={cn("py-2", level > 0 && "ml-6")}>
      <div className="flex items-center gap-3">
        {hasChildren && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-shrink-0 p-1 hover:bg-muted rounded transition-colors"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-6" />}

        <Avatar className="h-10 w-10 border-2 border-primary/20">
          {node.avatarUrl && <AvatarImage src={node.avatarUrl} />}
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
            {getInitials(node.name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">
            {node.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">{node.title}</p>
          <span
            className={cn(
              "inline-block text-xs font-medium px-2 py-0.5 rounded mt-1",
              deptColor,
            )}
          >
            {node.department}
          </span>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="mt-2 border-l border-border/50 pl-0">
          {node.children!.map((child) => (
            <OrgChartNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface OrgChartProps {
  rootNode: OrgChartNode;
  className?: string;
}

export function OrgChart({ rootNode, className }: OrgChartProps) {
  return (
    <div
      className={cn(
        "p-6 bg-card border border-border/50 rounded-lg",
        className,
      )}
    >
      <div className="mb-4">
        <h2 className="text-lg font-bold text-foreground">
          Organization Chart
        </h2>
        <p className="text-sm text-muted-foreground">
          Click expand/collapse to view team structure
        </p>
      </div>
      <div className="space-y-1">
        <OrgChartNodeComponent node={rootNode} level={0} />
      </div>
    </div>
  );
}
