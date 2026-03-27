'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Cpu, HardDrive, Clock, Layers } from 'lucide-react';
import { useAiCapabilities, type GpuState, type LoadedModel } from '@/hooks/use-ai-capabilities';
import { SpinnerInfinity } from 'spinners-react';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function formatVram(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function vramPercent(gpu: GpuState): number {
  if (gpu.total_vram_mb === 0) return 0;
  return Math.round((gpu.used_vram_mb / gpu.total_vram_mb) * 100);
}

function vramBarColor(percent: number): string {
  if (percent >= 90) return '[&>div]:bg-red-500';
  if (percent >= 70) return '[&>div]:bg-yellow-500';
  return '';
}

function roleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' {
  switch (role) {
    case 'always_on':
    case 'always-on':
      return 'default';
    case 'dynamic':
      return 'secondary';
    default:
      return 'outline';
  }
}

function roleLabel(role: string): string {
  switch (role) {
    case 'always_on':
    case 'always-on':
      return 'Permanent';
    case 'dynamic':
      return 'Dynamique';
    default:
      return role;
  }
}

function tierBadgeClass(tier: string): string {
  switch (tier) {
    case 'high':
      return 'bg-green-500/15 text-green-700 border-green-200';
    case 'medium':
      return 'bg-yellow-500/15 text-yellow-700 border-yellow-200';
    case 'low':
      return 'bg-orange-500/15 text-orange-700 border-orange-200';
    case 'cpu':
      return 'bg-gray-500/15 text-gray-700 border-gray-200';
    default:
      return '';
  }
}

function formatRelativeTime(isoDate: string): string {
  try {
    const diff = Date.now() - new Date(isoDate).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}j`;
  } catch {
    return '-';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LOADED MODEL ROW
// ═══════════════════════════════════════════════════════════════════════════

function LoadedModelRow({ model }: { model: LoadedModel }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-card/50 border text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-mono text-xs truncate">{model.model_id}</span>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {model.capability}
        </Badge>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0 ml-2">
        <span>{formatVram(model.vram_mb)}</span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatRelativeTime(model.last_used)}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GPU CARD
// ═══════════════════════════════════════════════════════════════════════════

function GpuCard({ gpu }: { gpu: GpuState }) {
  const percent = vramPercent(gpu);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            GPU {gpu.id}: {gpu.name}
          </CardTitle>
          <Badge variant={roleBadgeVariant(gpu.role)}>
            {roleLabel(gpu.role)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* VRAM bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">VRAM</span>
            <span className="text-xs font-medium">
              {formatVram(gpu.used_vram_mb)} / {formatVram(gpu.total_vram_mb)} ({percent}%)
            </span>
          </div>
          <Progress value={percent} className={`h-2.5 ${vramBarColor(percent)}`} />
        </div>

        {/* Loaded models */}
        {gpu.loaded_models.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-xs font-medium text-muted-foreground">
              Modeles charges ({gpu.loaded_models.length})
            </p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {gpu.loaded_models.map((model) => (
                <LoadedModelRow key={model.model_id} model={model} />
              ))}
            </div>
          </div>
        )}

        {gpu.loaded_models.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Aucun modele charge</p>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GPU MONITOR (auto-refresh every 5s)
// ═══════════════════════════════════════════════════════════════════════════

export function GpuMonitor() {
  const { gpuStatus, fetchGpuStatus } = useAiCapabilities();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Initial fetch
    fetchGpuStatus();

    // Auto-refresh every 5 seconds
    intervalRef.current = setInterval(() => {
      fetchGpuStatus();
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchGpuStatus]);

  if (!gpuStatus) {
    return (
      <div className="flex items-center justify-center py-8">
        <SpinnerInfinity
          size={24}
          secondaryColor="rgba(128,128,128,0.2)"
          color="currentColor"
          speed={120}
          className="h-6 w-6"
        />
      </div>
    );
  }

  const totalModels = gpuStatus.gpus.reduce(
    (acc, gpu) => acc + gpu.loaded_models.length,
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Moniteur GPU
          </h2>
          <p className="text-sm text-muted-foreground">
            Actualisation automatique toutes les 5s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs text-muted-foreground">En direct</span>
        </div>
      </div>

      {/* Summary strip */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <Badge className={tierBadgeClass(gpuStatus.tier)}>
              Tier: {gpuStatus.tier.toUpperCase()}
            </Badge>
            <div className="text-sm">
              <span className="text-muted-foreground">VRAM totale: </span>
              <span className="font-medium">{formatVram(gpuStatus.total_vram_mb)}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">VRAM libre: </span>
              <span className="font-medium">{formatVram(gpuStatus.free_vram_mb)}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">GPUs: </span>
              <span className="font-medium">{gpuStatus.gpus.length}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Modeles charges: </span>
              <span className="font-medium">{totalModels}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GPU cards */}
      {gpuStatus.gpus.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {gpuStatus.gpus.map((gpu) => (
            <GpuCard key={gpu.id} gpu={gpu} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center">
            <Cpu className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Aucun GPU detecte. L&apos;inference s&apos;execute sur CPU.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
