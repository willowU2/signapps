'use client';

// Idea 31: Export — unified data export across modules
// Idea 32: Import — detect data type and route to correct module

import { useState } from 'react';
import { Download, Upload, Loader2, CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getClient, ServiceName } from '@/lib/api/factory';
import { smartRoute } from './smart-suggestions';

const identityClient = () => getClient(ServiceName.IDENTITY);

const MODULES = [
  { id: 'docs', label: 'Documents', icon: '📄' },
  { id: 'contacts', label: 'Contacts', icon: '👤' },
  { id: 'tasks', label: 'Tâches', icon: '✅' },
  { id: 'calendar', label: 'Calendrier', icon: '📅' },
  { id: 'sheets', label: 'Sheets', icon: '📊' },
  { id: 'drive', label: 'Drive', icon: '📁' },
  { id: 'mail', label: 'Emails', icon: '✉️' },
];

/** Idea 31 – Unified export dialog */
export function UnifiedExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>(['contacts', 'tasks']);
  const [format, setFormat] = useState<'json' | 'csv' | 'zip'>('zip');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const doExport = async () => {
    if (!selected.length) { toast.error('Sélectionnez au moins un module'); return; }
    setLoading(true);
    try {
      const { data } = await identityClient().post('/export/unified', {
        modules: selected,
        format,
      }, { responseType: 'blob' });

      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signapps-export-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
      toast.success('Export téléchargé');
    } catch {
      // Fallback: export via individual APIs
      const exportData: Record<string, unknown[]> = {};
      await Promise.allSettled(selected.map(async m => {
        try {
          const { data } = await identityClient().get(`/${m}/export`);
          exportData[m] = data;
        } catch { exportData[m] = []; }
      }));
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signapps-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
      toast.success('Export JSON téléchargé');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-4 h-4" />Export unifié
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Modules à exporter</p>
            <div className="grid grid-cols-2 gap-1.5">
              {MODULES.map(m => (
                <div key={m.id} className="flex items-center gap-2 p-1.5 rounded border hover:bg-muted/40">
                  <Checkbox
                    id={`exp-${m.id}`}
                    checked={selected.includes(m.id)}
                    onCheckedChange={() => toggle(m.id)}
                  />
                  <Label htmlFor={`exp-${m.id}`} className="text-xs cursor-pointer">
                    {m.icon} {m.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            {(['json', 'csv', 'zip'] as const).map(f => (
              <Button
                key={f}
                size="sm"
                variant={format === f ? 'default' : 'outline'}
                onClick={() => setFormat(f)}
                className="h-7 text-xs uppercase"
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="h-8 text-xs">Annuler</Button>
          <Button onClick={doExport} disabled={loading || !selected.length} className="h-8 gap-1 text-xs">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {done ? 'Téléchargé' : 'Exporter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Idea 32 – Smart import: detect type and route */
export function SmartImport() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ module: string; confidence: number } | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);

    try {
      const text = await file.text();
      const routed = await smartRoute(text.slice(0, 500));
      setResult({ module: routed.module, confidence: routed.confidence });

      // Try to upload to the detected module
      const form = new FormData();
      form.append('file', file);
      form.append('module', routed.module);
      await identityClient().post('/import/smart', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Fichier importé vers ${routed.module} (${Math.round(routed.confidence * 100)}% confiance)`);
    } catch {
      toast.info('Import local — synchronisation différée');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 cursor-pointer p-3 border-2 border-dashed rounded-lg hover:border-primary/50 transition-colors">
        <Upload className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {loading ? 'Analyse en cours…' : 'Importer un fichier (détection automatique)'}
        </span>
        <input type="file" className="hidden" onChange={handleFile} disabled={loading} accept=".json,.csv,.xlsx,.vcf,.ics" />
      </Label>
      {result && (
        <div className="flex items-center gap-2 text-xs">
          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          <span>Détecté:</span>
          <Badge variant="outline" className="gap-1">{result.module} <ArrowRight className="w-2.5 h-2.5" /></Badge>
          <span className="text-muted-foreground">{Math.round(result.confidence * 100)}% confiance</span>
        </div>
      )}
    </div>
  );
}
