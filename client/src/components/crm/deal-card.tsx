"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { DollarSign, Calendar, User } from "lucide-react";
import type { Deal } from "@/lib/api/crm";
import { computeLeadScore } from "@/lib/api/crm";
import Link from "next/link";

interface Props {
  deal: Deal;
  compact?: boolean;
}

export function DealCard({ deal, compact }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: deal.id,
    data: { type: "deal", deal },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const score = computeLeadScore(deal);
  const scoreVariant =
    score >= 70 ? "default" : score >= 40 ? "secondary" : "outline";

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-3 bg-card cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow space-y-2 select-none"
      data-testid={`crm-deal-card-${deal.id}`}
      data-deal-stage={deal.stage}
      data-deal-value={deal.value}
    >
      <div className="flex items-start justify-between gap-1">
        <Link
          href={`/crm/deals/${deal.id}`}
          className="font-semibold text-sm truncate hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {deal.title}
        </Link>
        <Badge
          variant={scoreVariant}
          className="text-[10px] shrink-0 tabular-nums"
        >
          {score}pts
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground truncate">{deal.company}</p>

      {!compact && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <DollarSign className="h-3 w-3" />
              {new Intl.NumberFormat("fr-FR", {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 0,
              }).format(deal.value)}
            </span>
            <span className="text-muted-foreground">{deal.probability}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1">
            <div
              className="bg-emerald-500 h-1 rounded-full transition-all"
              style={{ width: `${deal.probability}%` }}
            />
          </div>
          {deal.closeDate && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" />
              {format(parseISO(deal.closeDate), "d MMM yyyy", { locale: fr })}
            </p>
          )}
          {deal.assignedTo && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <User className="h-2.5 w-2.5" />
              {deal.assignedTo}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
