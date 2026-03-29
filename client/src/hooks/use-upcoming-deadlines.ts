'use client';

// Feature 17: Upcoming deadlines across all modules

import { useQuery } from '@tanstack/react-query';
import { getClient, ServiceName } from '@/lib/api/factory';
import { useMemo } from 'react';

export interface Deadline {
  id: string;
  title: string;
  dueAt: string;
  module: 'tasks' | 'projects' | 'invoices' | 'contracts' | 'calendar';
  url: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  daysLeft: number;
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function useUpcomingDeadlines(daysAhead = 14) {
  const client = getClient(ServiceName.IDENTITY);

  const { data, isLoading, error } = useQuery<Deadline[]>({
    queryKey: ['upcoming-deadlines', daysAhead],
    queryFn: async () => {
      try {
        const { data } = await client.get<Deadline[]>('/deadlines/upcoming', {
          params: { days: daysAhead },
        });
        return data.map(d => ({ ...d, daysLeft: daysUntil(d.dueAt) }));
      } catch { return []; }
    },
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });

  const grouped = useMemo(() => {
    const items = data ?? [];
    return {
      overdue: items.filter(d => d.daysLeft < 0),
      today: items.filter(d => d.daysLeft === 0),
      thisWeek: items.filter(d => d.daysLeft > 0 && d.daysLeft <= 7),
      later: items.filter(d => d.daysLeft > 7),
    };
  }, [data]);

  return { deadlines: data ?? [], grouped, isLoading, error };
}
