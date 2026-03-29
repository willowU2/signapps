'use client';

/**
 * Feature 5: Doc → auto-save to Drive
 * Feature 19: Doc export → auto-upload to Drive
 */

import { useState, useEffect, useRef } from 'react';
import { CloudUpload, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { driveApi } from '@/lib/api/drive';

interface DocAutoSaveDriveProps {
  docId: string;
  docName: string;
  getContent: () => string;
  autoSaveInterval?: number; // ms, default 60_000
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function DocAutoSaveDrive({
  docId,
  docName,
  getContent,
  autoSaveInterval = 60_000,
}: DocAutoSaveDriveProps) {
  const [state, setSaveState] = useState<SaveState>('idle');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const saveNow = async () => {
    const content = getContent();
    if (!content.trim()) return;
    setSaveState('saving');
    try {
      const filename = `${docName}.txt`;
      const blob = new Blob([content], { type: 'text/plain' });
      const file = new File([blob], filename, { type: 'text/plain' });
      await driveApi.uploadFile(file, null);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 3000);
    } catch {
      setSaveState('error');
      toast.error('Échec de la sauvegarde Drive');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  useEffect(() => {
    timerRef.current = setInterval(saveNow, autoSaveInterval);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSaveInterval, docId, docName]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={saveNow}
      disabled={state === 'saving'}
      className="gap-1.5 text-xs"
      title="Sauvegarder dans Drive"
    >
      {state === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {state === 'saved' && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
      {(state === 'idle' || state === 'error') && <CloudUpload className="h-3.5 w-3.5" />}
      {state === 'saving' ? 'Sauvegarde...' : state === 'saved' ? 'Sauvegardé' : 'Drive'}
    </Button>
  );
}

/** One-shot export button — exports doc and uploads to Drive */
interface DocExportDriveProps {
  docName: string;
  getContent: () => string;
}

export function DocExportDrive({ docName, getContent }: DocExportDriveProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    const content = getContent();
    if (!content.trim()) { toast.error('Contenu vide'); return; }
    setLoading(true);
    try {
      const filename = `${docName}_export_${new Date().toISOString().slice(0, 10)}.txt`;
      const blob = new Blob([content], { type: 'text/plain' });
      const file = new File([blob], filename, { type: 'text/plain' });
      await driveApi.uploadFile(file, null);
      toast.success('Exporté vers Drive');
    } catch {
      toast.error('Erreur d\'exportation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading} className="gap-1.5">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
      Exporter vers Drive
    </Button>
  );
}
