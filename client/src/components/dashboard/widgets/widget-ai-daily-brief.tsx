'use client';

/**
 * AI Daily Brief widget — self-contained.
 * Shows AI-generated summary: pending tasks, unread emails, today's events.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles } from 'lucide-react';
import { useDashboardData } from '@/hooks/use-dashboard';
import type { WidgetRenderProps } from '@/lib/dashboard/types';

export function WidgetAiDailyBrief({ widget }: Partial<WidgetRenderProps> = {}) {
  const { data, isLoading } = useDashboardData();
  const stats = (data as any)?.stats;
  const tasks = stats?.pending_tasks ?? 0;
  const emails = stats?.unread_emails ?? 0;
  const events = stats?.today_events ?? 0;

  if (isLoading) {
    return (
      <Card className="h-full border-blue-500/20 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-blue-500" />
            Résumé du jour
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-5 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border-blue-500/20 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-blue-500" />
          Résumé du jour
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Vous avez <strong>{tasks}</strong> tâche{tasks !== 1 ? 's' : ''} en attente,{' '}
          <strong>{emails}</strong> email{emails !== 1 ? 's' : ''} non lu{emails !== 1 ? 's' : ''}, et{' '}
          <strong>{events}</strong> événement{events !== 1 ? 's' : ''} aujourd&apos;hui.
        </p>
      </CardContent>
    </Card>
  );
}
