'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Cpu, HardDrive, Monitor, RefreshCw, Server } from 'lucide-react';
import { useAiCapabilities } from '@/hooks/use-ai-capabilities';
import { getClient, ServiceName } from '@/lib/api/factory';
import { SpinnerInfinity } from 'spinners-react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface GpuProfile {
  name: string;
  tier: string;
  description: string;
  recommendations: ProfileModel[];
  total_vram_required_mb: number;
}

interface ProfileModel {
  capability: string;
  model_id: string;
  model_name: string;
  vram_mb: number;
  quality_score: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

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

function formatVram(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function qualityColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function AiSettingsPage() {
  const { gpuStatus, fetchGpuStatus } = useAiCapabilities();
  const [profiles, setProfiles] = useState<GpuProfile[]>([]);
  const [selectedProfileName, setSelectedProfileName] = useState<string>('');
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    setError(null);
    try {
      const client = getClient(ServiceName.AI);
      const res = await client.get<GpuProfile[]>('/ai/gpu/profiles');
      const list = Array.isArray(res.data) ? res.data : [];
      setProfiles(list);
      if (list.length > 0 && !selectedProfileName) {
        setSelectedProfileName(list[0].name);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch profiles';
      setError(message);
    } finally {
      setLoadingProfiles(false);
    }
  }, [selectedProfileName]);

  useEffect(() => {
    fetchProfiles();
    fetchGpuStatus();
  }, [fetchProfiles, fetchGpuStatus]);

  const selectedProfile = profiles.find((p) => p.name === selectedProfileName);

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Settings</h1>
        <p className="text-muted-foreground">
          Configuration GPU, profils de modeles et informations hardware
        </p>
      </div>

      {/* Current Hardware Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Hardware actuel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {gpuStatus ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Tier GPU</p>
                <Badge className={tierBadgeClass(gpuStatus.tier ?? 'cpu')}>
                  {(gpuStatus.tier ?? 'cpu').toUpperCase()}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">GPUs detectes</p>
                <p className="text-sm font-semibold">{(gpuStatus.gpus ?? []).length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">VRAM totale</p>
                <p className="text-sm font-semibold">{formatVram(gpuStatus.total_vram_mb)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">VRAM libre</p>
                <p className="text-sm font-semibold">{formatVram(gpuStatus.free_vram_mb)}</p>
              </div>

              {/* GPU names */}
              {(gpuStatus.gpus ?? []).map((gpu) => (
                <div key={gpu.id} className="col-span-full">
                  <div className="flex items-center gap-2 text-sm">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">GPU {gpu.id}:</span>
                    <span>{gpu.name}</span>
                    <span className="text-muted-foreground">
                      ({formatVram(gpu.used_vram_mb)} / {formatVram(gpu.total_vram_mb)} utilise)
                    </span>
                  </div>
                </div>
              ))}

              {(gpuStatus.gpus ?? []).length === 0 && (
                <div className="col-span-full text-sm text-muted-foreground italic flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Aucun GPU detecte — inference CPU uniquement
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-6">
              <SpinnerInfinity
                size={24}
                secondaryColor="rgba(128,128,128,0.2)"
                color="currentColor"
                speed={120}
                className="h-6 w-6"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* GPU Profile Selector */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Profils GPU
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchProfiles}
              disabled={loadingProfiles}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingProfiles ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {loadingProfiles && profiles.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <SpinnerInfinity
                size={24}
                secondaryColor="rgba(128,128,128,0.2)"
                color="currentColor"
                speed={120}
                className="h-6 w-6"
              />
            </div>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun profil GPU disponible. Verifiez que le service AI est demarre.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <Select
                  value={selectedProfileName}
                  onValueChange={setSelectedProfileName}
                >
                  <SelectTrigger className="w-80">
                    <SelectValue placeholder="Selectionner un profil" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.name} value={profile.name}>
                        <div className="flex items-center gap-2">
                          <span>{profile.name}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ml-1 ${tierBadgeClass(profile.tier)}`}
                          >
                            {profile.tier.toUpperCase()}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProfile && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {selectedProfile.description}
                  </p>

                  {/* Model recommendations table */}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium">Capacite</th>
                          <th className="text-left p-3 font-medium">Modele recommande</th>
                          <th className="text-right p-3 font-medium">VRAM</th>
                          <th className="text-right p-3 font-medium">Qualite</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedProfile.recommendations ?? []).map((model) => (
                          <tr key={model.capability} className="border-b last:border-b-0">
                            <td className="p-3">
                              <Badge variant="outline" className="text-xs">
                                {model.capability}
                              </Badge>
                            </td>
                            <td className="p-3 font-mono text-xs">{model.model_id}</td>
                            <td className="p-3 text-right text-xs text-muted-foreground">
                              {formatVram(model.vram_mb)}
                            </td>
                            <td className="p-3 text-right">
                              <span className={`text-xs font-semibold ${qualityColor(model.quality_score * 100)}`}>
                                {Math.round(model.quality_score * 100)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(selectedProfile.recommendations ?? []).length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-muted-foreground">
                              Aucun modele configure pour ce profil
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
