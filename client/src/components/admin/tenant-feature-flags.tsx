"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, RotateCcw, Save, Plus, Trash2 } from "lucide-react";
import { FEATURES } from "@/lib/features";
import { toast } from "sonner";

const STORAGE_KEY = "tenant_feature_flags";

interface TenantOverride {
  tenantId: string;
  tenantName: string;
  overrides: Record<string, boolean>;
}

function loadTenantOverrides(): TenantOverride[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveTenantOverrides(list: TenantOverride[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

const FEATURE_KEYS = Object.keys(FEATURES) as (keyof typeof FEATURES)[];

export function TenantFeatureFlags() {
  const [tenants, setTenants] = useState<TenantOverride[]>(loadTenantOverrides);
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const selectedTenant = tenants.find((t) => t.tenantId === selected);

  const addTenant = () => {
    if (!newName.trim()) return;
    const id = `tenant_${Date.now()}`;
    const updated = [
      ...tenants,
      { tenantId: id, tenantName: newName.trim(), overrides: {} },
    ];
    setTenants(updated);
    saveTenantOverrides(updated);
    setSelected(id);
    setNewName("");
    toast.success(`Tenant "${newName.trim()}" added`);
  };

  const removeTenant = (id: string) => {
    const updated = tenants.filter((t) => t.tenantId !== id);
    setTenants(updated);
    saveTenantOverrides(updated);
    if (selected === id) setSelected(null);
    toast.info("Tenant removed");
  };

  const toggleFlag = (key: string, current: boolean | undefined) => {
    if (!selected) return;
    const updated = tenants.map((t) => {
      if (t.tenantId !== selected) return t;
      const overrides = { ...t.overrides };
      if (current === undefined) overrides[key] = true;
      else if (current === true) overrides[key] = false;
      else delete overrides[key]; // cycle: undefined → true → false → undefined
      return { ...t, overrides };
    });
    setTenants(updated);
    saveTenantOverrides(updated);
  };

  const flagState = (key: string): boolean | undefined =>
    selectedTenant?.overrides[key];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Per-Tenant Feature Flag Overrides
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tenant selector + add */}
        <div className="flex gap-2">
          <Select value={selected || ""} onValueChange={setSelected}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select tenant..." />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((t) => (
                <SelectItem key={t.tenantId} value={t.tenantId}>
                  {t.tenantName}
                  {Object.keys(t.overrides).length > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({Object.keys(t.overrides).length} overrides)
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeTenant(selected)}
              title="Remove tenant"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="New tenant name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTenant()}
            className="flex-1"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={addTenant}
            disabled={!newName.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {selectedTenant && (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            <p className="text-xs text-muted-foreground pb-1">
              Click flag to cycle:{" "}
              <span className="text-muted-foreground">inherit</span> →{" "}
              <span className="text-green-600">on</span> →{" "}
              <span className="text-red-500">off</span>
            </p>
            {FEATURE_KEYS.map((key) => {
              const def = FEATURES[key];
              const ov = flagState(key as string);
              return (
                <div
                  key={key as string}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted/40 cursor-pointer"
                  onClick={() => toggleFlag(key as string, ov)}
                >
                  <span className="font-mono text-xs truncate">
                    {key as string}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      default:{" "}
                      <span className={def ? "text-green-600" : "text-red-500"}>
                        {def ? "on" : "off"}
                      </span>
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        ov === undefined
                          ? "text-muted-foreground border-muted text-xs"
                          : ov
                            ? "text-green-700 border-green-500/40 bg-green-500/10 text-xs"
                            : "text-red-600 border-red-500/40 bg-red-500/10 text-xs"
                      }
                    >
                      {ov === undefined ? "inherit" : ov ? "on" : "off"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!selectedTenant && tenants.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No tenants yet. Add one above to configure per-tenant flags.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
