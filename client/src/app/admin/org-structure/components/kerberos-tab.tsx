"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Key, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAdDomains,
  useAdKeys,
  useRotateKey,
} from "@/hooks/use-active-directory";
import type { AdPrincipalKey } from "@/types/active-directory";
import { ENC_TYPE_LABELS } from "@/types/active-directory";

// =============================================================================
// KerberosTabContent
// =============================================================================

export function KerberosTabContent({
  nodeId: _nodeId,
  nodeType,
}: {
  nodeId: string;
  nodeType: string;
}) {
  const { data: domains = [] } = useAdDomains();
  const domainId = domains[0]?.id || "";
  const { data: keys = [] } = useAdKeys(domainId);
  const rotateKey = useRotateKey();

  if (!domainId) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <Key className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Aucun domaine AD configure</p>
      </div>
    );
  }

  const filteredKeys = keys.filter((k: AdPrincipalKey) => {
    if (nodeType === "computer") return k.principal_type === "computer";
    if (nodeType === "group") return true;
    return k.principal_type === "user";
  });

  const grouped = filteredKeys.reduce<Record<string, AdPrincipalKey[]>>(
    (acc, k: AdPrincipalKey) => {
      (acc[k.principal_name] ||= []).push(k);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-3">
      <Badge variant="outline" className="text-xs">
        {Object.keys(grouped).length} principal(s)
      </Badge>
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center text-muted-foreground py-6">
          <Key className="h-6 w-6 mx-auto mb-2 opacity-30" />
          <p className="text-xs">Aucun principal Kerberos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(grouped).map(([principal, pkeys]) => (
            <div key={principal} className="rounded-md border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Key className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium font-mono">
                    {principal}
                  </span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px]",
                      pkeys[0]?.principal_type === "krbtgt"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : pkeys[0]?.principal_type === "user"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : pkeys[0]?.principal_type === "computer"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
                    )}
                  >
                    {pkeys[0]?.principal_type}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => rotateKey.mutate({ domainId, principal })}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Rotation
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                {pkeys.map((k: AdPrincipalKey) => (
                  <div key={k.id} className="flex items-center gap-1">
                    <span className="font-mono">
                      {ENC_TYPE_LABELS[k.enc_type] || `enc${k.enc_type}`}
                    </span>
                    <span>v{k.key_version}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
