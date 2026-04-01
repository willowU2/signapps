/**
 * @deprecated Use @/lib/api/pxe instead.
 * This file is a backward-compatibility shim. Consumers should migrate to
 * import { pxeApi, ... } from '@/lib/api/pxe'.
 */

// Re-export all types from the canonical module
export type {
  PxeProfile,
  CreatePxeProfileRequest,
  UpdatePxeProfileRequest,
  PxeAsset,
  RegisterPxeAssetRequest,
  UpdatePxeAssetRequest,
} from "@/lib/api/pxe";

import { getClient, ServiceName } from "@/lib/api/factory";

const pxeClient = getClient(ServiceName.PXE);

// Legacy nested API shape kept for backward compatibility.

export const profileApi = {
  list: async () => (await pxeClient.get("/pxe/profiles")).data,
  get: async (id: string) => (await pxeClient.get(`/pxe/profiles/${id}`)).data,
  create: async (data: Record<string, unknown>) =>
    (await pxeClient.post("/pxe/profiles", data)).data,
  update: async (id: string, data: Record<string, unknown>) =>
    (await pxeClient.put(`/pxe/profiles/${id}`, data)).data,
  delete: async (id: string) => {
    await pxeClient.delete(`/pxe/profiles/${id}`);
  },
};

export const assetApi = {
  list: async () => (await pxeClient.get("/pxe/assets")).data,
  get: async (id: string) => (await pxeClient.get(`/pxe/assets/${id}`)).data,
  register: async (data: Record<string, unknown>) =>
    (await pxeClient.post("/pxe/assets", data)).data,
  update: async (id: string, data: Record<string, unknown>) =>
    (await pxeClient.put(`/pxe/assets/${id}`, data)).data,
  delete: async (id: string) => {
    await pxeClient.delete(`/pxe/assets/${id}`);
  },
};

export const pxeApi = { profiles: profileApi, assets: assetApi };
export default pxeApi;
