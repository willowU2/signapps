"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

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
  } catch {
    return null;
  }
}

export function setCurrentTenant(tenant: Tenant) {
  localStorage.setItem(TENANT_KEY, JSON.stringify(tenant));
}

export function getTenantApiBase(tenant: Tenant): string {
  return `/api/tenants/${tenant.slug}`;
}

export function applyTenantBranding(tenant: Tenant) {
  if (tenant.primaryColor) {
    document.documentElement.style.setProperty(
      "--tenant-primary",
      tenant.primaryColor,
    );
  }
}

// --- React Context & Provider ---
const TenantContext = createContext<{
  tenant: Tenant | null;
  setTenant: (t: Tenant) => void;
}>({
  tenant: null,
  setTenant: () => {},
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenantState] = useState<Tenant | null>(null);

  useEffect(() => {
    setTenantState(getCurrentTenant());
  }, []);

  function setTenant(t: Tenant) {
    setCurrentTenant(t);
    setTenantState(t);
    applyTenantBranding(t);
  }

  return (
    <TenantContext.Provider value={{ tenant, setTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}

// --- Settings Page Component ---
export function TenantSettingsPage() {
  const { tenant } = useTenant();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Parametres Organisation</h1>
      {tenant ? (
        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-2">
            <p className="text-sm text-muted-foreground">Nom</p>
            <p className="font-medium">{tenant.name}</p>
          </div>
          <div className="border rounded-lg p-4 space-y-2">
            <p className="text-sm text-muted-foreground">Slug</p>
            <p className="font-mono text-sm">{tenant.slug}</p>
          </div>
          {tenant.primaryColor && (
            <div className="border rounded-lg p-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Couleur principale
              </p>
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded"
                  style={{ background: tenant.primaryColor }}
                />
                <span className="font-mono text-sm">{tenant.primaryColor}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground">Aucune organisation configuree</p>
      )}
    </div>
  );
}
