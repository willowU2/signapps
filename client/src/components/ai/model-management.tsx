'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  Play,
  AlertTriangle,
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

function formatVram(vramMb: number): string {
  if (vramMb === 0) return 'CPU';
  if (vramMb < 1024) return `${vramMb} MB VRAM`;
  return `${(vramMb / 1024).toFixed(0)} GB VRAM`;
}

const MODEL_TYPE_FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'llm', label: 'LLM' },
  { value: 'stt', label: 'STT' },
  { value: 'tts', label: 'TTS' },
  { value: 'ocr', label: 'OCR' },
  { value: 'embeddings', label: 'Embeddings' },
] as const;

type TypeFilter = (typeof MODEL_TYPE_FILTERS)[number]['value'];

interface ModelManagementProps {
  onSelectLlmModel?: (modelId: string) => void;
}

export function ModelManagement({ onSelectLlmModel }: ModelManagementProps = {}) {
  const [hardware, setHardware] = useState<HardwareProfile | null>(null);
  const [localModels, setLocalModels] = useState<ModelEntry[]>([]);
  const [availableModels, setAvailableModels] = useState<ModelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [compatibleOnly, setCompatibleOnly] = useState(true);
  const pollIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

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
        // Only show models not yet downloaded
        const all = availableRes.value.data.models || [];
        setAvailableModels(all.filter(m => m.status === 'available'));
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

  // Cleanup polling intervals on unmount
  useEffect(() => {
    const intervals = pollIntervalsRef.current;
    return () => {
      intervals.forEach((interval) => clearInterval(interval));
      intervals.clear();
    };
  }, []);

  const stopPolling = useCallback((modelId: string) => {
    const interval = pollIntervalsRef.current.get(modelId);
    if (interval) {
      clearInterval(interval);
      pollIntervalsRef.current.delete(modelId);
    }
  }, []);

  const startPolling = useCallback((modelId: string) => {
    // Don't start if already polling
    if (pollIntervalsRef.current.has(modelId)) return;

    const interval = setInterval(async () => {
      try {
        const res = await aiApi.getModelStatus(modelId);
        const status = res.data.status;

        if (typeof status === 'object' && 'downloading' in status) {
          setDownloadProgress((prev) => ({
            ...prev,
            [modelId]: status.downloading.progress,
          }));
        } else if (status === 'ready') {
          // Download finished
          stopPolling(modelId);
          setDownloadingIds((prev) => {
            const next = new Set(prev);
            next.delete(modelId);
            return next;
          });
          setDownloadProgress((prev) => {
            const next = { ...prev };
            delete next[modelId];
            return next;
          });
          toast.success(`${modelId} telecharge`);
          fetchData();
        } else if (typeof status === 'object' && 'error' in status) {
          stopPolling(modelId);
          setDownloadingIds((prev) => {
            const next = new Set(prev);
            next.delete(modelId);
            return next;
          });
          setDownloadProgress((prev) => {
            const next = { ...prev };
            delete next[modelId];
            return next;
          });
          toast.error(`Erreur: ${status.error.message}`);
        }
      } catch {
        // Network error — keep polling
      }
    }, 2000);

    pollIntervalsRef.current.set(modelId, interval);
  }, [stopPolling, fetchData]);

  const handleDownload = async (modelId: string) => {
    setDownloadingIds((prev) => new Set(prev).add(modelId));
    setDownloadProgress((prev) => ({ ...prev, [modelId]: 0 }));
    try {
      await aiApi.downloadModel(modelId);
      toast.success(`Telechargement de ${modelId} lance`);
      startPolling(modelId);
    } catch (error) {
      console.error('Failed to download model:', error);
      toast.error('Erreur lors du telechargement');
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(modelId);
        return next;
      });
      setDownloadProgress((prev) => {
        const next = { ...prev };
        delete next[modelId];
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

  const totalVram = hardware?.total_vram_mb ?? 0;

  const isCompatible = useCallback(
    (model: ModelEntry) =>
      model.recommended_vram_mb === 0 || model.recommended_vram_mb <= totalVram,
    [totalVram],
  );

  const filterAndSort = useCallback(
    (models: ModelEntry[]) => {
      let filtered = models;
      if (typeFilter !== 'all') {
        filtered = filtered.filter((m) => m.model_type === typeFilter);
      }
      if (compatibleOnly) {
        filtered = filtered.filter(isCompatible);
      }
      return filtered.sort((a, b) => a.size_bytes - b.size_bytes);
    },
    [typeFilter, compatibleOnly, isCompatible],
  );

  const filteredLocal = useMemo(
    () => filterAndSort(localModels),
    [localModels, filterAndSort],
  );
  const filteredAvailable = useMemo(
    () => filterAndSort(availableModels),
    [availableModels, filterAndSort],
  );

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

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex flex-wrap gap-1">
              {MODEL_TYPE_FILTERS.map((f) => (
                <Button
                  key={f.value}
                  variant={typeFilter === f.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTypeFilter(f.value)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <Switch
                id="compat-filter"
                checked={compatibleOnly}
                onCheckedChange={setCompatibleOnly}
              />
              <Label htmlFor="compat-filter" className="text-sm cursor-pointer">
                Compatible avec mon hardware
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Local Models Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Modeles locaux
            <Badge variant="outline" className="ml-2">{filteredLocal.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLocal.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aucun modele local{typeFilter !== 'all' ? ` (${getModelTypeLabel(typeFilter)})` : ''}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredLocal.map((model) => {
                const compat = isCompatible(model);
                return (
                  <div
                    key={model.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{model.id}</p>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {getModelTypeLabel(model.model_type)}
                        </Badge>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {formatBytes(model.size_bytes)}
                        </Badge>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {formatVram(model.recommended_vram_mb)}
                        </Badge>
                        {!compat && (
                          <Badge className="text-xs shrink-0 bg-orange-500/15 text-orange-700 border-orange-200">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            VRAM insuffisante
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {model.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {getStatusBadge(model.status)}
                      {(model.status === 'ready' || model.status === 'loaded') && model.model_type === 'llm' && onSelectLlmModel && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSelectLlmModel(model.id)}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Utiliser
                        </Button>
                      )}
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
                );
              })}
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
            <Badge variant="outline" className="ml-2">{filteredAvailable.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAvailable.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {typeFilter !== 'all'
                ? `Aucun modele ${getModelTypeLabel(typeFilter)} disponible`
                : 'Tous les modeles sont deja installes'}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredAvailable.map((model) => {
                const compat = isCompatible(model);
                return (
                  <div
                    key={model.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{model.id}</p>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {getModelTypeLabel(model.model_type)}
                        </Badge>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {formatBytes(model.size_bytes)}
                        </Badge>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {formatVram(model.recommended_vram_mb)}
                        </Badge>
                        {!compat && (
                          <Badge className="text-xs shrink-0 bg-orange-500/15 text-orange-700 border-orange-200">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            VRAM insuffisante
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {model.description}
                      </p>
                    </div>
                    <div className="ml-4 min-w-[140px] flex flex-col items-end gap-1">
                      {downloadingIds.has(model.id) ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-xs text-muted-foreground">
                              {((downloadProgress[model.id] ?? 0) * 100).toFixed(0)}%
                            </span>
                          </div>
                          <Progress
                            value={(downloadProgress[model.id] ?? 0) * 100}
                            className="w-full h-2"
                          />
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(model.id)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Telecharger
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
