"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, Loader2, MonitorCheck, Info } from "lucide-react";
import { useAdDomains } from "@/hooks/use-active-directory";
import type { AdDomain } from "@/types/active-directory";

// =============================================================================
// Types
// =============================================================================

interface NtpConfig {
  enabled?: boolean;
  upstream?: string[];
  stratum?: number;
  restrict_subnet?: string;
  max_drift_ms?: number;
}

function extractNtpConfig(domain: AdDomain): NtpConfig | undefined {
  return domain.config?.ntp as NtpConfig | undefined;
}

// =============================================================================
// Sub-components
// =============================================================================

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-card">
      <div className="px-3 py-2 border-b bg-muted/30">
        <span className="text-xs font-semibold text-foreground">{title}</span>
      </div>
      <div className="p-3 space-y-3">{children}</div>
    </div>
  );
}

// =============================================================================
// NtpTabContent
// =============================================================================

export function NtpTabContent({
  nodeId: _nodeId,
  nodeType,
}: {
  nodeId: string;
  nodeType: string;
}) {
  const { data: domains = [], isLoading, isError } = useAdDomains();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Chargement...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center text-destructive py-8">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">
          Erreur lors du chargement de la configuration NTP
        </p>
      </div>
    );
  }

  const domain = domains[0] as AdDomain | undefined;

  if (!domain) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Aucun domaine AD configure</p>
      </div>
    );
  }

  const ntpConfig = extractNtpConfig(domain);

  if (!ntpConfig) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Aucune configuration NTP dans ce domaine</p>
      </div>
    );
  }

  const isEnabled = ntpConfig.enabled ?? domain.ntp_enabled ?? false;

  return (
    <div className="space-y-3">
      {/* NTP Configuration */}
      <SectionCard title="Configuration NTP">
        <LabeledField label="Statut">
          <Badge
            variant={isEnabled ? "default" : "secondary"}
            className={
              isEnabled
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0"
                : "bg-muted text-muted-foreground"
            }
          >
            {isEnabled ? "Active" : "Desactive"}
          </Badge>
        </LabeledField>

        <LabeledField label="Serveurs upstream">
          {ntpConfig.upstream && ntpConfig.upstream.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {ntpConfig.upstream.map((server) => (
                <Badge
                  key={server}
                  variant="outline"
                  className="text-xs font-mono"
                >
                  {server}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">
              Aucun serveur configure
            </span>
          )}
        </LabeledField>

        <LabeledField label="Stratum">
          {ntpConfig.stratum !== undefined ? (
            <span className="font-mono text-sm">{ntpConfig.stratum}</span>
          ) : (
            <span className="text-muted-foreground text-xs">Non defini</span>
          )}
        </LabeledField>

        <LabeledField label="Derive maximale toleree">
          {ntpConfig.max_drift_ms !== undefined ? (
            <span className="font-mono text-sm">
              {ntpConfig.max_drift_ms} ms
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">Non definie</span>
          )}
        </LabeledField>

        <LabeledField label="Sous-reseau restreint">
          {ntpConfig.restrict_subnet ? (
            <span className="font-mono text-sm">
              {ntpConfig.restrict_subnet}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">
              Aucune restriction
            </span>
          )}
        </LabeledField>
      </SectionCard>

      {/* Computer-specific sync status */}
      {nodeType === "computer" && (
        <SectionCard title="Etat de synchronisation">
          <div className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2.5">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sync status will be available when the computer is online
            </p>
          </div>

          <LabeledField label="Derniere synchronisation">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MonitorCheck className="h-3.5 w-3.5" />
              <span className="text-xs">Hors ligne ou inconnu</span>
            </div>
          </LabeledField>

          <LabeledField label="Decalage d'horloge (vs DC)">
            <span className="text-xs text-muted-foreground">— ms</span>
          </LabeledField>
        </SectionCard>
      )}
    </div>
  );
}
