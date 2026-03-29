/**
 * @deprecated Use @/lib/api/remote instead.
 * This file is a backward-compatibility shim. Consumers should migrate to
 * import { remoteApi, ... } from '@/lib/api/remote'.
 */

// Re-export all types from the canonical module
export type {
  RemoteConnection,
  CreateConnectionRequest,
  UpdateConnectionRequest,
} from '@/lib/api/remote';

import { getClient, getServiceBaseUrl, ServiceName } from '@/lib/api/factory';

const remoteClient = getClient(ServiceName.REMOTE);

// Legacy nested API shape kept for backward compatibility.

export const connectionApi = {
  list: async () => (await remoteClient.get('/remote/connections')).data,
  get: async (id: string) => (await remoteClient.get(`/remote/connections/${id}`)).data,
  create: async (data: any) => (await remoteClient.post('/remote/connections', data)).data,
  update: async (id: string, data: any) => (await remoteClient.put(`/remote/connections/${id}`, data)).data,
  delete: async (id: string) => { await remoteClient.delete(`/remote/connections/${id}`) },
  getWebSocketUrl: (connectionId: string): string => {
    const apiUrl = getServiceBaseUrl(ServiceName.REMOTE);
    const wsBase = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    return `${wsBase}/remote/ws/${connectionId}`;
  },
};

export const remoteApi = { connections: connectionApi };
export default remoteApi;
