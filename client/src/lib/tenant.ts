/**
 * Multi-tenant workspace utilities
 */

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  primaryColor?: string;
  createdAt: string;
}

const TENANT_KEY = "signapps-current-tenant";

export function getCurrentTenant(): Tenant | null {
  try {
    const stored = localStorage.getItem(TENANT_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

export function setCurrentTenant(tenant: Tenant) {
  localStorage.setItem(TENANT_KEY, JSON.stringify(tenant));
}

export function getTenantApiBase(tenant: Tenant): string {
  return `/api/tenants/${tenant.slug}`;
}

export function applyTenantBranding(tenant: Tenant) {
  if (tenant.primaryColor) {
    document.documentElement.style.setProperty("--tenant-primary", tenant.primaryColor);
  }
}
