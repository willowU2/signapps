'use client';

// Feature 23: KPI cards pulling from multiple services
// Feature 14: Custom metric combining multiple data sources

import { useQuery } from '@tanstack/react-query';
import { getClient, ServiceName } from '@/lib/api/factory';

export interface KpiMetric {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  change?: number; // percent change vs previous period
  trend: 'up' | 'down' | 'stable';
  module: string;
  color?: string;
}

export interface CustomMetric {
  id: string;
  name: string;
  formula: string; // e.g. "tasks_done / tasks_total * 100"
  sources: string[];
  result?: number;
}

const CUSTOM_METRICS_KEY = 'custom_kpi_metrics';

function loadCustom(): CustomMetric[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_METRICS_KEY) || '[]'); } catch { return []; }
}

export function useKpiMetrics() {
  const client = getClient(ServiceName.IDENTITY);

  const { data: kpis, isLoading } = useQuery<KpiMetric[]>({
    queryKey: ['kpi-metrics'],
    queryFn: async () => {
      try {
        const { data } = await client.get<KpiMetric[]>('/metrics/kpi');
        return data;
      } catch { return []; }
    },
    staleTime: 5 * 60_000,
    refetchInterval: 15 * 60_000,
  });

  return {
    kpis: kpis ?? [],
    customMetrics: loadCustom(),
    isLoading,
    addCustomMetric: (metric: Omit<CustomMetric, 'id'>) => {
      const m = { ...metric, id: `cm_${Date.now()}` };
      const next = [...loadCustom(), m];
      localStorage.setItem(CUSTOM_METRICS_KEY, JSON.stringify(next));
      return m;
    },
    removeCustomMetric: (id: string) => {
      const next = loadCustom().filter(m => m.id !== id);
      localStorage.setItem(CUSTOM_METRICS_KEY, JSON.stringify(next));
    },
  };
}
