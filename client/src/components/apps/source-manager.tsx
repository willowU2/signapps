'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, RefreshCw, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { storeApi } from '@/lib/api';
import type { AppSource } from '@/lib/api';
import { toast } from 'sonner';

interface SourceManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSourcesChanged?: () => void;
}

export function SourceManager({ open, onOpenChange, onSourcesChanged }: SourceManagerProps) {
  const [sources, setSources] = useState<AppSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Add form
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);

  // Validation
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<{ valid: boolean; app_count?: number; error?: string } | null>(null);

  const fetchSources = async () => {
    setLoading(true);
    try {
      const res = await storeApi.listSources();
      setSources(res.data);
    } catch {
      toast.error('Failed to load sources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchSources();
  }, [open]);

  const isValidUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleValidate = async () => {
    if (!newUrl.trim() || !isValidUrl(newUrl.trim())) {
      setValidation({ valid: false, error: 'Invalid URL format' });
      return;
    }
    setValidating(true);
    setValidation(null);
    try {
      const res = await storeApi.validateSource({ name: newName.trim() || 'test', url: newUrl.trim() });
      setValidation(res.data);
    } catch {
      setValidation({ valid: false, error: 'Failed to reach source' });
    } finally {
      setValidating(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newUrl.trim() || !validation?.valid) return;
    setAdding(true);
    try {
      await storeApi.addSource({ name: newName.trim(), url: newUrl.trim() });
      setNewName('');
      setNewUrl('');
      setValidation(null);
      toast.success('Source added');
      fetchSources();
      onSourcesChanged?.();
    } catch {
      toast.error('Failed to add source');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await storeApi.deleteSource(id);
      toast.success(`${name} removed`);
      fetchSources();
      onSourcesChanged?.();
    } catch {
      toast.error('Failed to delete source');
    }
  };

  const handleRefresh = async (id: string) => {
    setRefreshingId(id);
    try {
      await storeApi.refreshSource(id);
      toast.success('Source refreshed');
      fetchSources();
      onSourcesChanged?.();
    } catch {
      toast.error('Failed to refresh source');
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Sources</DialogTitle>
        </DialogHeader>

        {/* Add new source */}
        <div className="space-y-3 rounded-lg border p-4">
          <h4 className="text-sm font-medium">Add Source</h4>
          <div className="space-y-2">
            <Label className="text-xs">Name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="My Custom Source"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">URL</Label>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                value={newUrl}
                onChange={(e) => {
                  setNewUrl(e.target.value);
                  setValidation(null);
                }}
                placeholder="https://example.com/cosmos-store"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleValidate}
                disabled={validating || !newUrl.trim()}
              >
                {validating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Test
              </Button>
            </div>
            {validation && (
              <p className={`text-xs ${validation.valid ? 'text-green-600' : 'text-destructive'}`}>
                {validation.valid
                  ? `✓ ${validation.app_count} apps found`
                  : `✗ ${validation.error || 'Invalid source'}`}
              </p>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={adding || !newName.trim() || !newUrl.trim() || !validation?.valid}
          >
            {adding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add
          </Button>
        </div>

        {/* Sources list */}
        <div className="space-y-3">
          {loading && sources.length === 0 && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {sources.map((source) => (
            <div key={source.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{source.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {source.app_count} apps
                  </Badge>
                  {source.last_error ? (
                    <Badge variant="destructive" className="text-xs">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Error
                    </Badge>
                  ) : source.last_fetched ? (
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      OK
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{source.url}</p>
                {source.last_error && (
                  <p className="mt-1 text-xs text-destructive">{source.last_error}</p>
                )}
                {source.last_fetched && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last fetched: {new Date(source.last_fetched).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRefresh(source.id)}
                  disabled={refreshingId === source.id}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshingId === source.id ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(source.id, source.name)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
