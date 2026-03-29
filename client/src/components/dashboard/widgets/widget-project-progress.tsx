'use client';

// Feature 11: Project progress across all projects

import { FolderOpen, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { getClient, ServiceName } from '@/lib/api/factory';
import Link from 'next/link';
import type { WidgetRenderProps } from '@/lib/dashboard/types';

interface ProjectProgress {
  id: string;
  name: string;
  status: 'on_track' | 'at_risk' | 'delayed' | 'completed';
  progress: number;
  tasksTotal: number;
  tasksDone: number;
  dueDate?: string;
  url: string;
}

const STATUS_CONFIG = {
  on_track: { label: 'En cours', class: 'bg-green-100 text-green-700' },
  at_risk: { label: 'À risque', class: 'bg-yellow-100 text-yellow-700' },
  delayed: { label: 'En retard', class: 'bg-red-100 text-red-700' },
  completed: { label: 'Terminé', class: 'bg-blue-100 text-blue-700' },
};

export function WidgetProjectProgress({ widget }: Partial<WidgetRenderProps> = {}) {
  const client = getClient(ServiceName.IDENTITY);

  const { data, isLoading } = useQuery<ProjectProgress[]>({
    queryKey: ['project-progress-widget'],
    queryFn: async () => {
      try {
        const { data } = await client.get<ProjectProgress[]>('/projects/progress', { params: { limit: 10 } });
        return data;
      } catch { return []; }
    },
    staleTime: 5 * 60_000,
  });

  const projects = data ?? [];
  const active = projects.filter(p => p.status !== 'completed');

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <FolderOpen className="w-4 h-4 text-primary" />
            Projets
          </span>
          {!isLoading && (
            <span className="text-xs text-muted-foreground font-normal">{active.length} actifs</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {isLoading ? (
            <div className="space-y-3 pt-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : projects.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
              Aucun projet actif
            </div>
          ) : (
            <div className="space-y-2.5 pt-2">
              {projects.slice(0, 8).map(p => {
                const cfg = STATUS_CONFIG[p.status];
                return (
                  <Link key={p.id} href={p.url}>
                    <div className="p-2.5 rounded-lg border hover:bg-muted/40 transition-colors group">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-medium truncate flex-1">{p.name}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge className={`text-xs h-4 px-1 ${cfg.class}`}>{cfg.label}</Badge>
                          <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        </div>
                      </div>
                      <Progress value={p.progress} className="h-1.5 mb-1" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{p.tasksDone}/{p.tasksTotal} tâches</span>
                        <span>{p.progress}%</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
