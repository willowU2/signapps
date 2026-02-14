import { useQuery } from '@tanstack/react-query';
import { containersApi, ContainerInfo } from '@/lib/api';

interface ContainerDetailsParams {
  containerId: string;
  dockerId?: string;
  isManaged: boolean;
  enabled: boolean;
}

// The managed GET /containers/:id returns ContainerResponse which wraps docker_info
interface ContainerResponse {
  docker_info?: ContainerInfo;
  [key: string]: unknown;
}

export function useContainerDetails({
  containerId,
  dockerId,
  isManaged,
  enabled,
}: ContainerDetailsParams) {
  return useQuery<ContainerInfo | null>({
    queryKey: ['container-details', containerId, dockerId],
    queryFn: async () => {
      if (isManaged) {
        // GET /containers/:id returns ContainerResponse with docker_info
        const res = await containersApi.get(containerId);
        const data = res.data as unknown as ContainerResponse;
        return (data.docker_info as ContainerInfo) ?? null;
      }
      // GET /containers/docker/:dockerId/inspect returns ContainerInfo directly
      const id = dockerId || containerId;
      const res = await containersApi.inspectDocker(id);
      return res.data;
    },
    enabled,
    staleTime: 30_000,
  });
}
