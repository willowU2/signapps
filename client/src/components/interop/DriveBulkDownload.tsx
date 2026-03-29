'use client';

/**
 * Feature 18: Drive → bulk download selected files
 */

import { useState } from 'react';
import { Download, Loader2, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { DriveNode } from '@/lib/api/drive';

interface DriveBulkDownloadProps {
  nodes: DriveNode[];
  getFileUrl: (nodeId: string) => string;
}

export function DriveBulkDownload({ nodes, getFileUrl }: DriveBulkDownloadProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const files = nodes.filter((n) => n.node_type !== 'folder');
    setSelected(new Set(files.map((n) => n.id)));
  };

  const clearAll = () => setSelected(new Set());

  const handleDownload = async () => {
    if (selected.size === 0) { toast.error('Sélectionnez des fichiers'); return; }
    setDownloading(true);
    try {
      const filesToDownload = nodes.filter((n) => selected.has(n.id));
      for (const node of filesToDownload) {
        const url = getFileUrl(node.id);
        if (!url) continue;
        const a = document.createElement('a');
        a.href = url;
        a.download = node.name;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // small delay to avoid browser popup blocking
        await new Promise((r) => setTimeout(r, 300));
      }
      toast.success(`${filesToDownload.length} fichier(s) téléchargé(s)`);
      setSelected(new Set());
    } catch {
      toast.error('Erreur lors du téléchargement');
    } finally {
      setDownloading(false);
    }
  };

  const fileNodes = nodes.filter((n) => n.node_type !== 'folder');

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={selectAll}>
          <CheckSquare className="h-3.5 w-3.5" /> Tout sélectionner
        </Button>
        {selected.size > 0 && (
          <>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={clearAll}>
              <Square className="h-3.5 w-3.5" /> Désélectionner
            </Button>
            <Button size="sm" className="gap-1.5 ml-auto" onClick={handleDownload} disabled={downloading}>
              {downloading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Download className="h-3.5 w-3.5" />}
              Télécharger ({selected.size})
            </Button>
          </>
        )}
      </div>

      {fileNodes.length === 0 && (
        <p className="text-xs text-muted-foreground">Aucun fichier disponible.</p>
      )}
    </div>
  );
}

/** Compact checkbox variant for use inside file rows */
interface BulkCheckboxProps {
  nodeId: string;
  selected: Set<string>;
  onToggle: (id: string) => void;
}

export function BulkCheckbox({ nodeId, selected, onToggle }: BulkCheckboxProps) {
  const isSelected = selected.has(nodeId);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(nodeId); }}
      className={`p-0.5 rounded transition-colors ${isSelected ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
      title={isSelected ? 'Désélectionner' : 'Sélectionner'}
    >
      {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
    </button>
  );
}
