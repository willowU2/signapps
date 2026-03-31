'use client';

/**
 * Activity Feed widget — self-contained.
 * Wraps GlobalActivityFeed as a grid widget.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { GlobalActivityFeed } from '@/components/crosslinks/GlobalActivityFeed';
import type { WidgetRenderProps } from '@/lib/dashboard/types';

export function WidgetActivityFeed({ widget }: Partial<WidgetRenderProps> = {}) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-primary" />
          Activité récente
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-auto">
        <GlobalActivityFeed compact limit={20} />
      </CardContent>
    </Card>
  );
}
