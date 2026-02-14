'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Cpu,
  HardDrive,
  Download,
  Trash2,
  Loader2,
  RefreshCw,
  Monitor,
  MemoryStick,
  CircuitBoard,
} from 'lucide-react';
import {
  aiApi,
  HardwareProfile,
  ModelEntry,
  ModelStatus,
  InferenceBackend,
} from '@/lib/api';
import { toast } from 'sonner';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getBackendLabel(backend: InferenceBackend): string {
  switch (backend.type) {
    case 'cuda':
      return `CUDA ${backend.version}`;
    case 'rocm':
      return `ROCm ${backend.version}`;
    case 'vulkan':
      return 'Vulkan';
    case 'metal':
      return 'Metal';
    case 'cpu':
      return 'CPU';
  }
}

function getStatusBadge(status: ModelStatus) {
  if (status === 'available') {
    return <Badge variant="outline">Disponible</Badge>;
  }
  if (status === 'ready') {
    return <Badge variant="secondary">Pret</Badge>;
  }
  if (status === 'loaded') {
    return <Badge className="bg-green-500/15 text-green-700 border-green-200">Charge</Badge>;
  }
  if (typeof status === 'object') {
    if ('downloading' in status) {
      return (
        <div className="flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          <Progress value={status.downloading.progress * 100} className="w-20 h-2" />
          <span className="text-xs">{(status.downloading.progress * 100).toFixed(0)}%</span>
        </div>
      );
    }
    if ('error' in status) {
      return <Badge variant="destructive">Erreur</Badge>;
    }
  }
  return <Badge variant="outline">Inconnu</Badge>;
}

function getModelTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    stt: 'Speech-to-Text',
    tts: 'Text-to-Speech',
    ocr: 'OCR',
    llm: 'LLM',
    embeddings: 'Embeddings',
  };
  return labels[type] || type;
}

export function ModelManagement() {
  const [hardware, setHardware] = useState<HardwareProfile | null>(null);
  const [localModels, setLocalModels] = useState<ModelEntry[]>([]);
  const [availableModels, setAvailableModels] = useState<ModelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [hwRes, localRes, availableRes] = await Promise.allSettled([
        aiApi.hardware(),
        aiApi.localModels(),
        aiApi.availableModels(),
      ]);

      if (hwRes.status === 'fulfilled') {
        setHardware(hwRes.value.data.hardware);
      }
      if (localRes.status === 'fulfilled') {
        setLocalModels(localRes.value.data.models || []);
      }
      if (availableRes.status === 'fulfilled') {
        setAvailableModels(availableRes.value.data.models || []);
      }
    } catch (error) {
      console.error('Failed to fetch model data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDownload = async (modelId: string) => {
    setDownloadingIds(prev => new Set(prev).add(modelId));
    try {
      await aiApi.downloadModel(modelId);
      toast.success(`Telechargement de ${modelId} lance`);
      // Refresh after a short delay
      setTimeout(fetchData, 2000);
    } catch (error) {
      console.error('Failed to download model:', error);
      toast.error('Erreur lors du telechargement');
    } finally {
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(modelId);
        return next;
      });
    }
  };

  const handleDelete = async (modelId: string) => {
    try {
      await aiApi.deleteModel(modelId);
      toast.success('Modele supprime');
      fetchData();
    } catch (error) {
      console.error('Failed to delete model:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Modeles & Hardware</h2>
          <p className="text-sm text-muted-foreground">
            Gerez les modeles IA locaux et surveillez le hardware
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Hardware Card */}
      {hardware && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Hardware detecte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <CircuitBoard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{hardware.cpu_cores} coeurs</p>
                  <p className="text-xs text-muted-foreground">CPU</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MemoryStick className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{formatBytes(hardware.system_ram_mb * 1024 * 1024)}</p>
                  <p className="text-xs text-muted-foreground">RAM</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Cpu className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {hardware.gpus.length > 0 ? hardware.gpus[0].name : 'Aucun'}
                  </p>
                  <p className="text-xs text-muted-foreground">GPU</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <HardDrive className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {hardware.total_vram_mb > 0
                      ? formatBytes(hardware.total_vram_mb * 1024 * 1024)
                      : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground">VRAM</p>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t">
              <Badge variant="secondary">
                Backend : {getBackendLabel(hardware.preferred_backend)}
              </Badge>
              {hardware.gpus.length > 1 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  +{hardware.gpus.length - 1} GPU(s) supplementaire(s)
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Local Models Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Modeles locaux
            <Badge variant="outline" className="ml-2">{localModels.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {localModels.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aucun modele local installe
            </p>
          ) : (
            <div className="space-y-3">
              {localModels.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{model.id}</p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {getModelTypeLabel(model.model_type)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {model.description}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{formatBytes(model.size_bytes)}</span>
                      {model.recommended_vram_mb > 0 && (
                        <span>VRAM recommandee : {formatBytes(model.recommended_vram_mb * 1024 * 1024)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {getStatusBadge(model.status)}
                    {(model.status === 'ready' || model.status === 'loaded') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(model.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Models Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="h-5 w-5" />
            Modeles disponibles
            <Badge variant="outline" className="ml-2">{availableModels.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {availableModels.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Tous les modeles sont deja installes
            </p>
          ) : (
            <div className="space-y-3">
              {availableModels.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{model.id}</p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {getModelTypeLabel(model.model_type)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {model.description}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{formatBytes(model.size_bytes)}</span>
                      {model.recommended_vram_mb > 0 && (
                        <span>VRAM recommandee : {formatBytes(model.recommended_vram_mb * 1024 * 1024)}</span>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(model.id)}
                      disabled={downloadingIds.has(model.id)}
                    >
                      {downloadingIds.has(model.id) ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Telecharger
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
