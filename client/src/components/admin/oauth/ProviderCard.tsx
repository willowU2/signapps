"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProviderConfigSummary } from "@/types/oauth-providers";

interface Props {
  provider: ProviderConfigSummary;
  onConfigure: (key: string) => void;
}

export function ProviderCard({ provider, onConfigure }: Props) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base text-foreground">
              {provider.display_name}
            </CardTitle>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {provider.categories.map((c) => (
                <Badge key={c} variant="outline" className="text-xs">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
          <StatusPill provider={provider} />
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="space-y-0.5">
          <div>
            {provider.enabled ? "Activé" : "Non configuré"}
            {provider.has_credentials ? " · credentials OK" : ""}
          </div>
          {provider.purposes.length > 0 && (
            <div className="text-xs">
              Usages : {provider.purposes.join(", ")}
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onConfigure(provider.provider_key)}
        >
          Configurer
        </Button>
      </CardContent>
    </Card>
  );
}

function StatusPill({ provider }: { provider: ProviderConfigSummary }) {
  if (!provider.enabled) {
    return (
      <span className="text-xs text-muted-foreground">
        <span aria-hidden>&#x26AA;</span> Inactif
      </span>
    );
  }
  if (!provider.has_credentials) {
    return (
      <span className="text-xs text-yellow-500">
        <span aria-hidden>&#x1F7E1;</span> Sans credentials
      </span>
    );
  }
  return (
    <span className="text-xs text-green-500">
      <span aria-hidden>&#x1F7E2;</span> Activé
    </span>
  );
}
