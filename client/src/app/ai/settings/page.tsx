"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cpu, HardDrive, Monitor, RefreshCw } from "lucide-react";
import { getClient, ServiceName } from "@/lib/api/factory";
import { usePageTitle } from "@/hooks/use-page-title";

interface GpuProfile {
  name: string;
  tier: string;
  description: string;
  recommendations?: Array<{
    capability: string;
    model_id: string;
    model_name: string;
    vram_mb: number;
    quality_score: number;
  }>;
  total_vram_required_mb?: number;
}

interface GpuStatusData {
  gpus?: Array<{
    id: number;
    name: string;
    total_vram_mb: number;
    used_vram_mb: number;
    role: string;
  }>;
  total_vram_mb?: number;
  free_vram_mb?: number;
  tier?: string;
}

function formatVram(mb: number): string {
  if (!mb) return "0 MB";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export default function AiSettingsPage() {
  usePageTitle("Parametres IA");
  const [gpuStatus, setGpuStatus] = useState<GpuStatusData | null>(null);
  const [profiles, setProfiles] = useState<GpuProfile[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const client = getClient(ServiceName.AI);
        const [gpuRes, profilesRes] = await Promise.allSettled([
          client.get("/ai/gpu/status"),
          client.get("/ai/gpu/profiles"),
        ]);

        if (gpuRes.status === "fulfilled") {
          setGpuStatus(gpuRes.value.data || null);
        }
        if (profilesRes.status === "fulfilled") {
          const data = profilesRes.value.data;
          setProfiles(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const gpus = gpuStatus?.gpus || [];
  const selectedProfile = profiles[selectedIdx] || null;
  const recs = selectedProfile?.recommendations || [];

  return (
    <div className="w-full py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Settings</h1>
        <p className="text-muted-foreground">
          Configuration GPU, profils de modeles et informations hardware
        </p>
      </div>

      {/* Hardware */}
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
                <p className="text-xs text-muted-foreground">Tier</p>
                <Badge variant="outline">
                  {(gpuStatus.tier || "cpu").toUpperCase()}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">GPUs</p>
                <p className="text-sm font-semibold">{gpus.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">VRAM totale</p>
                <p className="text-sm font-semibold">
                  {formatVram(gpuStatus.total_vram_mb || 0)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">VRAM libre</p>
                <p className="text-sm font-semibold">
                  {formatVram(gpuStatus.free_vram_mb || 0)}
                </p>
              </div>
              {gpus.map((gpu) => (
                <div
                  key={gpu.id}
                  className="col-span-full flex items-center gap-2 text-sm"
                >
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">GPU {gpu.id}:</span>
                  <span>{gpu.name}</span>
                  <span className="text-muted-foreground">
                    ({formatVram(gpu.used_vram_mb)} /{" "}
                    {formatVram(gpu.total_vram_mb)})
                  </span>
                </div>
              ))}
            </div>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Service AI non disponible
            </p>
          )}
        </CardContent>
      </Card>

      {/* Profiles */}
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
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {loading ? "Chargement..." : "Aucun profil disponible."}
            </p>
          ) : (
            <>
              <div className="flex gap-2 flex-wrap">
                {profiles.map((p, i) => (
                  <Button
                    key={p.name}
                    variant={i === selectedIdx ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedIdx(i)}
                  >
                    {p.name}
                  </Button>
                ))}
              </div>

              {selectedProfile && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {selectedProfile.description}
                  </p>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium">
                            Capacite
                          </th>
                          <th className="text-left p-3 font-medium">Modele</th>
                          <th className="text-right p-3 font-medium">VRAM</th>
                          <th className="text-right p-3 font-medium">
                            Qualite
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {recs.map((m) => (
                          <tr
                            key={m.capability}
                            className="border-b last:border-b-0"
                          >
                            <td className="p-3">
                              <Badge variant="outline" className="text-xs">
                                {m.capability}
                              </Badge>
                            </td>
                            <td className="p-3 font-mono text-xs">
                              {m.model_name || m.model_id}
                            </td>
                            <td className="p-3 text-right text-xs text-muted-foreground">
                              {formatVram(m.vram_mb)}
                            </td>
                            <td className="p-3 text-right text-xs font-semibold">
                              {Math.round(m.quality_score * 100)}%
                            </td>
                          </tr>
                        ))}
                        {recs.length === 0 && (
                          <tr>
                            <td
                              colSpan={4}
                              className="p-4 text-center text-muted-foreground"
                            >
                              Aucun modele pour ce profil
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
