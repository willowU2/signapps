'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Brain,
  Mic,
  Volume2,
  ScanText,
  Database,
  RefreshCw,
  Cpu,
  Cloud,
  Server,
  ArrowUpCircle,
} from 'lucide-react';
import { useAiCapabilities, type Capability } from '@/hooks/use-ai-capabilities';
import { SpinnerInfinity } from 'spinners-react';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const CAPABILITY_META: Record<string, { label: string; icon: typeof Brain }> = {
  llm: { label: 'LLM', icon: Brain },
  stt: { label: 'Speech-to-Text', icon: Mic },
  tts: { label: 'Text-to-Speech', icon: Volume2 },
  ocr: { label: 'OCR', icon: ScanText },
  embeddings: { label: 'Embeddings', icon: Database },
};

function getCapabilityMeta(capability: string) {
  return CAPABILITY_META[capability] ?? { label: capability, icon: Brain };
}

function getBackendTypeLabel(backendType: string): { label: string; icon: typeof Brain } {
  switch (backendType) {
    case 'native':
    case 'local':
      return { label: 'Native', icon: Server };
    case 'http':
      return { label: 'HTTP', icon: Server };
    case 'cloud':
      return { label: 'Cloud', icon: Cloud };
    default:
      return { label: backendType, icon: Server };
  }
}

function qualityColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY CARD
// ═══════════════════════════════════════════════════════════════════════════

function CapabilityCard({ cap }: { cap: Capability }) {
  const meta = getCapabilityMeta(cap.capability);
  const Icon = meta.icon;
  const backendInfo = getBackendTypeLabel(cap.active_backend);
  const BackendIcon = backendInfo.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {meta.label}
          </CardTitle>
          <div className="flex items-center gap-2">
            {cap.gpu_loaded && (
              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-200">
                <Cpu className="h-3 w-3 mr-1" />
                GPU
              </Badge>
            )}
            {cap.available ? (
              <Badge className="bg-green-500/15 text-green-700 border-green-200">
                Disponible
              </Badge>
            ) : (
              <Badge variant="secondary">Non configure</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Active backend */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Backend actif</span>
          <Badge variant="outline" className="text-xs">
            <BackendIcon className="h-3 w-3 mr-1" />
            {backendInfo.label}
          </Badge>
        </div>

        {/* Quality score */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Qualite locale</span>
            <span className={`text-sm font-semibold ${qualityColor(cap.local_quality)}`}>
              {cap.local_quality}%
            </span>
          </div>
          <Progress value={cap.local_quality} className="h-2" />
        </div>

        {/* Cloud quality comparison if available */}
        {cap.cloud_quality !== null && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Qualite cloud</span>
              <span className={`text-sm font-semibold ${qualityColor(cap.cloud_quality)}`}>
                {cap.cloud_quality}%
              </span>
            </div>
            <Progress value={cap.cloud_quality} className="h-2" />
          </div>
        )}

        {/* VRAM requirement */}
        {cap.vram_required_mb > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">VRAM requise</span>
            <span className="text-xs">
              {cap.vram_required_mb >= 1024
                ? `${(cap.vram_required_mb / 1024).toFixed(1)} GB`
                : `${cap.vram_required_mb} MB`}
            </span>
          </div>
        )}

        {/* Backends list */}
        {cap.backends.length > 0 && (
          <div className="pt-2 border-t space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Backends disponibles</p>
            <div className="flex flex-wrap gap-1">
              {cap.backends.map((b) => (
                <Badge
                  key={b.name}
                  variant={b.available ? 'outline' : 'secondary'}
                  className="text-[10px]"
                >
                  {b.name} ({b.quality_score}%)
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Upgrade recommendation */}
        {cap.upgrade_recommended && (
          <div className="pt-2">
            <Badge className="bg-yellow-500/15 text-yellow-700 border-yellow-200 text-xs">
              <ArrowUpCircle className="h-3 w-3 mr-1" />
              Upgrade cloud recommande
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

export function CapabilityDashboard() {
  const { capabilities, loading, error, fetchCapabilities } = useAiCapabilities();

  useEffect(() => {
    fetchCapabilities();
  }, [fetchCapabilities]);

  if (loading && capabilities.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <SpinnerInfinity
          size={24}
          secondaryColor="rgba(128,128,128,0.2)"
          color="currentColor"
          speed={120}
          className="h-8 w-8"
        />
      </div>
    );
  }

  if (error && capabilities.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchCapabilities}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  const availableCount = capabilities.filter((c) => c.available).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Capacites IA</h2>
          <p className="text-sm text-muted-foreground">
            {availableCount}/{capabilities.length} capacites disponibles
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCapabilities} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {capabilities.map((cap) => (
          <CapabilityCard key={cap.capability} cap={cap} />
        ))}
      </div>

      {capabilities.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Brain className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Aucune capacite IA detectee. Verifiez que le service AI est demarre.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
