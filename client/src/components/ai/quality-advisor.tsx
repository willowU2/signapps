"use client";

import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowUpCircle, TrendingUp, Cloud, Server } from "lucide-react";
import {
  useAiCapabilities,
  type Capability,
} from "@/hooks/use-ai-capabilities";

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const CAPABILITY_LABELS: Record<string, string> = {
  llm: "LLM",
  stt: "Speech-to-Text",
  tts: "Text-to-Speech",
  ocr: "OCR",
  embeddings: "Embeddings",
};

function getLabel(capability: string): string {
  return CAPABILITY_LABELS[capability] ?? capability;
}

function qualityDelta(local: number, cloud: number | null): number | null {
  if (cloud === null) return null;
  return cloud - local;
}

// ═══════════════════════════════════════════════════════════════════════════
// RECOMMENDATION CARD
// ═══════════════════════════════════════════════════════════════════════════

function RecommendationCard({ cap }: { cap: Capability }) {
  const delta = qualityDelta(cap.local_quality, cap.cloud_quality);

  return (
    <div className="p-4 rounded-lg border space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{getLabel(cap.capability)}</h3>
        <Badge className="bg-yellow-500/15 text-yellow-700 border-yellow-200 text-xs">
          <ArrowUpCircle className="h-3 w-3 mr-1" />
          Upgrade recommande
        </Badge>
      </div>

      {/* Quality comparison bars */}
      <div className="space-y-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Server className="h-3 w-3" />
              Local
            </span>
            <span className="font-medium">{cap.local_quality}%</span>
          </div>
          <Progress value={cap.local_quality} className="h-2" />
        </div>

        {cap.cloud_quality !== null && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Cloud className="h-3 w-3" />
                Cloud
              </span>
              <span className="font-medium">{cap.cloud_quality}%</span>
            </div>
            <Progress
              value={cap.cloud_quality}
              className="h-2 [&>div]:bg-blue-500"
            />
          </div>
        )}
      </div>

      {/* Delta + recommendation text */}
      <div className="text-xs text-muted-foreground">
        {delta !== null && delta > 0 ? (
          <p className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-green-600" />
            Un backend cloud offrirait{" "}
            <span className="font-semibold text-foreground">
              +{delta} pts
            </span>{" "}
            de qualite pour {getLabel(cap.capability)}.
            {cap.active_backend !== "cloud" && (
              <> Configurez une cle API pour activer le mode cloud.</>
            )}
          </p>
        ) : (
          <p>
            Un backend cloud pourrait ameliorer les resultats pour{" "}
            {getLabel(cap.capability)}.
          </p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// QUALITY ADVISOR
// ═══════════════════════════════════════════════════════════════════════════

export function QualityAdvisor() {
  const { capabilities, fetchCapabilities } = useAiCapabilities();

  useEffect(() => {
    // Fetch capabilities if not already loaded
    if (capabilities.length === 0) {
      fetchCapabilities();
    }
  }, [capabilities.length, fetchCapabilities]);

  const upgradeCapabilities = capabilities.filter((c) => c.upgrade_recommended);

  if (upgradeCapabilities.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Conseiller qualite
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Toutes les capacites sont a leur niveau optimal. Aucune
            recommandation de mise a niveau.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Conseiller qualite
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {upgradeCapabilities.length} recommandation
            {upgradeCapabilities.length > 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {upgradeCapabilities.map((cap) => (
          <RecommendationCard key={cap.capability} cap={cap} />
        ))}
      </CardContent>
    </Card>
  );
}
