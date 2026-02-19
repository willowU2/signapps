'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Upload,
  FileCode,
  Box,
  Network,
  HardDrive,
  Eye,
} from 'lucide-react';
import { composeApi, ComposeServicePreview } from '@/lib/api';
import { toast } from 'sonner';

interface ComposeImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ComposeImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: ComposeImportDialogProps) {
  const [yaml, setYaml] = useState('');
  const [autoStart, setAutoStart] = useState(true);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<ComposeServicePreview[] | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setYaml(content);
      setPreview(null);
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!yaml.trim()) return;
    setPreviewing(true);
    try {
      const res = await composeApi.preview(yaml);
      setPreview(res.data.services);
    } catch {
      toast.error('Erreur lors du parsing du fichier compose');
    } finally {
      setPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!yaml.trim()) return;
    setLoading(true);
    try {
      const res = await composeApi.import(yaml, autoStart);
      const count = res.data.length;
      toast.success(`${count} container(s) importe(s) avec succes`);
      onSuccess();
      onOpenChange(false);
      setYaml('');
      setPreview(null);
    } catch {
      toast.error("Erreur lors de l'import du compose");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setYaml('');
      setPreview(null);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Importer un Docker Compose
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File upload */}
          <div className="space-y-2">
            <Label>Fichier docker-compose.yml</Label>
            <div className="flex gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Glisser un fichier ou cliquer pour parcourir
                </span>
                <input
                  type="file"
                  accept=".yml,.yaml,.json"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>

          {/* YAML textarea */}
          <div className="space-y-2">
            <Label>Ou collez le contenu YAML</Label>
            <textarea
              className="w-full h-48 rounded-lg border bg-muted/50 p-3 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={`version: '3'\nservices:\n  app:\n    image: nginx:latest\n    ports:\n      - "8080:80"`}
              value={yaml}
              onChange={(e) => {
                setYaml(e.target.value);
                setPreview(null);
              }}
            />
          </div>

          {/* Options */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label>Demarrer automatiquement</Label>
              <p className="text-xs text-muted-foreground">
                Lancer les containers apres creation
              </p>
            </div>
            <Switch checked={autoStart} onCheckedChange={setAutoStart} />
          </div>

          {/* Preview button */}
          {!preview && (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={handlePreview}
              disabled={!yaml.trim() || previewing}
            >
              {previewing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Apercu des services
            </Button>
          )}

          {/* Preview results */}
          {preview && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Services detectes</Label>
                  <Badge variant="secondary">{preview.length} service(s)</Badge>
                </div>
                {preview.map((svc: ComposeServicePreview) => (
                  <div
                    key={svc.service_name}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <Box className="h-4 w-4 text-primary" />
                      <span className="font-medium">{svc.service_name}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {svc.image}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {svc.ports.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Network className="h-3 w-3" />
                          {svc.ports.map((p) => `${p.host}:${p.container}`).join(', ')}
                        </span>
                      )}
                      {svc.volumes.length > 0 && (
                        <span className="flex items-center gap-1">
                          <HardDrive className="h-3 w-3" />
                          {svc.volumes.length} volume(s)
                        </span>
                      )}
                      {svc.environment.length > 0 && (
                        <span>{svc.environment.length} variable(s) env</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleImport}
            disabled={loading || !yaml.trim()}
            className="gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
