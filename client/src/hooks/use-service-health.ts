import { useQuery } from '@tanstack/react-query';

export interface ServiceHealth {
  name: string;
  port: number;
  status: 'online' | 'offline';
  responseTime?: number;
}

const SERVICES = [
  { name: 'Identity', port: 3001, healthPath: '/health' },
  { name: 'Containers', port: 3002, healthPath: '/health' },
  { name: 'Proxy', port: 3003, healthPath: '/api/v1/health' },
  { name: 'Storage', port: 3004, healthPath: '/api/v1/health' },
  { name: 'AI', port: 3005, healthPath: '/api/v1/health' },
  { name: 'SecureLink', port: 3006, healthPath: '/health' },
  { name: 'Scheduler', port: 3007, healthPath: '/health' },
  { name: 'Metrics', port: 3008, healthPath: '/health' },
  { name: 'Media', port: 3009, healthPath: '/health' },
  { name: 'Docs', port: 3010, healthPath: '/health' },
  { name: 'Calendar', port: 3011, healthPath: '/health' },
];

async function checkHealth(
  port: number,
  path: string,
  timeout: number
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`http://localhost:${port}${path}`, {
      signal: controller.signal,
      mode: 'no-cors',
    });
    // mode: no-cors returns opaque response (status 0) but means service is reachable
    return res.type === 'opaque' || res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function useServiceHealth() {
  return useQuery<ServiceHealth[]>({
    queryKey: ['service-health'],
    queryFn: async () => {
      const results = await Promise.all(
        SERVICES.map(async (service) => {
          const start = Date.now();
          const online = await checkHealth(service.port, service.healthPath, 3000);
          return {
            name: service.name,
            port: service.port,
            status: online ? ('online' as const) : ('offline' as const),
            responseTime: online ? Date.now() - start : undefined,
          };
        })
      );
      return results;
    },
    refetchInterval: 30000,
  });
}
