'use client';

// Feature 2: Cross-module activity timeline widget
// Feature 8: Team activity feed widget

import { useState } from 'react';
import { Activity, Users, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCrossModuleActivity, type ActivityModule } from '@/hooks/use-cross-module-activity';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { WidgetRenderProps } from '@/lib/dashboard/types';

const MODULE_COLORS: Record<ActivityModule, string> = {
  mail: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  tasks: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  docs: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  calendar: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  contacts: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  drive: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  crm: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
};

type ViewMode = 'mine' | 'team';

export function WidgetActivityTimeline({ widget }: Partial<WidgetRenderProps> = {}) {
  const [view, setView] = useState<ViewMode>('mine');
  const [moduleFilter, setModuleFilter] = useState<ActivityModule | 'all'>('all');
  const { activities, isLoading } = useCrossModuleActivity(40);

  const shown = activities.filter(a =>
    (moduleFilter === 'all' || a.module === moduleFilter)
  ).slice(0, 20);

  const modules = [...new Set(activities.map(a => a.module))] as ActivityModule[];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            {view === 'team' ? <Users className="w-4 h-4 text-primary" /> : <Activity className="w-4 h-4 text-primary" />}
            {view === 'team' ? 'Activité équipe' : 'Mon activité'}
          </CardTitle>
          <div className="flex gap-1">
            <Button size="sm" variant={view === 'mine' ? 'secondary' : 'ghost'} className="h-6 text-xs px-2" onClick={() => setView('mine')}>
              Moi
            </Button>
            <Button size="sm" variant={view === 'team' ? 'secondary' : 'ghost'} className="h-6 text-xs px-2" onClick={() => setView('team')}>
              Équipe
            </Button>
          </div>
        </div>
        {modules.length > 0 && (
          <div className="flex gap-1 overflow-x-auto">
            <Button size="sm" variant={moduleFilter === 'all' ? 'secondary' : 'ghost'} className="h-5 text-xs px-1.5 shrink-0" onClick={() => setModuleFilter('all')}>
              Tout
            </Button>
            {modules.slice(0, 5).map(m => (
              <Button key={m} size="sm" variant={moduleFilter === m ? 'secondary' : 'ghost'} className="h-5 text-xs px-1.5 shrink-0 capitalize" onClick={() => setModuleFilter(m)}>
                {m}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {isLoading ? (
            <div className="space-y-2 pt-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
            </div>
          ) : shown.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
              Aucune activité récente
            </div>
          ) : (
            <div className="space-y-1 pt-2">
              {shown.map(a => (
                <div key={a.id} className="flex items-start gap-2 py-1.5">
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5 text-xs font-medium">
                    {a.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs">
                      <span className="font-medium">{a.userName}</span>
                      {' '}
                      <span className="text-muted-foreground">{a.action}</span>
                      {' '}
                      {a.entityUrl
                        ? <a href={a.entityUrl} className="font-medium hover:underline">{a.entityTitle}</a>
                        : <span className="font-medium">{a.entityTitle}</span>
                      }
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge className={`text-xs h-4 px-1 ${MODULE_COLORS[a.module] || ''}`}>{a.module}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(a.timestamp), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
