"use client";

/**
 * Feature 3: Task detail → show linked emails
 * Feature 4: Calendar event → show linked tasks
 * Feature 8: Email attachment → link to task/event (display part)
 *
 * Generic panel showing cross-links for any entity.
 */

import { useState } from "react";
import {
  Mail,
  CheckSquare,
  CalendarDays,
  ExternalLink,
  Plus,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useInteropLinks } from "@/hooks/use-interop";
import type { CrossLink } from "@/lib/interop/store";

const TYPE_ICON: Record<string, React.ReactNode> = {
  mail: <Mail className="h-3.5 w-3.5" />,
  task: <CheckSquare className="h-3.5 w-3.5" />,
  event: <CalendarDays className="h-3.5 w-3.5" />,
};

const TYPE_LABEL: Record<string, string> = {
  mail: "Email",
  task: "Tâche",
  event: "Événement",
};

const TYPE_HREF: Record<string, (id: string) => string> = {
  mail: () => "/mail",
  task: () => "/tasks",
  event: () => "/cal",
};

interface Props {
  entityType: "mail" | "task" | "event";
  entityId: string;
  className?: string;
}

function LinkRow({
  link,
  entityType,
  entityId,
}: {
  link: CrossLink;
  entityType: string;
  entityId: string;
}) {
  const isSource = link.sourceType === entityType && link.sourceId === entityId;
  const otherType = isSource ? link.targetType : link.sourceType;
  const otherId = isSource ? link.targetId : link.sourceId;
  const otherTitle = isSource ? link.targetTitle : link.sourceTitle;
  const href = TYPE_HREF[otherType]?.(otherId) ?? "#";

  return (
    <a
      href={href}
      className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/60 text-sm group transition-colors"
    >
      <span className="text-muted-foreground">{TYPE_ICON[otherType]}</span>
      <span className="flex-1 truncate">
        {otherTitle || otherId.slice(0, 12) + "…"}
      </span>
      <Badge variant="secondary" className="text-[10px] h-4 px-1">
        {link.relation}
      </Badge>
      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
    </a>
  );
}

export function LinkedEntitiesPanel({
  entityType,
  entityId,
  className,
}: Props) {
  const { links } = useInteropLinks(entityType, entityId);
  const [collapsed, setCollapsed] = useState(false);

  if (links.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground",
          className,
        )}
      >
        <Link2 className="h-4 w-4 mx-auto mb-1 opacity-40" />
        Aucun lien inter-module
      </div>
    );
  }

  const grouped = links.reduce<Record<string, CrossLink[]>>((acc, link) => {
    const isSource =
      link.sourceType === entityType && link.sourceId === entityId;
    const otherType = isSource ? link.targetType : link.sourceType;
    (acc[otherType] = acc[otherType] || []).push(link);
    return acc;
  }, {});

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 overflow-hidden",
        className,
      )}
    >
      <button
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" />
          Liens associés ({links.length})
        </span>
        <span>{collapsed ? "▸" : "▾"}</span>
      </button>
      {!collapsed && (
        <div className="px-2 pb-2 space-y-1">
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-1.5 pb-0.5">
                {TYPE_LABEL[type] ?? type} ({items.length})
              </p>
              {items.map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  entityType={entityType}
                  entityId={entityId}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
