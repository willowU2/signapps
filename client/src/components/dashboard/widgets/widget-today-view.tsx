'use client';

/**
 * Today View widget — self-contained.
 * Shows unified today view: emails + tasks + events combined.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { TodayView } from '@/components/interop/TodayView';
import type { WidgetRenderProps } from '@/lib/dashboard/types';

export function WidgetTodayView({ widget }: Partial<WidgetRenderProps> = {}) {
  return (
    <Card className="h-full flex flex-col">
      <CardContent className="flex-1 min-h-0 p-4 overflow-auto">
        <TodayView maxItems={15} />
      </CardContent>
    </Card>
  );
}
