/**
 * Brand Kit API client -- per-tenant visual identity.
 *
 * Endpoints:
 *   GET  /api/v1/brand-kit  -- Retrieve the tenant's brand kit
 *   PUT  /api/v1/brand-kit  -- Update the tenant's brand kit
 */

import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.IDENTITY);

export interface BrandKit {
  id: string;
  tenant_id: string;
  name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  danger_color: string;
  success_color: string;
  colors: string[];
  fonts: { heading: string; body: string; mono: string };
  logos: {
    primary: string | null;
    secondary: string | null;
    icon: string | null;
  };
  guidelines: string;
  created_at: string;
  updated_at: string;
}

export type UpdateBrandKit = Partial<
  Omit<BrandKit, "id" | "tenant_id" | "created_at" | "updated_at">
>;

export const brandKitApi = {
  /** Retrieve the current tenant's brand kit. */
  get: () => client.get<BrandKit>("/brand-kit").then((r) => r.data),

  /** Update the current tenant's brand kit (partial update). */
  update: (data: UpdateBrandKit) =>
    client.put<BrandKit>("/brand-kit", data).then((r) => r.data),
};
