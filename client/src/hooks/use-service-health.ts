import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export interface ServiceHealth {
  name: string;
  port: number;
  status: 'online' | 'offline';
  responseTime?: number;
}

const SERVICES = [
  { name: 'Identity', port: 3001 },
  { name: 'Containers', port: 3002 },
  { name: 'Proxy', port: 3003 },
  { name: 'Storage', port: 3004 },
  { name: 'AI', port: 3005 },
  { name: 'SecureLink', port: 3006 },
  { name: 'Scheduler', port: 3007 },
  { name: 'Metrics', port: 3008 },
  { name: 'Media', port: 3009 },
];

export function useServiceHealth() {
  return useQuery<ServiceHealth[]>({
    queryKey: ['service-health'],
    queryFn: async () => {
      const results = await Promise.all(
        SERVICES.map(async (service) => {
          const start = Date.now();
          try {
            await axios.get(`http://localhost:${service.port}/health`, {
              timeout: 3000,
            });
            return {
              ...service,
              status: 'online' as const,
              responseTime: Date.now() - start,
            };
          } catch {
            return {
              ...service,
              status: 'offline' as const,
            };
          }
        })
      );
      return results;
    },
    refetchInterval: 30000,
  });
}
