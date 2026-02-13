import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { containersApi } from '@/lib/api';
import { toast } from 'sonner';

export interface ContainerPortMapping {
  host: number;
  container: number;
  protocol: string;
}

export interface Container {
  id: string;
  name: string;
  image: string;
  status: string;
  state: 'running' | 'stopped' | 'restarting' | 'paused' | 'exited';
  cpu: string;
  memory: string;
  ports: string[];
  portMappings: ContainerPortMapping[];
  created: string;
  is_system: boolean;
  is_managed: boolean;
  docker_id?: string;
  category?: string;
  tags: string[];
  app_name?: string;
}

interface PortMapping {
  host_port?: number;
  container_port: number;
  protocol?: string;
}

interface DockerInfo {
  status?: string;
  state?: string;
  cpu_percent?: number;
  memory_usage?: number;
  ports?: PortMapping[];
}

interface ContainerApiResponse {
  id: string;
  name: string;
  image: string;
  status?: string;
  created_at?: string;
  created?: string;
  docker_id?: string;
  docker_info?: DockerInfo;
  is_system?: boolean;
  is_managed?: boolean;
  category?: string;
  tags?: string[];
  app_name?: string;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function useContainers() {
  return useQuery<Container[]>({
    queryKey: ['containers'],
    queryFn: async () => {
      const response = await containersApi.list();
      return (response.data || []).map((c: ContainerApiResponse) => {
        const dockerInfo = c.docker_info;
        return {
          id: c.id,
          name: c.name,
          image: c.image,
          status: c.status || dockerInfo?.status || 'unknown',
          state: (dockerInfo?.state || 'stopped') as Container['state'],
          cpu: dockerInfo?.cpu_percent ? `${dockerInfo.cpu_percent}%` : '-',
          memory: dockerInfo?.memory_usage ? formatBytes(dockerInfo.memory_usage) : '-',
          ports: dockerInfo?.ports?.map((p: PortMapping) => `${p.host_port || p.container_port}`) || [],
          portMappings: dockerInfo?.ports
            ?.filter((p: PortMapping) => p.host_port)
            .map((p: PortMapping) => ({
              host: p.host_port!,
              container: p.container_port,
              protocol: p.protocol || 'tcp',
            })) || [],
          created: c.created_at || c.created || '',
          is_system: c.is_system || false,
          is_managed: c.is_managed !== false,
          docker_id: c.docker_id,
          category: c.category,
          tags: c.tags || [],
          app_name: c.app_name,
        };
      });
    },
  });
}

export function useContainerAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'start' | 'stop' | 'restart' | 'remove' | 'update' }) => {
      switch (action) {
        case 'start': return containersApi.start(id);
        case 'stop': return containersApi.stop(id);
        case 'restart': return containersApi.restart(id);
        case 'update': return containersApi.update(id);
        case 'remove': return containersApi.remove(id);
      }
    },
    onSuccess: (_, { action }) => {
      const messages: Record<string, string> = {
        start: 'Container started',
        stop: 'Container stopped',
        restart: 'Container restarted',
        update: 'Container updated to latest image',
        remove: 'Container removed',
      };
      toast.success(messages[action]);
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
    onError: (_, { action }) => {
      toast.error(`Failed to ${action} container`);
    },
  });
}

export function useDockerAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dockerId, action }: { dockerId: string; action: 'start' | 'restart' }) => {
      switch (action) {
        case 'start': return containersApi.startDocker(dockerId);
        case 'restart': return containersApi.restartDocker(dockerId);
      }
    },
    onSuccess: (_, { action }) => {
      toast.success(`Container ${action + 'ed'}`);
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
    onError: (_, { action }) => {
      toast.error(`Failed to ${action} container`);
    },
  });
}
