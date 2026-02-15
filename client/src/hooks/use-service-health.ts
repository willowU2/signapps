import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

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
];

export function useServiceHealth() {
  return useQuery<ServiceHealth[]>({
    queryKey: ['service-health'],
    queryFn: async () => {
      const results = await Promise.all(
        SERVICES.map(async (service) => {
          const start = Date.now();
          try {
            await axios.get(`http://localhost:${service.port}${service.healthPath}`, {
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
