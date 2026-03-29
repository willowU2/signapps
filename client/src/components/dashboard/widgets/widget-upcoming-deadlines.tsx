'use client';

// Feature 17: Upcoming deadlines across all modules widget

import { AlertTriangle, Clock, CheckCircle, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useUpcomingDeadlines } from '@/hooks/use-upcoming-deadlines';
import Link from 'next/link';
import type { WidgetRenderProps } from '@/lib/dashboard/types';

const MODULE_COLORS: Record<string, string> = {
  tasks: 'bg-blue-100 text-blue-700',
  projects: 'bg-purple-100 text-purple-700',
  invoices: 'bg-green-100 text-green-700',
  contracts: 'bg-orange-100 text-orange-700',
  calendar: 'bg-pink-100 text-pink-700',
};

export function WidgetUpcomingDeadlines({ widget }: Partial<WidgetRenderProps> = {}) {
  const { grouped, isLoading } = useUpcomingDeadlines(14);

  const sections = [
    { key: 'overdue', label: 'En retard', items: grouped.overdue, color: 'text-destructive', icon: AlertTriangle },
    { key: 'today', label: "Aujourd'hui", items: grouped.today, color: 'text-orange-500', icon: Clock },
    { key: 'thisWeek', label: 'Cette semaine', items: grouped.thisWeek, color: 'text-yellow-600', icon: Clock },
    { key: 'later', label: 'Plus tard', items: grouped.later, color: 'text-muted-foreground', icon: CheckCircle },
  ].filter(s => s.items.length > 0);

  const total = (grouped.overdue?.length ?? 0) + (grouped.today?.length ?? 0) +
    (grouped.thisWeek?.length ?? 0) + (grouped.later?.length ?? 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-primary" />
            Échéances à venir
          </span>
          {!isLoading && total > 0 && (
            <Badge variant={grouped.overdue?.length ? 'destructive' : 'secondary'} className="text-xs">
              {total}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {isLoading ? (
            <div className="space-y-2 pt-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 rounded" />)}
            </div>
          ) : sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-sm text-muted-foreground">
              <CheckCircle className="w-6 h-6 mb-1 text-green-500" />
              Aucune échéance imminente
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {sections.map(s => {
                const Icon = s.icon;
                return (
                  <div key={s.key}>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1 ${s.color}`}>
                      <Icon className="w-3 h-3" />
                      {s.label} ({s.items.length})
                    </p>
                    <div className="space-y-1">
                      {s.items.slice(0, 4).map(d => (
                        <Link key={d.id} href={d.url}>
                          <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 group">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{d.title}</p>
                              <div className="flex items-center gap-1.5">
                                <Badge className={`text-xs h-3.5 px-1 ${MODULE_COLORS[d.module] || 'bg-muted text-muted-foreground'}`}>
                                  {d.module}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {d.daysLeft < 0 ? `${Math.abs(d.daysLeft)}j de retard` :
                                    d.daysLeft === 0 ? 'Aujourd\'hui' :
                                    `J-${d.daysLeft}`}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                          </div>
                        </Link>
                      ))}
                      {s.items.length > 4 && (
                        <p className="text-xs text-muted-foreground pl-2">+{s.items.length - 4} autres</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
